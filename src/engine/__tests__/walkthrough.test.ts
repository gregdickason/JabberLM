import { describe, it, expect } from 'vitest'
import { Model } from '../model'
import { CharTokenizer } from '../tokenizer'
import { buildWalkSteps } from '../walkthrough'
import { DEFAULT_FEATURE_FLAGS, type ModelConfig } from '../config'

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

describe('walkthrough', () => {
  it('produces forward and backward steps with real (non-zero) gradients', () => {
    const text = 'the slithy toves'
    const tok = new CharTokenizer(text)
    const model = new Model({ ...cfg, vocabSize: tok.vocabSize }, 3)
    const ids = tok.encode('slithy')
    const steps = buildWalkSteps(model, tok, ids.slice(0, -1), ids.slice(1), DEFAULT_FEATURE_FLAGS, 0.01, 'adamw')

    expect(steps.length).toBeGreaterThan(8)
    expect(steps.some((s) => s.phase === 'forward')).toBe(true)
    expect(steps.some((s) => s.phase === 'backward')).toBe(true)

    // a backward gradient matrix must contain non-zero values (backprop ran)
    const gradStep = steps.find((s) => s.phase === 'backward' && s.matrices?.length)
    expect(gradStep).toBeDefined()
    const anyNonZero = gradStep!.matrices!.some((m) =>
      Array.from(m.matrix.data).some((v) => v !== 0),
    )
    expect(anyNonZero).toBe(true)

    // the loss step is present and finite
    const lossStep = steps.find((s) => s.kind === 'scalar')
    expect(lossStep?.scalar && Number.isFinite(lossStep.scalar.value)).toBe(true)

    // the final update step shows before → gradient → after (the weight actually changing)
    const update = steps.find((s) => s.matrices?.some((m) => m.label.includes('after')))
    expect(update?.matrices?.length).toBe(3)
    const before = update!.matrices![0].matrix.data
    const after = update!.matrices![2].matrix.data
    // after = before − lr·grad, so with non-zero grads at least one cell must differ
    expect(Array.from(before).some((v, i) => v !== after[i])).toBe(true)
  })
})
