import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { parseToolCall, TOOLS, type ToolName } from '../data/harnessTasks'

// The HARNESS: the deterministic code around a (flaky, tiny) model. It lets the
// model emit a tool call, PARSES it, DISPATCHES to a real JS tool, and treats the
// tool's output as authoritative — so the arithmetic is always right even though the
// model can't add. Parse failures are surfaced (not thrown) so the UI can show the
// "why harnesses exist" robustness lesson.

export interface HarnessTrace {
  instruction: string
  modelRaw: string // everything the model emitted after "… => "
  parsed: { tool: ToolName; args: number[] } | null
  error: string | null // parse/validation failure (robustness path)
  toolResult: string | null // JS tool output — authoritative
  modelGuess: string | null // the answer the model wrote itself (for the no-harness contrast)
}

/** Greedy generation to a newline (or `maxNew` chars). */
function generateLine(model: Model, tok: CharTokenizer, prompt: string, maxNew = 24): string {
  const ids = tok.encode(prompt)
  const nl = tok.stoi.get('\n')
  const out: number[] = []
  for (let s = 0; s < maxNew; s++) {
    const window = ids.slice(Math.max(0, ids.length - model.cfg.contextLen))
    const { logits } = model.forward(window, DEFAULT_FEATURE_FLAGS)
    const V = logits.cols
    const base = (logits.rows - 1) * V
    let best = 0
    for (let j = 1; j < V; j++) if (logits.data[base + j] > logits.data[base + best]) best = j
    if (best === nl) break
    out.push(best)
    ids.push(best)
  }
  return tok.decode(out)
}

/**
 * Run one instruction through the harness. The model emits `tool(a b c) = <guess>`;
 * we split on `=` to separate the CALL (which we parse + run in JS) from the model's
 * own guessed answer (kept only to contrast "no harness" vs "harness").
 */
export function runHarness(model: Model, tok: CharTokenizer, instruction: string): HarnessTrace {
  const stem = `${instruction.trim()} => `
  const raw = generateLine(model, tok, stem).trim() // e.g. "sum(6 9 2) = 18"
  const eq = raw.indexOf('=')
  const callText = eq >= 0 ? raw.slice(0, eq) : raw
  const modelGuess = eq >= 0 ? raw.slice(eq + 1).trim() || null : null

  const p = parseToolCall(callText)
  if ('error' in p) {
    return { instruction, modelRaw: raw, parsed: null, error: p.error, toolResult: null, modelGuess }
  }
  let toolResult: string
  try {
    toolResult = TOOLS[p.tool](p.args)
  } catch {
    return { instruction, modelRaw: raw, parsed: p, error: 'tool threw on those arguments', toolResult: null, modelGuess }
  }
  return { instruction, modelRaw: raw, parsed: p, error: null, toolResult, modelGuess }
}

// ---- agent loop (multi-step) -----------------------------------------------
// The harness lets the model emit a call, runs it, feeds the RESULT back into the
// context, and lets the model emit the next call — until it emits `done`. Reading
// the observation back and acting again is what turns tool-use into an agent.

export interface AgentStep {
  call: { tool: ToolName; args: number[] } | null
  error: string | null
  result: string | null
}
export interface AgentTrace {
  instruction: string
  steps: AgentStep[]
  done: boolean
  finalAnswer: string | null
}

/** Greedily generate until the model emits `=` (it finished a call and expects the
 *  result) or a newline — whichever comes first. Returns the text before the stop. */
function generateUntil(model: Model, tok: CharTokenizer, prompt: string, maxNew = 16): string {
  const ids = tok.encode(prompt)
  const eq = tok.stoi.get('=')
  const nl = tok.stoi.get('\n')
  const out: number[] = []
  for (let s = 0; s < maxNew; s++) {
    const window = ids.slice(Math.max(0, ids.length - model.cfg.contextLen))
    const { logits } = model.forward(window, DEFAULT_FEATURE_FLAGS)
    const V = logits.cols
    const base = (logits.rows - 1) * V
    let best = 0
    for (let j = 1; j < V; j++) if (logits.data[base + j] > logits.data[base + best]) best = j
    if (best === nl) break
    if (best === eq) break // stop BEFORE the '=' — the harness supplies the result
    out.push(best)
    ids.push(best)
  }
  return tok.decode(out)
}

/**
 * Run a (possibly multi-step) instruction as an agent loop. Each turn: the model
 * emits a call, the harness runs the real tool and appends the authoritative
 * `= result => ` back into the context, and the model reads it to decide the next
 * call — until it emits `done` or we hit `maxSteps`.
 */
