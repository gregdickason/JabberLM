import { describe, it, expect } from 'vitest'
import { SAE } from '../sae'
import { RNG } from '../../engine/random'

describe('sparse autoencoder', () => {
  it('reduces reconstruction error on synthetic sparse data', () => {
    const rng = new RNG(123)
    const dAct = 16
    const K = 10 // ground-truth dictionary size
    const N = 256

    // a random ground-truth dictionary of unit directions
    const D: number[][] = Array.from({ length: K }, () => {
      const v = Array.from({ length: dAct }, () => rng.randn())
      const n = Math.hypot(...v) || 1
      return v.map((x) => x / n)
    })

    // each sample is a sparse positive combination of 2 dictionary atoms
    const acts = new Float32Array(N * dAct)
    for (let r = 0; r < N; r++) {
      for (let pick = 0; pick < 2; pick++) {
        const k = Math.floor(rng.next() * K)
        const coeff = 0.5 + rng.next()
        for (let i = 0; i < dAct; i++) acts[r * dAct + i] += coeff * D[k][i]
      }
    }

    const sae = new SAE({ dAct, nFeatures: 64, l1: 0.001, lr: 0.01 }, 7)
    const first = sae.trainStep(acts, N, 32).mse
    let last = first
    for (let s = 0; s < 300; s++) last = sae.trainStep(acts, N, 32).mse

    expect(last).toBeLessThan(first * 0.5)
    expect(Number.isFinite(last)).toBe(true)
  }, 20000)
})
