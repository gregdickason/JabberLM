import { describe, it, expect } from 'vitest'
import { Trainer } from '../trainer'
import { serialize, deserialize } from '../persist'
import { JABBERWOCKY } from '../../data/jabberwocky'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../config'

const cfg: ModelConfig = {
  vocabSize: 0,
  dModel: 32,
  nHeads: 2,
  nLayers: 2,
  contextLen: 24,
  dFF: 64,
  activation: 'gelu',
  weightTying: true,
}

// A tiny, distinctive fine-tune target (uses only base-vocabulary chars).
const TARGET = ('the snark came snorfling through the wood, the snark, the snark! ').repeat(8)

const snapshotBase = (t: Trainer) => t.model.params.map((p) => Float32Array.from(p.data))
const logitsOf = (t: Trainer, lora: boolean) =>
  Array.from(t.model.forward(t.tok.encode("'Twas brillig").slice(0, 12), { ...DEFAULT_FEATURE_FLAGS, lora }).logits.data)

describe('LoRA fine-tuning', () => {
  it('freezes the base, starts at ΔW=0, drives loss down, and trains only adapters', () => {
    const trainer = new Trainer(JABBERWOCKY, cfg, 5)
    const baseBefore = snapshotBase(trainer)

    trainer.startFineTune({ rank: 4, alpha: 8, targets: ['attn'], text: TARGET, seed: 1 })

    // trainable << total, and trainable equals the adapter param count
    const { trainable, total } = trainer.paramCounts()
    const adapterCount = trainer.model.loraParams.reduce((n, p) => n + p.size, 0)
    expect(trainable).toBe(adapterCount)
    expect(trainable).toBeLessThan(total * 0.25)

    // every B adapter starts at exactly zero ⇒ ΔW = A·B = 0
    for (const p of trainer.model.loraParams) {
      if (p.label.endsWith('.B')) expect(p.data.every((x) => x === 0)).toBe(true)
    }
    // with ΔW=0 the overlay is a no-op: lora on/off give identical logits
    expect(logitsOf(trainer, true)).toEqual(logitsOf(trainer, false))

    const trainCfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 8 }
    const first = trainer.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS).loss
    let last = first
    for (let i = 0; i < 80; i++) last = trainer.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS).loss
    expect(last).toBeLessThan(first) // adapters learned the target

    // base weights are byte-identical — only the adapters moved
    const baseAfter = snapshotBase(trainer)
    for (let i = 0; i < baseBefore.length; i++) {
      expect(Array.from(baseAfter[i])).toEqual(Array.from(baseBefore[i]))
    }
    // now the overlay actually changes the output
    expect(logitsOf(trainer, true)).not.toEqual(logitsOf(trainer, false))
  }, 30000)

  it('round-trips base + adapters through serialize/deserialize', () => {
    const trainer = new Trainer(JABBERWOCKY, cfg, 9)
    trainer.startFineTune({ rank: 4, alpha: 8, targets: ['attn', 'mlp'], text: TARGET, seed: 2 })
    const trainCfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 8 }
    for (let i = 0; i < 20; i++) trainer.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS)

    const saved = serialize(trainer, JABBERWOCKY)
    expect(saved.lora).toBeDefined()
    expect(saved.lora!.targets).toEqual(['attn', 'mlp'])

    const restored = deserialize(saved)
    expect(restored.model.loraConfig).not.toBeNull()
    expect(restored.fineTuning).toBe(true) // resumable (text was saved)
    // adapted logits match the original after a round-trip
    expect(logitsOf(restored, true)).toEqual(logitsOf(trainer, true))
  }, 30000)

  it('stopFineTune unfreezes the base and removes adapters', () => {
    const trainer = new Trainer(JABBERWOCKY, cfg, 3)
    trainer.startFineTune({ rank: 4, alpha: 8, targets: ['attn'], text: TARGET })
    expect(trainer.fineTuning).toBe(true)
    expect(trainer.model.params.every((p) => p.requiresGrad)).toBe(false)

    trainer.stopFineTune()
    expect(trainer.fineTuning).toBe(false)
    expect(trainer.model.loraConfig).toBeNull()
    expect(trainer.model.loraParams.length).toBe(0)
    expect(trainer.model.params.every((p) => p.requiresGrad)).toBe(true)
  })
})
