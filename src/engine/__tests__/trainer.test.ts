import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { serialize, deserialize } from '../persist'
import { crossEntropy } from '../ops'
import { JABBERWOCKY } from '../../data/jabberwocky'
import { diffusionGenerate } from '../generate'
import {
  ANSWER_LEN, MASK_CHAR, buildDiffusionSortCorpus, sortDiffusionExample, sortDiffusionPrompt,
  sortTrainVecs, type SortVec,
} from '../../data/tasks'
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_SAMPLE_CONFIG,
  DEFAULT_TRAIN_CONFIG,
  type ModelConfig,
} from '../config'

// Mean next-char cross-entropy of a model on a text (forward only) — "how well does it
// still do this task". Used to show that fine-tuning on a new task raises the loss on the
// old one (forgetting), and that replay keeps it low.
function taskLoss(t: Trainer, text: string): number {
  const ids = t.tok.encode(text)
  const L = Math.min(t.cfg.contextLen, 24)
  let s = 0
  let n = 0
  for (let st = 0; st + L + 1 < ids.length && n < 8; st += L) {
    const w = ids.slice(st, st + L + 1)
    s += crossEntropy(t.model.forward(w.slice(0, L), DEFAULT_FEATURE_FLAGS).logits, w.slice(1, L + 1)).loss.data[0]
    n++
  }
  return n ? s / n : 0
}

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

  it('stepBatch trains with a head ablated (loss still falls — recovery routes around it)', () => {
    // knock out layer 0, head 0; the network must learn through the other components
    const trainer = new Trainer(JABBERWOCKY, cfg, 5)
    const ablate = new Set(['0.0'])
    const tcfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 8 }
    const first = trainer.stepBatch(tcfg, DEFAULT_FEATURE_FLAGS, ablate).loss
    let last = first
    for (let i = 0; i < 60; i++) last = trainer.stepBatch(tcfg, DEFAULT_FEATURE_FLAGS, ablate).loss
    expect(Number.isFinite(last)).toBe(true)
    expect(last).toBeLessThan(first) // it still learns, with the head permanently off
  }, 30000)

  it('distillStep trains a student toward a teacher (loss falls; needs shared vocab)', () => {
    // teacher and student share a corpus → shared vocabulary → aligned logit columns
    const teacher = new Trainer(JABBERWOCKY, cfg, 9)
    const tcfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 8 }
    for (let i = 0; i < 40; i++) teacher.stepBatch(tcfg, DEFAULT_FEATURE_FLAGS) // give the teacher some signal
    const student = new Trainer(JABBERWOCKY, { ...cfg, dModel: 16, dFF: 32 }, 2) // smaller student
    const first = student.distillStep(tcfg, DEFAULT_FEATURE_FLAGS, teacher.model, 2).loss
    let last = first
    for (let i = 0; i < 60; i++) last = student.distillStep(tcfg, DEFAULT_FEATURE_FLAGS, teacher.model, 2).loss
    expect(Number.isFinite(last)).toBe(true)
    expect(last).toBeLessThan(first) // the student learns to match the teacher
  }, 30000)

  it('ablating a head changes the forward pass', () => {
    const trainer = new Trainer(JABBERWOCKY, cfg, 3)
    const ids = trainer.tok.encode("'Twas bri")
    const plain = trainer.model.forward(ids, DEFAULT_FEATURE_FLAGS).logits.data
    const abl = trainer.model.forward(ids, DEFAULT_FEATURE_FLAGS, undefined, false, undefined, undefined, new Set(['0.0'])).logits.data
    let diff = 0
    for (let i = 0; i < plain.length; i++) diff += Math.abs(plain[i] - abl[i])
    expect(diff).toBeGreaterThan(0) // zeroing a head's output changes the logits
  })

  // Catastrophic forgetting: full fine-tuning on a NEW task erases an OLD one, but replay
  // (self-distilling the old task from a frozen snapshot) keeps both. Two patterns over one
  // shared alphabet so the vocab covers both (like sort vs tros on the digit vocab).
  it('sftStep forgets the old task; replayStep retains it', () => {
    const OLD = 'ab ab ac '.repeat(120) // old task pattern
    const NEW = 'ba ba ca '.repeat(120) // new task, same characters
    const tcfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 8, learningRate: 0.01 }
    const small: ModelConfig = { ...cfg, dModel: 16, dFF: 32 }

    // learn the OLD task, then snapshot it as the frozen teacher
    const base = new Trainer(OLD + NEW, small, 1) // vocab spans both
    const oldIds = base.tok.encode(OLD)
    const newIds = base.tok.encode(NEW)
    for (let i = 0; i < 120; i++) base.sftStep(tcfg, DEFAULT_FEATURE_FLAGS, oldIds)
    const oldLossStart = taskLoss(base, OLD)

    const snap = serialize(base, OLD + NEW) // keep the full vocab in the snapshot
    const sftT = deserialize(snap)
    const repT = deserialize(snap)
    const teacher = deserialize(snap).model // frozen original

    // both fine-tune on the NEW task from the same start
    for (let i = 0; i < 120; i++) {
      sftT.sftStep(tcfg, DEFAULT_FEATURE_FLAGS, newIds)
      repT.replayStep(tcfg, DEFAULT_FEATURE_FLAGS, { newIds, oldIds, teacher: teacher, lambda: 1, temperature: 2 })
    }

    const oldLossSft = taskLoss(sftT, OLD)
    const oldLossRep = taskLoss(repT, OLD)
    // plain SFT forgets the old task (its old-task loss rises well above where it started)
    expect(oldLossSft).toBeGreaterThan(oldLossStart + 0.1)
    // replay retains it far better than plain SFT
    expect(oldLossRep).toBeLessThan(oldLossSft)
    // and both still learn the new task (finite, trained loss)
    expect(Number.isFinite(taskLoss(repT, NEW))).toBe(true)
  }, 30000)
})

