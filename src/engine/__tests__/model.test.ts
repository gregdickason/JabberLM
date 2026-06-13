import { describe, it, expect } from 'vitest'
import { Model } from '../model'
import { crossEntropy } from '../ops'
import { CharTokenizer } from '../tokenizer'
import { DEFAULT_FEATURE_FLAGS, type ModelConfig, type FeatureFlags } from '../config'

function tinyConfig(vocab: number): ModelConfig {
  return {
    vocabSize: vocab,
    dModel: 16,
    nHeads: 2,
    nLayers: 2,
    contextLen: 16,
    dFF: 32,
    activation: 'gelu',
    weightTying: true,
  }
}

describe('Model', () => {
  it('produces correct logits shape and a full trace', () => {
    const cfg = tinyConfig(10)
    const model = new Model(cfg, 1)
    const ids = [1, 2, 3, 4]
    const { logits, trace } = model.forward(ids, DEFAULT_FEATURE_FLAGS, undefined, true)
    expect(logits.rows).toBe(4)
    expect(logits.cols).toBe(10)
    expect(trace!.layers.length).toBe(2)
    expect(trace!.layers[0].heads.length).toBe(2)
    expect(trace!.probs.rows).toBe(4)
  })

  it('propagates gradients to parameters', () => {
    const cfg = tinyConfig(10)
    const model = new Model(cfg, 2)
    for (const p of model.params) p.zeroGrad()
    const { logits } = model.forward([1, 2, 3], DEFAULT_FEATURE_FLAGS)
    const { loss } = crossEntropy(logits, [2, 3, 4])
    loss.backward()
    const anyGrad = model.params.some((p) => Array.from(p.grad).some((g) => g !== 0))
    expect(anyGrad).toBe(true)
  })

  function overfitDrops(flags: FeatureFlags): { first: number; last: number } {
    const text = 'the slithy toves'
    const tok = new CharTokenizer(text)
    const cfg = tinyConfig(tok.vocabSize)
    cfg.contextLen = text.length
    const model = new Model(cfg, 3)
    const ids = tok.encode(text)
    const inputs = ids.slice(0, -1)
    const targets = ids.slice(1)

    const lr = 0.05
    let first = 0
    let last = 0
    for (let step = 0; step < 80; step++) {
      for (const p of model.params) p.zeroGrad()
      const { logits } = model.forward(inputs, flags)
      const { loss } = crossEntropy(logits, targets)
      loss.backward()
      for (const p of model.params)
        for (let i = 0; i < p.size; i++) p.data[i] -= lr * p.grad[i]
      if (step === 0) first = loss.data[0]
      last = loss.data[0]
    }
    return { first, last }
  }

  it('overfits a short string with learned positions (loss drops sharply)', () => {
    const { first, last } = overfitDrops(DEFAULT_FEATURE_FLAGS)
    expect(last).toBeLessThan(first * 0.5)
  })

  it('overfits with RoPE positions too', () => {
    const { first, last } = overfitDrops({ ...DEFAULT_FEATURE_FLAGS, positional: 'rope' })
    expect(last).toBeLessThan(first * 0.5)
  })
})
