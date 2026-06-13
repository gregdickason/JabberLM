import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { serialize, deserialize } from '../persist'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../config'

const cfg: ModelConfig = {
  vocabSize: 0,
  dModel: 16,
  nHeads: 2,
  nLayers: 2,
  contextLen: 16,
  dFF: 32,
  activation: 'gelu',
  weightTying: true,
}

describe('persistence', () => {
  it('round-trips a trained model to identical logits', () => {
    const text = 'the slithy toves did gyre'
    const a = new Trainer(text, cfg, 5)
    for (let i = 0; i < 20; i++) a.stepBatch(DEFAULT_TRAIN_CONFIG, DEFAULT_FEATURE_FLAGS)

    const saved = serialize(a, text)
    const b = deserialize(saved)

    const ids = a.tok.encode('the slithy')
    const la = a.model.forward(ids, DEFAULT_FEATURE_FLAGS).logits
    const lb = b.model.forward(ids, DEFAULT_FEATURE_FLAGS).logits

    expect(lb.rows).toBe(la.rows)
    expect(lb.cols).toBe(la.cols)
    for (let i = 0; i < la.size; i++) expect(lb.data[i]).toBeCloseTo(la.data[i], 5)
  })

  it('rejects a mismatched config', () => {
    const saved = serialize(new Trainer('abc', cfg, 1), 'abc')
    saved.config = { ...saved.config, dModel: 32 }
    expect(() => deserialize(saved)).toThrow()
  })
})