// Masked diffusion is a second TRAINING PARADIGM on the same engine, so the thing worth
// testing is that it is genuinely a different objective that genuinely learns — not that the
// numbers move (any loss falls), but that it produces a model the diffusion decoder can read,
// which a next-token-trained model cannot be. The paradigm's defining property is the one
// asserted last: the loss is computed at the SAME position as the input, not the next one.
describe('masked diffusion training', () => {
  const cfg: ModelConfig = {
    vocabSize: 0, dModel: 24, nHeads: 2, nLayers: 2, contextLen: 24, dFF: 48,
    activation: 'gelu', weightTying: true,
  }
  const flags = { ...DEFAULT_FEATURE_FLAGS, causalMask: false }
  const tcfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 16 }

  const batchOf = (t: Trainer, vecs: SortVec[]) =>
    vecs.map((v) => {
      const ex = sortDiffusionExample(v)
      return { ids: t.tok.encode(ex.line), answerStart: ex.answerStart }
    })

  it('drives the denoising loss down', () => {
    const t = new Trainer(buildDiffusionSortCorpus(12000), cfg, 5)
    const maskId = t.tok.encode(MASK_CHAR)[0]
    const vecs = sortTrainVecs()
    const first = t.diffusionStep(tcfg, flags, batchOf(t, vecs.slice(0, 16)), maskId).loss
    let last = first
    for (let i = 1; i < 60; i++) {
      last = t.diffusionStep(tcfg, flags, batchOf(t, vecs.slice((i * 16) % 400, ((i * 16) % 400) + 16)), maskId).loss
    }
    expect(first).toBeGreaterThan(0)
    expect(last).toBeLessThan(first)
  })

  it('learns the answer FORMAT — three digits separated by spaces — from denoising alone', () => {
    const t = new Trainer(buildDiffusionSortCorpus(12000), cfg, 5)
    const maskId = t.tok.encode(MASK_CHAR)[0]
    const vecs = sortTrainVecs()
    for (let i = 0; i < 200; i++) {
      t.diffusionStep(tcfg, flags, batchOf(t, vecs.slice((i * 16) % 400, ((i * 16) % 400) + 16)), maskId)
    }
    const out = diffusionGenerate(t.model, flags, t.tok, sortDiffusionPrompt([6, 9, 2]), ANSWER_LEN, maskId, ANSWER_LEN).text
    // Not asserting the answer is right — this is a 24-wide model after 200 steps. Asserting
    // it learned where the spaces go, which next-token training cannot have taught it here.
    expect(out).toMatch(/^\d \d \d$/)
  })

  it('supervises the masked position itself, not the one after it', () => {
    // A model trained only on diffusion should predict the CLEAN token AT a masked position.
    // Feed it a line with exactly one position masked and check the argmax there, which is
    // the assertion that would fail if the step had kept next-token prediction's target shift.
    const t = new Trainer(buildDiffusionSortCorpus(12000), cfg, 5)
    const maskId = t.tok.encode(MASK_CHAR)[0]
    const vecs = sortTrainVecs()
    for (let i = 0; i < 300; i++) {
      t.diffusionStep(tcfg, flags, batchOf(t, vecs.slice((i * 16) % 400, ((i * 16) % 400) + 16)), maskId)
    }
    // "sort 1 1 1 => 1 1 1" with the middle answer digit masked: the only consistent fill is 1.
    const ex = sortDiffusionExample([1, 1, 1])
    const ids = t.tok.encode(ex.line)
    const pos = ex.answerStart + 2
    ids[pos] = maskId
    const { logits } = t.model.forward(ids, flags)
    const v = logits.cols
    let best = 0
    for (let j = 1; j < v; j++) if (logits.data[pos * v + j] > logits.data[pos * v + best]) best = j
    expect(t.tok.decode([best])).toBe('1')
  })
})
