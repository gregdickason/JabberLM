// Shared auto-pause helper for the lab's live-training sections. Each section feeds its
// held-out "did it learn" checkpoint(s) into a ConvergenceGate as they're evaluated; once
// the metric has clearly settled the section auto-pauses (and keeps the good frame on
// screen) instead of running forever — a converged run wastes CPU, and naïve policy
// gradient / SFT can walk *away* from the peak if left going.
//
// The gate is held in a ref (the rAF training loops read stale React state), and supports
// the two convergence shapes the sections need:
//   - 'threshold' (default): the last `window` checkpoints of EVERY gate curve are all ≥ a
//     bar (e.g. sort accuracy ≥ 90%). Multi-curve gates require all keys to have converged.
//   - 'plateau': the last `window` checkpoints are within `epsilon` of each other — for a
//     metric that legitimately settles BELOW the bar (e.g. partial injury recovery).

export type ConvergenceOpts = {
  window?: number // how many recent checkpoints must satisfy the rule (default 5)
  mode?: 'threshold' | 'plateau' // default 'threshold'
  threshold?: number // 'threshold' mode: the bar every recent point must clear (default 90)
  epsilon?: number // 'plateau' mode: max spread across the recent window (default 3)
}

export class ConvergenceGate {
  private series = new Map<string, number[]>()
  constructor(private opts: ConvergenceOpts = {}) {}

  /** Record a fresh checkpoint value for a named gate curve. */
  record(key: string, y: number) {
    const a = this.series.get(key) ?? []
    a.push(y)
    this.series.set(key, a)
  }

  /** Forget all history (call from the section's reset()). */
  reset() {
    this.series.clear()
  }

  /** True once every recorded gate curve has converged under the configured rule. */
  converged(): boolean {
    const w = this.opts.window ?? 5
    const arrs = [...this.series.values()]
    if (!arrs.length) return false
    return arrs.every((a) => {
      if (a.length < w) return false
      const last = a.slice(-w)
      if (this.opts.mode === 'plateau') {
        return Math.max(...last) - Math.min(...last) <= (this.opts.epsilon ?? 3)
      }
      return last.every((v) => v >= (this.opts.threshold ?? 90))
    })
  }
}
