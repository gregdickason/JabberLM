// A small seeded RNG so weight initialisation is reproducible — important both
// for teaching (re-run and get the same model) and for deterministic tests.

export class RNG {
  private state: number

  constructor(seed = 1337) {
    // ensure a non-zero 32-bit state
    this.state = (seed >>> 0) || 0x9e3779b9
  }

  /** mulberry32 — uniform in [0, 1). */
  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Standard normal via Box–Muller. */
  randn(): number {
    let u = 0
    let v = 0
    while (u === 0) u = this.next()
    while (v === 0) v = this.next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}
