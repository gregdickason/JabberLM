import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { JABBERWOCKY } from '../../data/jabberwocky'
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_SAMPLE_CONFIG,
  DEFAULT_TRAIN_CONFIG,
  type ModelConfig,
} from '../config'

const cfg: ModelConfig = {
  vocabSize: 0, // Trainer fills this from the tokenizer
  dModel: 32,
  nHeads: 2,
  nLayers: 2,
  contextLen: 32,
  dFF: 64,
  activation: 'gelu',
  weightTying: true,
}

describe('Trainer (integration)', () => {
  it('drives loss down on Jabberwocky and can sample', () => {
    const trainer = new Trainer(JABBERWOCKY, cfg, 11)
    const trainCfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 8 }

    const first = trainer.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS).loss
    let last = first
    for (let i = 0; i < 120; i++) {
      last = trainer.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS).loss
    }
    expect(last).toBeLessThan(first * 0.7)

    const sample = trainer.sample(DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, "'", 40)
    expect(sample.length).toBe(40)
  }, 30000)

  it('evalValidation returns a finite held-out loss when a split is set', () => {
    const trainer = new Trainer(JABBERWOCKY, cfg, 7)
    expect(trainer.evalValidation(DEFAULT_FEATURE_FLAGS, 0)).toBeNull() // off
    const v = trainer.evalValidation(DEFAULT_FEATURE_FLAGS, 0.3)
    expect(v).not.toBeNull()
    expect(Number.isFinite(v!)).toBe(true)
    expect(v!).toBeGreaterThan(0)
  })

  it('evalValidation works when the held-out region is shorter than the context', () => {
    // ~60 chars, context 48, 20% held out → val region (~12 chars) < context, but
    // a shorter validation window must still fit and return a finite loss.
    const text = 'abcdefghij klmnopqrst uvwxyz 0123456789 the quick brown fox!'
    const trainer = new Trainer(text, { ...cfg, contextLen: 48 }, 2)
    const v = trainer.evalValidation(DEFAULT_FEATURE_FLAGS, 0.2)
    expect(v).not.toBeNull()
    expect(Number.isFinite(v!)).toBe(true)
  })

  it('evalValidation returns null when the val region is too small for a window', () => {
    // contextLen 32 over a ~25-char text leaves no room for a held-out window
    const shortCfg = { ...cfg, contextLen: 32 }
    const trainer = new Trainer('the slithy toves gyred', shortCfg, 1)
    expect(trainer.evalValidation(DEFAULT_FEATURE_FLAGS, 0.2)).toBeNull()
  })

  it('held-out is sampled across the whole corpus, not just the tail', () => {
    // three clearly-separated sections; a representative split must draw held-out
    // from more than just the final section.
    const section = (ch: string) => (ch + ' ').repeat(400)
    const text = section('a') + section('b') + section('c') // ~2400 chars, 3 regions
    const trainer = new Trainer(text, { ...cfg, contextLen: 16 }, 3)
    const regions = trainer.heldOutRegions(0.2)
    const len = text.length
    expect(regions.length).toBeGreaterThanOrEqual(2) // multiple held-out blocks, not one tail
    // spread: at least one block starts in the first half and one ends in the second half
    expect(regions.some(([s]) => s < len * 0.4)).toBe(true)
    expect(regions.some(([, e]) => e > len * 0.6)).toBe(true)
    // held-out blocks are ordered and non-overlapping (no leakage between them)
    for (let i = 1; i < regions.length; i++) expect(regions[i][0]).toBeGreaterThanOrEqual(regions[i - 1][1])
    // total held-out is roughly the requested fraction
    const held = regions.reduce((n, [s, e]) => n + (e - s), 0)
    expect(held / len).toBeGreaterThan(0.1)
    expect(held / len).toBeLessThan(0.35)
  })

  it('tiny corpora fall back to a single tail held-out block', () => {
    const trainer = new Trainer('abcdefghij klmnopqrst uvwxyz 0123456789 the quick brown fox!', { ...cfg, contextLen: 16 }, 4)
    const regions = trainer.heldOutRegions(0.2)
    expect(regions.length).toBe(1) // too small to interleave → one tail block
  })
})
