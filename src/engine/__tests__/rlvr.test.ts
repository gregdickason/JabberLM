import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../config'

// RLVR must improve the policy from a REWARD alone (no labels). A trivial verifiable task:
// after the prompt "a ", reward completions whose first character is "c". The model starts
// near-random over the tiny vocab; policy gradient should raise the fraction it gets right.
describe('rlvrStep (policy gradient from a verifier)', () => {
  const text = 'a b c d e a b c d e '.repeat(40) // vocab: a b c d e + space
  const cfg: ModelConfig = { vocabSize: 0, dModel: 12, nHeads: 2, nLayers: 1, contextLen: 8, dFF: 24, activation: 'gelu', weightTying: true }
  const reward = (_p: string, c: string) => (c.trim()[0] === 'c' ? 1 : 0)
  const opts = { prompts: ['a '], groupSize: 8, temperature: 1, maxNew: 1, reward, promptsPerStep: 1 }
  const rcfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 1, learningRate: 0.05 }

  it('raises mean reward from the reward signal alone', () => {
    const t = new Trainer(text, cfg, 1)
    const meanOver = (from: number, to: number) => {
      let s = 0
      let n = 0
      for (let i = from; i < to; i++) {
        s += t.rlvrStep(rcfg, DEFAULT_FEATURE_FLAGS, opts).meanReward
        n++
      }
      return s / n
    }
    const before = meanOver(0, 15)
    for (let i = 0; i < 60; i++) t.rlvrStep(rcfg, DEFAULT_FEATURE_FLAGS, opts) // train
    const after = meanOver(0, 15)
    expect(after).toBeGreaterThan(before + 0.1) // learned to emit "c" more from reward alone
  })

  it('returns one sample per completion with rewards, and skips a uniform group (no signal)', () => {
    const t = new Trainer(text, cfg, 2)
    const r = t.rlvrStep(rcfg, DEFAULT_FEATURE_FLAGS, opts)
    expect(r.samples.length).toBe(8) // groupSize × promptsPerStep
    expect(r.meanReward).toBeGreaterThanOrEqual(0)
    expect(r.meanReward).toBeLessThanOrEqual(1)
    // a reward that's identical for every sample gives zero advantage → no update this step
    const uniform = t.rlvrStep(rcfg, DEFAULT_FEATURE_FLAGS, { ...opts, reward: () => 1 })
    expect(uniform.loss).toBe(0)
  })
})
