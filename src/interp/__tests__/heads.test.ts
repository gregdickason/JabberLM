import { describe, it, expect } from 'vitest'
import { inductionTargets } from '../heads'

describe('induction targets', () => {
  it('finds positions whose predecessor equals the current token', () => {
    // window A B A B  (ids 0 1 0 1)
    const w = [0, 1, 0, 1]
    // query i=3 (token 1): predecessor==1 at window[1] → j=2
    expect(inductionTargets(w, 3)).toEqual([2])
    // query i=2 (token 0): predecessor==0 at window[0] → j=1
    expect(inductionTargets(w, 2)).toEqual([1])
    // query i=1 (token 1): no earlier token has predecessor 1
    expect(inductionTargets(w, 1)).toEqual([])
  })

  it('handles repeated runs', () => {
    // a a a -> for i=2 (token a), predecessors a at j=1 and j=2
    expect(inductionTargets([0, 0, 0], 2)).toEqual([1, 2])
  })
})