export function runAgent(model: Model, tok: CharTokenizer, instruction: string, maxSteps = 4): AgentTrace {
  let ctx = `${instruction.trim()} => `
  const steps: AgentStep[] = []
  let done = false
  for (let s = 0; s < maxSteps; s++) {
    const seg = generateUntil(model, tok, ctx).trim()
    if (/done/i.test(seg)) {
      done = true
      break
    }
    const p = parseToolCall(seg)
    if ('error' in p) {
      steps.push({ call: null, error: p.error, result: null })
      break
    }
    let result: string
    try {
      result = TOOLS[p.tool](p.args)
    } catch {
      steps.push({ call: p, error: 'tool threw on those arguments', result: null })
      break
    }
    steps.push({ call: p, error: null, result })
    ctx += `${p.tool}(${p.args.join(' ')}) = ${result} => ` // authoritative observation fed back
  }
  const last = [...steps].reverse().find((st) => st.result != null)
  return { instruction, steps, done, finalAnswer: last?.result ?? null }
}

// ---- prompt injection (adversarial tool output) ----------------------------
// The loop above feeds the tool's result straight back into the context (line ~133)
// with NO boundary between "data" and "instructions". So an attacker who controls a
// tool's OUTPUT (a poisoned web page a search tool fetched, a doc a lookup returned)
// can plant text that the model reads as its next instruction. On this tiny model the
// hijack is real and reproducible: an observation like "max 1 1 1" makes the agent call
// max(1 1 1) instead of the planned step. Mitigation: treat tool output as untrusted,
// TYPED data — keep only the declared result type (here, digits), so it can't smuggle a
// tool keyword. (Verified offline against harness-model.json.)

/** The mitigation: reduce an observation to its declared type (the numbers a tool
 *  returns), stripping any prose/keywords an attacker planted in the tool output. */
export function sanitizeObservation(obs: string): string {
  return (obs.match(/\d+/g) || []).join(' ')
}

export interface InjectedStep {
  call: { tool: ToolName; args: number[] } | null
  error: string | null
  result: string | null // what the tool actually returned (authoritative)
  observation: string | null // what was fed back into context (attacker-controlled / sanitized)
  injected: boolean // was this step's observation replaced by the attacker payload?
}
export interface InjectedTrace {
  instruction: string
  steps: InjectedStep[]
  done: boolean
  finalAnswer: string | null
}

/**
 * The agent loop with an adversarial tool output injected at step `injectAt`. When
 * `sanitize` is on, every observation is reduced to its typed value before being fed
 * back — the "tool output is untrusted data, not instructions" defence.
 */
export function runAgentInjected(
  model: Model,
  tok: CharTokenizer,
  instruction: string,
  opts: { injectAt: number; payload: string; sanitize: boolean },
  maxSteps = 4,
): InjectedTrace {
  let ctx = `${instruction.trim()} => `
  const steps: InjectedStep[] = []
  let done = false
  for (let s = 0; s < maxSteps; s++) {
    const seg = generateUntil(model, tok, ctx).trim()
    if (/done/i.test(seg)) {
      done = true
      break
    }
    const p = parseToolCall(seg)
    if ('error' in p) {
      steps.push({ call: null, error: p.error, result: null, observation: null, injected: false })
      break
    }
    let result: string
    try {
      result = TOOLS[p.tool](p.args)
    } catch {
      steps.push({ call: p, error: 'tool threw on those arguments', result: null, observation: null, injected: false })
      break
    }
    const injected = s === opts.injectAt
    let observation = injected ? opts.payload : result
    if (opts.sanitize) observation = sanitizeObservation(observation)
    steps.push({ call: p, error: null, result, observation, injected })
    ctx += `${p.tool}(${p.args.join(' ')}) = ${observation} => ` // untrusted observation fed back
  }
  const last = [...steps].reverse().find((st) => st.result != null)
  return { instruction, steps, done, finalAnswer: last?.result ?? null }
}

/** Re-run parsing/dispatch on an arbitrary (possibly corrupted) model output — used
 *  by the "flaky model" demo to show the harness catching a malformed call. */
export function harnessDispatch(raw: string): Pick<HarnessTrace, 'parsed' | 'error' | 'toolResult' | 'modelGuess'> {
  const trimmed = raw.trim()
  const eq = trimmed.indexOf('=')
  const callText = eq >= 0 ? trimmed.slice(0, eq) : trimmed
  const modelGuess = eq >= 0 ? trimmed.slice(eq + 1).trim() || null : null
  const p = parseToolCall(callText)
  if ('error' in p) return { parsed: null, error: p.error, toolResult: null, modelGuess }
  try {
    return { parsed: p, error: null, toolResult: TOOLS[p.tool](p.args), modelGuess }
  } catch {
    return { parsed: p, error: 'tool threw on those arguments', toolResult: null, modelGuess }
  }
}
