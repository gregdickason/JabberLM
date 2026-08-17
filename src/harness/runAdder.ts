import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import {
  addOracle, colPrompt, columnsOf, parseColumn, parseTrace, sumPrompt, type ColumnResult,
} from '../data/addition'

// The REASONING-LOOP harness. Contrast it with `runAgent` in runHarness.ts:
//
//   runAgent   the context GROWS — the model sees the whole history, and the harness
//              feeds back a TOOL's authoritative answer.
//   runAdder   the context is CONSTANT — a fresh `add d d c => ` prompt per column, and
//              the harness feeds back the MODEL's OWN answer (its carry) as state.
//
// That is context management: the harness holds the history so the model never has to.
// It is why arbitrarily long sums work on a model with a fixed, tiny context window.
//
// INVARIANT — THE HARNESS MAY REMEMBER AND ROUTE, BUT MUST NEVER COMPUTE.
// Every arithmetic fact below comes from the model. This file does no addition: it slices
// digit characters, formats a prompt, and pushes the model's replies into an array. If it
// did the sums itself there would be no model in the demo — the same rule CLAUDE.md states
// for tic-tac-toe ("we do NOT put game intelligence in the harness"). `runAdderWith` takes
// the column solver as a parameter precisely so a test can prove this by injecting a wrong
// one and checking the answer goes wrong with it.

export interface AdderStep {
  col: number // 0 = least significant
  a: number
  b: number
  carryIn: number
  prompt: string
  raw: string // exactly what the model emitted
  digit: number | null
  carryOut: number | null
  ok: boolean
}

export interface AdderTrace {
  a: string
  b: string
  steps: AdderStep[]
  answer: string
  expected: string
  correct: boolean
  maxPromptChars: number // stays constant however long the sum — the whole point
}

/** Anything that can answer one column. The model is one; a stub in a test is another. */
export type ColumnSolver = (a: number, b: number, cin: number) => string

/** Greedy generation to a newline (or `maxNew` chars) — same shape as runHarness.ts. */
function generateLine(model: Model, tok: CharTokenizer, prompt: string, maxNew = 6): string {
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
 * The loop, over any column solver. Right to left: format a fixed-size prompt, ask, parse,
 * keep the digit, carry the carry. No arithmetic happens here — `String(carry)` merely
 * echoes back the value the solver returned.
 */
export function runAdderWith(solve: ColumnSolver, a: string, b: string): AdderTrace {
  const steps: AdderStep[] = []
  const digits: string[] = []
  let carry = 0
  let maxPromptChars = 0

  columnsOf(a, b).forEach(([da, db], col) => {
    const prompt = colPrompt(da, db, carry)
    maxPromptChars = Math.max(maxPromptChars, prompt.length)
    const raw = solve(da, db, carry)
    const parsed = parseColumn(raw)
    steps.push({
      col, a: da, b: db, carryIn: carry, prompt, raw,
      digit: parsed ? parsed.digit : null,
      carryOut: parsed ? parsed.carry : null,
      ok: parsed !== null,
    })
    // an unparseable reply is recorded, not papered over — the column is simply lost
    digits.push(parsed ? String(parsed.digit) : '?')
    carry = parsed ? parsed.carry : 0
  })

  if (carry) digits.push(String(carry)) // echo the model's final carry; not a computation
  const answer = digits.reverse().join('').replace(/^0+(?=[\d?])/, '')
  const expected = addOracle(a, b)
  return { a, b, steps, answer, expected, correct: answer === expected, maxPromptChars }
}

/** The harness loop driven by the model — one forward pass per column. */
export function runAdder(model: Model, tok: CharTokenizer, a: string, b: string): AdderTrace {
  return runAdderWith((da, db, cin) => generateLine(model, tok, colPrompt(da, db, cin)), a, b)
}

// ---- the two contrast modes, on the same weights ----------------------------

export interface DirectResult {
  raw: string
  answer: string
  expected: string
  correct: boolean
}

/** SINGLE PASS: ask for the whole sum outright. Trained only up to 4 digits, so this is
 *  where long sums fall apart — the contrast the demo turns on. */
export function runSinglePass(model: Model, tok: CharTokenizer, a: string, b: string): DirectResult {
  const raw = generateLine(model, tok, sumPrompt(a, b), Math.max(a.length, b.length) + 4)
  const answer = (raw.trim().match(/^\d+/) ?? [''])[0]
  const expected = addOracle(a, b)
  return { raw, answer, expected, correct: answer === expected }
}

export interface SelfTraceResult extends DirectResult {
  steps: ColumnResult[]
}

/** REASONING LOOP, model-managed: the model writes its own working, then the answer. The
 *  whole problem plus the working must fit in the context — which is the limit the harness
 *  form removes. */
export function runSelfTrace(model: Model, tok: CharTokenizer, a: string, b: string): SelfTraceResult {
  const cols = columnsOf(a, b).length
  const raw = generateLine(model, tok, sumPrompt(a, b), cols * 12 + 12)
  const { steps, answer } = parseTrace(raw)
  const expected = addOracle(a, b)
  return { raw, steps, answer: answer ?? '', expected, correct: (answer ?? '') === expected }
}
