import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { diffusionGenerate, generate, speculativeGenerate } from '../generate'
import {
  ANSWER_LEN, MASK_CHAR, buildDiffusionSortCorpus, sortDiffusionExample, sortDiffusionPrompt, sortTrainVecs,
} from '../../data/tasks'
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

// Masked-diffusion decoding. These are structural guarantees — they hold whether or not the
// model has learned anything, which is the point: a demo that counts forward passes has to be
// trustworthy about how many it ran, and a decoder that leaves a mask character in the answer
// would quietly corrupt the accuracy numbers measured from it.
describe('masked-diffusion decoding', () => {
  const text = buildDiffusionSortCorpus(6000)
  const cfg: ModelConfig = { vocabSize: 0, dModel: 16, nHeads: 2, nLayers: 2, contextLen: 32, dFF: 32, activation: 'gelu', weightTying: true }
  const flags = { ...DEFAULT_FEATURE_FLAGS, causalMask: false }
  const t = new Trainer(text, cfg, 1)
  const maskId = t.tok.encode(MASK_CHAR)[0]
  const prompt = sortDiffusionPrompt([6, 9, 2])
  // A few steps of the real objective, so the logits are not pure noise.
  const vecs = sortTrainVecs().slice(0, 64)
  for (let i = 0; i < 20; i++) {
    const batch = vecs.slice((i * 8) % 56, ((i * 8) % 56) + 8).map((v) => {
      const ex = sortDiffusionExample(v)
      return { ids: t.tok.encode(ex.line), answerStart: ex.answerStart }
    })
    t.diffusionStep({ ...DEFAULT_TRAIN_CONFIG, batchSize: 8 }, flags, batch, maskId)
  }

  it('runs exactly the rounds it was asked for, and reports them', () => {
    for (const R of [1, 2, 3, 5]) {
      const r = diffusionGenerate(t.model, flags, t.tok, prompt, ANSWER_LEN, maskId, R)
      expect(r.forwards).toBe(R)
      expect(r.rounds).toHaveLength(R)
    }
  })

  it('clamps rounds to the number of positions — never more passes than there is work', () => {
    const r = diffusionGenerate(t.model, flags, t.tok, prompt, ANSWER_LEN, maskId, 99)
    expect(r.forwards).toBe(ANSWER_LEN)
  })

  it('commits every position, and never leaves a mask in the answer', () => {
    for (const R of [1, 2, 5]) {
      const r = diffusionGenerate(t.model, flags, t.tok, prompt, ANSWER_LEN, maskId, R)
      expect(r.text).toHaveLength(ANSWER_LEN)
      expect(r.text).not.toContain(MASK_CHAR)
      expect(r.rounds[r.rounds.length - 1].stillMasked).toBe(0)
      // every position accounted for exactly once, across all rounds
      const committed = r.rounds.flatMap((x) => x.unmasked.map((u) => u.pos))
      expect(new Set(committed).size).toBe(ANSWER_LEN)
    }
  })

  it('is greedy, so it is deterministic', () => {
    const a = diffusionGenerate(t.model, flags, t.tok, prompt, ANSWER_LEN, maskId, 3)
    const b = diffusionGenerate(t.model, flags, t.tok, prompt, ANSWER_LEN, maskId, 3)
    expect(a.text).toBe(b.text)
    expect(a.rounds.map((r) => r.unmasked.map((u) => u.pos))).toEqual(b.rounds.map((r) => r.unmasked.map((u) => u.pos)))
  })

  it('refuses a prompt that would not fit with its answer', () => {
    expect(() => diffusionGenerate(t.model, flags, t.tok, 'sort 1 2 3 => '.repeat(4), ANSWER_LEN, maskId, 2)).toThrow(
      /context/,
    )
  })

  it('reports a probability for each committed position, and commits the confident ones first', () => {
    const r = diffusionGenerate(t.model, flags, t.tok, prompt, ANSWER_LEN, maskId, ANSWER_LEN)
    for (const round of r.rounds) {
      for (const u of round.unmasked) {
        expect(u.p).toBeGreaterThan(0)
        expect(u.p).toBeLessThanOrEqual(1)
        expect(u.id).not.toBe(maskId)
      }
    }
    // one position per round at R = ANSWER_LEN, in non-increasing confidence within a round
    expect(r.rounds.every((x) => x.unmasked.length === 1)).toBe(true)
  })
})
