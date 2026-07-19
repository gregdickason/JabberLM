import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { generate, speculativeGenerate } from '../generate'
import { RNG } from '../random'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../config'

// Speculative decoding must be LOSSLESS under greedy: the draft only proposes, the target
// has the final say on every token, so the output is identical to running the target alone —
// no matter how good (or bad) the draft is. We use a different-sized, differently-seeded draft
// (so it disagrees often, exercising both the accept and the correct/reject paths).
describe('speculative decoding', () => {
  const text = 'the quick brown fox jumps over the lazy dog. '.repeat(40)
  const cfg: ModelConfig = { vocabSize: 0, dModel: 16, nHeads: 2, nLayers: 2, contextLen: 24, dFF: 32, activation: 'gelu', weightTying: true }
  const draftCfg: ModelConfig = { ...cfg, dModel: 8, dFF: 16 }
  const greedy = { temperature: 0, topK: null, topP: null, maxNewTokens: 12 }

  const target = new Trainer(text, cfg, 1)
  const draft = new Trainer(text, draftCfg, 2) // same corpus ⇒ same vocab; different size/seed
  const tcfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 8 }
  for (let i = 0; i < 40; i++) {
    target.stepBatch(tcfg, DEFAULT_FEATURE_FLAGS)
    draft.stepBatch(tcfg, DEFAULT_FEATURE_FLAGS)
  }

  it('greedy output is identical to running the target alone (every K)', () => {
    for (const prompt of ['the ', 'quick ', 'over the ']) {
      const base = generate(target.model, DEFAULT_FEATURE_FLAGS, target.tok, prompt, greedy, new RNG(1))
      for (const K of [1, 2, 3, 4]) {
        const spec = speculativeGenerate(draft.model, target.model, target.tok, prompt, DEFAULT_FEATURE_FLAGS, 12, K)
        expect(spec.text).toBe(base)
      }
    }
  })

  it('runs the expensive target fewer times than one-per-token (when the draft ever agrees)', () => {
    const spec = speculativeGenerate(draft.model, target.model, target.tok, 'the ', DEFAULT_FEATURE_FLAGS, 12, 4)
    expect(spec.tokens.length).toBeGreaterThan(0)
    // never MORE target passes than tokens (that's the whole point); each pass yields >= 1 token
    expect(spec.targetForwards).toBeLessThanOrEqual(spec.tokens.length)
    // every emitted token is tagged by how it was produced
    for (const t of spec.tokens) expect(['accepted', 'correction', 'bonus']).toContain(t.kind)
  })
})
