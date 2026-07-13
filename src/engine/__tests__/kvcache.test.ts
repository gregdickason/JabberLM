import { describe, it, expect } from 'vitest'
import { kvCacheStats } from '../kvcache'

// The KV-cache cost model backs the "inference economics" demo: with a cache the
// work is linear (prefill the prompt once, then 1/step); without it, every step
// re-encodes the whole growing context — quadratic — so savings grow with length.
describe('kvCacheStats', () => {
  it('cached work is linear in prompt + steps', () => {
    expect(kvCacheStats(2000, 200).cumulativeCached).toBe(2200)
    expect(kvCacheStats(0, 10).cumulativeCached).toBe(10)
  })

  it('uncached work is quadratic (re-encodes the whole context each step)', () => {
    // prompt 0, N steps → 1+2+…+N = N(N+1)/2
    expect(kvCacheStats(0, 10).cumulativeUncached).toBe(55)
    // per-step, without a cache, you recompute the full current context
    expect(kvCacheStats(100, 5).computedThisStepUncached).toBe(105)
    expect(kvCacheStats(100, 5).computedThisStepCached).toBe(1)
  })

  it('savings grow with output length', () => {
    const saved = (p: number, n: number) => {
      const s = kvCacheStats(p, n)
      return 1 - s.cumulativeCached / s.cumulativeUncached
    }
    expect(saved(2000, 500)).toBeGreaterThan(saved(2000, 50))
    expect(saved(2000, 500)).toBeGreaterThan(0)
    expect(saved(2000, 500)).toBeLessThan(1)
  })
})
