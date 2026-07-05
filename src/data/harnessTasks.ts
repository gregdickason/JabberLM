// Deterministic, pure, browser-shippable data for the "tool use & harness" demo.
// This is the SINGLE SOURCE OF TRUTH for both the training corpus and the runtime
// harness: the model is trained to emit `<tool>(a b c) = <result>` calls, and the
// harness parses exactly that and runs the same `TOOLS` registry — so the training
// format and the parser can never drift apart.
//
// The teaching point: the tiny model only has to recognise the intent and copy the
// arguments into a call — much easier than doing the task itself. Deterministic JS
// tools then do the actual work reliably (in particular, `sum` is always correct,
// even though the model can't do arithmetic — the harness fixes the hallucination).

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ToolName = 'sort' | 'max' | 'reverse' | 'sum'

/** The tools the harness can run — pure JS, deterministic, always correct. */
export const TOOLS: Record<ToolName, (nums: number[]) => string> = {
  sort: (n) => [...n].sort((a, b) => a - b).join(' '),
  max: (n) => String(Math.max(...n)),
  reverse: (n) => [...n].reverse().join(' '),
  sum: (n) => String(n.reduce((a, b) => a + b, 0)),
}
export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[]

// Varied natural phrasings per tool — several DON'T name the tool, so the model has
// to learn to ROUTE intent → tool, not just echo a keyword. The last phrasing of
// each tool is held out (a phrasing the model never trains on) to test routing.
const PHRASINGS: Record<ToolName, string[]> = {
  sort: ['put {n} in order', 'sort {n}', 'order {n} low to high', 'arrange {n}'],
  max: ['biggest of {n}', 'largest of {n}', 'max {n}', 'which is biggest {n}'],
  reverse: ['reverse {n}', 'flip {n}', 'reverse the list {n}', '{n} backwards'],
  sum: ['add up {n}', 'total of {n}', 'sum {n}', 'add {n} together'],
}
// The model is trained on ALL of a tool's phrasings (a tiny char model routes
// reliably on phrasings it has seen, but does NOT generalise to genuinely novel
// wording — an honest limitation the demo can show live). Numbers are held out.
export const phrasingsFor = (t: ToolName): string[] => PHRASINGS[t]

export type Vec = number[] // three digits 1..9

function allVecs(rnd: () => number): Vec[] {
  const v: Vec[] = []
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) v.push([a, b, c])
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[v[i], v[j]] = [v[j], v[i]]
  }
  return v
}
function split(): { train: Vec[]; test: Vec[] } {
  const v = allVecs(mulberry32(70707))
  const n = Math.floor(v.length * 0.2)
  return { test: v.slice(0, n), train: v.slice(n) }
}
export const harnessTrainVecs = (): Vec[] => split().train
export const harnessHeldOut = (): Vec[] => split().test

/** The tool-call the model should emit for a tool + numbers, with its result. */
export const callLine = (tool: ToolName, v: Vec): string => `${tool}(${v.join(' ')}) = ${TOOLS[tool](v)}`
/** A full training line: instruction => call = result. */
export const instructionLine = (phrasing: string, tool: ToolName, v: Vec): string =>
  `${phrasing.replace('{n}', v.join(' '))} => ${callLine(tool, v)}`
/** The instruction stem the harness/UI feeds the model (up to and including `=> `). */
export const instructionStem = (phrasing: string, v: Vec): string => `${phrasing.replace('{n}', v.join(' '))} => `

/** The tool-use corpus: instruction → call → result, interleaved over the 4 tools,
 *  drawn only from the train phrasings + train numbers. */
export function buildHarnessCorpus(targetCharsPerTool = 15000): string {
  const rnd = mulberry32(31337)
  const { train } = split()
  const pickVec = () => train[Math.floor(rnd() * train.length)]
  const lines: string[] = []
  const chars: Record<ToolName, number> = { sort: 0, max: 0, reverse: 0, sum: 0 }
  let done = false
  while (!done) {
    done = true
    for (const tool of TOOL_NAMES) {
      if (chars[tool] < targetCharsPerTool) {
        const phr = phrasingsFor(tool)[Math.floor(rnd() * phrasingsFor(tool).length)]
        const l = instructionLine(phr, tool, pickVec())
        lines.push(l)
        chars[tool] += l.length + 1
        done = false
      }
    }
  }
  return lines.join('\n') + '\n'
}

/** Parse a model-emitted call `tool(a b c)` → {tool, args}. Used by the runtime
 *  harness; returns an error (not a throw) for malformed/unknown calls so the
 *  harness can show robustness. */
export type ParsedCall = { tool: ToolName; args: number[] } | { error: string }
export function parseToolCall(text: string): ParsedCall {
  const m = text.match(/([a-z]+)\s*\(\s*([\d\s]*?)\s*\)/i)
  if (!m) return { error: 'no tool call found' }
  const name = m[1].toLowerCase()
  if (!(TOOL_NAMES as string[]).includes(name)) return { error: `unknown tool "${m[1]}"` }
  const args = m[2].split(/\s+/).filter(Boolean).map(Number)
  if (args.length === 0 || args.some((n) => !Number.isFinite(n))) return { error: 'bad arguments' }
  return { tool: name as ToolName, args }
}

/** Example instructions for the UI — curated to phrasings the tiny model routes
 *  reliably (a mix of tools, including two arithmetic ones to show the calc fix). */
export const TOOL_EXAMPLES: string[] = [
  'put 6 9 2 in order',
  'biggest of 4 1 7',
  'reverse 3 8 5',
  'total of 8 7 9',
  'add 5 8 4 together',
]
