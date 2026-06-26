import { describe, it, expect } from 'vitest'
import { pca2 } from '../pca'

describe('pca2 (top-2 principal components)', () => {
  it('collapses collinear points onto PC1 (PC2 ≈ 0) and preserves order', () => {
    // 5 points on a line in 6-D: base + i*dir
    const dir = [1, -2, 0.5, 3, -1, 2]
    const base = [0.3, 1, -0.4, 0.2, 5, -2]
    const pts = Array.from({ length: 5 }, (_, i) => base.map((b, j) => b + i * dir[j]))
    const coords = pca2(pts)
    // PC2 should be ~0 (all variance is along the line)
    for (const [, y] of coords) expect(Math.abs(y)).toBeLessThan(1e-3)
    // PC1 must be strictly monotonic in i (order preserved, up to sign)
    const xs = coords.map((c) => c[0])
    const inc = xs.every((x, i) => i === 0 || x > xs[i - 1])
    const dec = xs.every((x, i) => i === 0 || x < xs[i - 1])
    expect(inc || dec).toBe(true)
  })

  it('is deterministic (same input → same output)', () => {
    const pts = [
      [1, 2, 3],
      [4, 0, -1],
      [-2, 5, 1],
      [0, 0, 0],
    ]
    expect(pca2(pts)).toEqual(pca2(pts))
  })

  it('recovers two axes of a 2-D grid embedded in higher-D', () => {
    // grid varies most along axis A, less along axis B → PC1 tracks A, PC2 tracks B
    const A = [2, 0, 0, 1, 0]
    const B = [0, 1, 0, 0, 0.5]
    const pts: number[][] = []
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) pts.push(A.map((av, j) => av * a + B[j] * b))
    const coords = pca2(pts)
    expect(coords.length).toBe(9)
    // spread along PC1 should exceed spread along PC2 (A has larger magnitude)
    const span = (k: number) => Math.max(...coords.map((c) => c[k])) - Math.min(...coords.map((c) => c[k]))
    expect(span(0)).toBeGreaterThan(span(1))
  })
})
