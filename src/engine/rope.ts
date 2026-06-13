import { Tensor } from './tensor'

// Rotary Position Embedding. Dimensions are paired up (2i, 2i+1) and each pair is
// rotated by an angle proportional to the token's position and a per-pair
// frequency. Relative position then falls out of the dot product Q·K. The
// rotation is linear, so it's cleanly differentiable.

/** Per-pair angular frequencies θ_i = base^(−2i/d), length headDim/2. */
export function ropeFreqs(headDim: number, base: number): number[] {
  const half = Math.floor(headDim / 2)
  const freqs = new Array(half)
  for (let i = 0; i < half; i++) freqs[i] = Math.pow(base, (-2 * i) / headDim)
  return freqs
}

/**
 * Rotate each row of x (seq×headDim) by its position's RoPE angles.
 * positions[i] is the absolute position of row i (supports KV-cache offsets).
 */
export function applyRope(x: Tensor, positions: number[], base: number): Tensor {
  const d = x.cols
  const half = Math.floor(d / 2)
  const freqs = ropeFreqs(d, base)
  const data = new Float32Array(x.size)
  // cache cos/sin per (row, pair) for the backward pass
  const cosT = new Float32Array(x.rows * half)
  const sinT = new Float32Array(x.rows * half)
  for (let r = 0; r < x.rows; r++) {
    for (let i = 0; i < half; i++) {
      const angle = positions[r] * freqs[i]
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      cosT[r * half + i] = cos
      sinT[r * half + i] = sin
      const x0 = x.data[r * d + 2 * i]
      const x1 = x.data[r * d + 2 * i + 1]
      data[r * d + 2 * i] = x0 * cos - x1 * sin
      data[r * d + 2 * i + 1] = x0 * sin + x1 * cos
    }
    // odd tail dimension (if headDim is odd) passes through unchanged
    if (d % 2 === 1) data[r * d + (d - 1)] = x.data[r * d + (d - 1)]
  }
  const c = new Tensor(data, x.rows, d, 'rope')
  c._prev = [x]
  c._backward = () => {
    for (let r = 0; r < x.rows; r++) {
      for (let i = 0; i < half; i++) {
        const cos = cosT[r * half + i]
        const sin = sinT[r * half + i]
        const g0 = c.grad[r * d + 2 * i]
        const g1 = c.grad[r * d + 2 * i + 1]
        // inverse rotation of the upstream gradient
        x.grad[r * d + 2 * i] += g0 * cos + g1 * sin
        x.grad[r * d + 2 * i + 1] += -g0 * sin + g1 * cos
      }
      if (d % 2 === 1) x.grad[r * d + (d - 1)] += c.grad[r * d + (d - 1)]
    }
  }
  return c
}
