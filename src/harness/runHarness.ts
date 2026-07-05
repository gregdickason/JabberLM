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
