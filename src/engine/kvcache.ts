// KV-cache accounting for the inference visualization. During autoregressive
// generation, the keys and values for all earlier positions don't change — so a
// cache lets each step compute K/V for only the single new token instead of the
// whole context. The numeric result is identical; what changes is the work done.
//
// This helper computes the compute-saved figures the KVCacheView displays. We
// keep it as pure bookkeeping so it stays correct regardless of how attention is
// implemented internally.

export interface KVCacheStats {
  /** Sequence length at the current step. */
  contextLen: number
  /** K/V rows computed this step WITH the cache (always 1: just the new token). */
  computedThisStepCached: number
  /** K/V rows that would be (re)computed this step WITHOUT a cache. */
  computedThisStepUncached: number
  /** Cumulative K/V row computations across all steps so far, with cache. */
  cumulativeCached: number
  /** Cumulative K/V row computations across all steps so far, without cache. */
  cumulativeUncached: number
}

/**
 * Given how many tokens have been generated from a starting prompt of length
 * `promptLen`, compute the cache accounting. `generatedSteps` is the number of
 * tokens produced so far (each one is one generation step).
 */
export function kvCacheStats(promptLen: number, generatedSteps: number): KVCacheStats {
  const contextLen = promptLen + generatedSteps
  // With a cache: prompt is encoded once (promptLen rows), then 1 row per step.
  const cumulativeCached = promptLen + generatedSteps
  // Without a cache: every step re-encodes the whole current context.
  let cumulativeUncached = 0
  for (let s = 0; s < generatedSteps; s++) cumulativeUncached += promptLen + s + 1
  return {
    contextLen,
    computedThisStepCached: 1,
    computedThisStepUncached: contextLen,
    cumulativeCached,
    cumulativeUncached,
  }
}
