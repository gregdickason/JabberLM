// Max-activating dataset examples: the positions where a unit (a neuron or, later,
// an SAE feature) fires hardest, with the surrounding text for context. This is
// how interpretability researchers read what a unit "detects".

export interface ActExample {
  pos: number
  value: number
}

/** Top-k positions of a per-position activation column (descending). */
export function topKPositions(col: Float32Array, k: number): ActExample[] {
  const idx = Array.from({ length: col.length }, (_, i) => i)
  idx.sort((a, b) => col[b] - col[a])
  return idx.slice(0, k).map((pos) => ({ pos, value: col[pos] }))
}

export interface Context {
  before: string // chars leading up to (and excluding) the activating char
  charLabel: string // the activating char itself
}

/** The `radius` characters before a position, plus the activating char. */
export function contextAround(
  ids: number[],
  label: (id: number) => string,
  pos: number,
  radius = 16,
): Context {
  let before = ''
  for (let i = Math.max(0, pos - radius); i < pos; i++) before += label(ids[i])
  return { before, charLabel: label(ids[pos]) }
}
