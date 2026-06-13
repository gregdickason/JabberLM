import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { makeCheckpoint, restoreCheckpoint, type RunState } from '../checkpoint'
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

describe('checkpoint', () => {
  it('round-trips model weights and run progress to identical logits', () => {
    const text = 'the slithy toves did gyre'
    const a = new Trainer(text, cfg, 5)
    for (let i = 0; i < 20; i++) a.stepBatch(DEFAULT_TRAIN_CONFIG, DEFAULT_FEATURE_FLAGS)

    const run: RunState = {
      step: 20,
      lossHistory: [
        { step: 0, loss: 3.1 },
        { step: 20, loss: 2.2 },
      ],
      valHistory: [{ step: 0, loss: 3.2 }],
    }
    const cp = makeCheckpoint(a, text, run, 1234)
    const { trainer: b, run: run2 } = restoreCheckpoint(cp)

    // weights restored → identical logits
    const ids = a.tok.encode('the slithy')
    const la = a.model.forward(ids, DEFAULT_FEATURE_FLAGS).logits
    const lb = b.model.forward(ids, DEFAULT_FEATURE_FLAGS).logits
    expect(lb.rows).toBe(la.rows)
    for (let i = 0; i < la.size; i++) expect(lb.data[i]).toBeCloseTo(la.data[i], 5)

    // run progress preserved
    expect(run2.step).toBe(20)
    expect(run2.lossHistory).toEqual(run.lossHistory)
    expect(run2.valHistory).toEqual(run.valHistory)
  })

  it('rejects an unsupported checkpoint version', () => {
    const cp = makeCheckpoint(new Trainer('abc', cfg, 1), 'abc', {
      step: 0,
      lossHistory: [],
      valHistory: [],
    }, 0)
    cp.version = 999
    expect(() => restoreCheckpoint(cp)).toThrow()
  })
})
