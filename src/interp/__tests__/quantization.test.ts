import { describe, it, expect } from 'vitest'
import { Model } from '../../engine/model'
import { DEFAULT_MODEL_CONFIG } from '../../engine/config'
import { quantiseMatrix, quantiseModel, modelBytes } from '../quantization'

// The accuracy-vs-bits curve on the real sort-model.json is validated offline (8-bit is
// ~lossless, 4-bit holds, 3-bit falls off a cliff). These tests lock the helper's maths.

describe('quantiseMatrix', () => {
  it('bits >= 32 is a no-op (full precision)', () => {
    const d = Float32Array.from([0.1, -0.37, 0.9, -0.02])
    const before = [...d]
    quantiseMatrix(d, 32)
    expect([...d]).toEqual(before)
  })

  it('stays within [−maxAbs, +maxAbs] and snaps to fewer distinct values as bits drop', () => {
    const orig = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 0.5)
    const maxAbs = Math.max(...orig.map(Math.abs))
    const distinct = (bits: number) => {
      const d = Float32Array.from(orig)
      quantiseMatrix(d, bits)
      expect(Math.max(...[...d].map(Math.abs))).toBeLessThanOrEqual(maxAbs + 1e-6)
      return new Set([...d].map((x) => x.toFixed(6))).size
    }
    // int8 has many levels; 2-bit (ternary) has at most 3 → strictly fewer distinct values
    expect(distinct(2)).toBeLessThanOrEqual(3)
    expect(distinct(4)).toBeLessThan(distinct(8))
  })

  it('rounding error shrinks as precision rises', () => {
    const orig = Array.from({ length: 300 }, (_, i) => Math.cos(i * 0.7) * 0.4)
    const rms = (bits: number) => {
      const d = Float32Array.from(orig)
      quantiseMatrix(d, bits)
      let s = 0
      for (let i = 0; i < d.length; i++) s += (d[i] - orig[i]) ** 2
      return Math.sqrt(s / d.length)
    }
    expect(rms(8)).toBeLessThan(rms(4))
    expect(rms(4)).toBeLessThan(rms(2))
  })
})

describe('quantiseModel / modelBytes', () => {
  const cfg = { ...DEFAULT_MODEL_CONFIG, dModel: 16, nHeads: 2, nLayers: 2, contextLen: 16, dFF: 32, vocabSize: 20 }

  it('quantises only weight matrices (rows > 1), leaving LN/bias vectors (rows === 1) untouched', () => {
    const m = new Model(cfg, 1)
    const vecsBefore = m.params.filter((p) => p.rows === 1).map((p) => [...p.data])
    quantiseModel(m, 4)
    const vecsAfter = m.params.filter((p) => p.rows === 1).map((p) => [...p.data])
    expect(vecsAfter).toEqual(vecsBefore) // LN gains/biases + b1/b2 unchanged
    // at least one weight matrix actually changed
    const changedMatrix = new Model(cfg, 1).params.some((p, i) => {
      if (p.rows === 1) return false
      return p.data.some((x, j) => x !== m.params[i].data[j])
    })
    expect(changedMatrix).toBe(true)
  })

  it('modelBytes decreases monotonically as bits drop, and equals params×4 at fp32', () => {
    const m = new Model(cfg, 1)
    const totalWeights = m.params.reduce((n, p) => n + p.size, 0)
    expect(modelBytes(m, 32)).toBeCloseTo(totalWeights * 4)
    expect(modelBytes(m, 8)).toBeLessThan(modelBytes(m, 32))
    expect(modelBytes(m, 4)).toBeLessThan(modelBytes(m, 8))
    expect(modelBytes(m, 2)).toBeLessThan(modelBytes(m, 4))
  })
})
