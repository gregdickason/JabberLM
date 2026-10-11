import { describe, it, expect } from 'vitest'
import {
  descendingSortLine, buildDescendingSortCorpus, sortHeldOut,
  buildDiffusionSortCorpus, sortDiffusionExample, sortDiffusionPrompt, MASK_CHAR, ANSWER_LEN,
  type SortVec,
} from '../tasks'
import { CharTokenizer } from '../../engine/tokenizer'

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

// The masked-diffusion corpus is a DECODING experiment on the existing sort task, so the two
// things that matter are that it stays comparable to the autoregressive arm (same split, same
// line format) and that the mask character actually reaches the tokenizer's vocabulary — the
// diffusion step has no id to corrupt with otherwise, and would train on nothing.
describe('masked-diffusion sort corpus', () => {
  it('puts the mask character in the vocabulary, and nowhere near the answers', () => {
    const corpus = buildDiffusionSortCorpus()
    expect(corpus).toContain(MASK_CHAR)
    expect(new CharTokenizer(corpus).encode(MASK_CHAR)).toHaveLength(1)
    // The mask char appears only on the header line, never inside a task line.
    const taskLines = corpus.split('\n').filter((l) => l.includes(' => '))
    expect(taskLines.length).toBeGreaterThan(100)
    expect(taskLines.some((l) => l.includes(MASK_CHAR))).toBe(false)
  })

  it('shares the ascending split, so sortHeldOut stays disjoint', () => {
    const corpus = buildDiffusionSortCorpus()
    const heldPrompts = new Set(sortHeldOut().map((v) => `sort ${v.join(' ')} =>`))
    const leaked = corpus
      .split('\n')
      .filter((l) => l.includes(' => '))
      .filter((l) => heldPrompts.has(l.split(' => ')[0] + ' =>'))
    expect(leaked).toHaveLength(0)
  })

  it('is deterministic', () => {
    expect(buildDiffusionSortCorpus(5000)).toBe(buildDiffusionSortCorpus(5000))
  })

  it('locates the answer region exactly, and the prompt is its complement', () => {
    for (const v of [[6, 9, 2], [1, 1, 1], [9, 9, 9], [4, 4, 8]] as SortVec[]) {
      const { line, answerStart } = sortDiffusionExample(v)
      expect(line.length - answerStart).toBe(ANSWER_LEN)
      expect(line.slice(0, answerStart)).toBe(sortDiffusionPrompt(v))
      expect(line.slice(answerStart)).toBe([...v].sort((a, b) => a - b).join(' '))
    }
  })
})
