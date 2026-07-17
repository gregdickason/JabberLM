import { describe, it, expect } from 'vitest'
import { descendingSortLine, buildDescendingSortCorpus, sortHeldOut } from '../tasks'

// The descending-sort corpus is the LoRA demo's fine-tune target. It must (a) actually
// sort high→low with the SAME prompt as ascending, and (b) reuse the ascending train/
// held-out split so `sortHeldOut()` stays disjoint (no leakage into the eval).
describe('descending sort helpers', () => {
  it('descendingSortLine keeps the prompt and sorts high→low', () => {
    expect(descendingSortLine([6, 9, 2])).toBe('sort 6 9 2 => 9 6 2')
    expect(descendingSortLine([4, 4, 8])).toBe('sort 4 4 8 => 8 4 4')
    expect(descendingSortLine([1, 1, 1])).toBe('sort 1 1 1 => 1 1 1')
  })

  it('the corpus never contains a held-out vector (same split as ascending)', () => {
    const corpus = buildDescendingSortCorpus()
    const heldPrompts = new Set(sortHeldOut().map((v) => `sort ${v.join(' ')} =>`))
    const leaked = corpus
      .split('\n')
      .filter((l) => l.includes(' => '))
      .filter((l) => heldPrompts.has(l.split(' => ')[0] + ' =>'))
    expect(leaked).toHaveLength(0)
    expect(corpus.length).toBeGreaterThan(1000)
  })
})
