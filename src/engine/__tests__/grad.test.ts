import { describe, it, expect } from 'vitest'
import { Tensor } from '../tensor'
import {
  matmul,
  add,
  addRow,
  scale,
  transpose,
  rowSoftmax,
  layerNorm,
  gelu,
  relu,
  embeddingLookup,
  crossEntropy,
  sum,
} from '../ops'
import { applyRope } from '../rope'
import { RNG } from '../random'

interface Spec {
  rows: number
  cols: number
  data: number[]
}

/**
 * Central-difference gradient check. `build` constructs the input tensors from
 * raw arrays and returns them plus a scalar output. We compare each input's
 * analytic gradient against a finite-difference estimate.
 */
function checkGrad(
  specs: Spec[],
  build: (inputs: Tensor[]) => Tensor,
  eps = 1e-2,
  tol = 3e-2,
) {
  const makeInputs = (datas: number[][]) =>
    datas.map((d, i) => Tensor.from(d, specs[i].rows, specs[i].cols, `in${i}`))

  const datas = specs.map((s) => s.data.slice())

  // analytic
  const inputs = makeInputs(datas)
  const outA = build(inputs)
  expect(outA.size).toBe(1) // forward must reduce to a scalar
  for (const t of inputs) t.zeroGrad()
  outA.backward()
  const analytic = inputs.map((t) => Array.from(t.grad))

  // numeric
  for (let t = 0; t < specs.length; t++) {
    for (let k = 0; k < datas[t].length; k++) {
      const orig = datas[t][k]
      datas[t][k] = orig + eps
      const plus = build(makeInputs(datas)).data[0]
      datas[t][k] = orig - eps
      const minus = build(makeInputs(datas)).data[0]
      datas[t][k] = orig
      const num = (plus - minus) / (2 * eps)
      const ana = analytic[t][k]
      const diff = Math.abs(num - ana)
      const rel = diff / (Math.abs(num) + Math.abs(ana) + 1e-6)
      expect(
        diff < tol || rel < tol,
        `input ${t}[${k}]: analytic=${ana.toFixed(4)} numeric=${num.toFixed(4)}`,
      ).toBe(true)
    }
  }
}

const rng = new RNG(7)
const rand = (n: number) => Array.from({ length: n }, () => rng.randn())

describe('autograd gradient checks', () => {
  it('matmul', () => {
    checkGrad([{ rows: 2, cols: 3, data: rand(6) }, { rows: 3, cols: 2, data: rand(6) }], (i) =>
      sum(matmul(i[0], i[1])),
    )
  })

  it('add', () => {
    checkGrad([{ rows: 2, cols: 3, data: rand(6) }, { rows: 2, cols: 3, data: rand(6) }], (i) =>
      sum(add(i[0], i[1])),
    )
  })

  it('addRow (bias broadcast)', () => {
    checkGrad([{ rows: 3, cols: 4, data: rand(12) }, { rows: 1, cols: 4, data: rand(4) }], (i) =>
      sum(addRow(i[0], i[1])),
    )
  })

  it('scale', () => {
    checkGrad([{ rows: 2, cols: 3, data: rand(6) }], (i) => sum(scale(i[0], 2.5)))
  })

  it('transpose', () => {
    checkGrad([{ rows: 2, cols: 3, data: rand(6) }], (i) => sum(matmul(transpose(i[0]), i[0])))
  })

  it('rowSoftmax', () => {
    // multiply by varied weights so the gradient isn't trivially uniform
    checkGrad([{ rows: 2, cols: 4, data: rand(8) }], (i) => {
      const s = rowSoftmax(i[0])
      const w = Tensor.from([0.1, 0.7, -0.4, 0.3, 0.9, -0.2, 0.5, -0.8], 2, 4)
      return sum(add(s, w)) // sum(softmax + w); grad flows through softmax
    })
  })

  it('rowSoftmax (weighted by matmul)', () => {
    checkGrad([{ rows: 2, cols: 3, data: rand(6) }, { rows: 3, cols: 1, data: rand(3) }], (i) =>
      sum(matmul(rowSoftmax(i[0]), i[1])),
    )
  })

  it('layerNorm', () => {
    checkGrad(
      [
        { rows: 3, cols: 4, data: rand(12) },
        { rows: 1, cols: 4, data: rand(4) },
        { rows: 1, cols: 4, data: rand(4) },
      ],
      (i) => sum(layerNorm(i[0], i[1], i[2])),
    )
  })

  it('gelu', () => {
    checkGrad([{ rows: 2, cols: 3, data: rand(6) }], (i) => sum(gelu(i[0])))
  })

  it('relu', () => {
    // avoid kinks at exactly 0 by offsetting away from origin
    checkGrad([{ rows: 2, cols: 3, data: rand(6).map((x) => x + 0.5) }], (i) => sum(relu(i[0])))
  })

  it('embeddingLookup', () => {
    checkGrad([{ rows: 4, cols: 3, data: rand(12) }], (i) =>
      sum(embeddingLookup(i[0], [0, 2, 2, 3])),
    )
  })

  it('crossEntropy', () => {
    checkGrad([{ rows: 3, cols: 5, data: rand(15) }], (i) => crossEntropy(i[0], [1, 4, 0]).loss)
  })

  it('applyRope', () => {
    checkGrad([{ rows: 3, cols: 4, data: rand(12) }], (i) =>
      sum(applyRope(i[0], [0, 1, 2], 10000)),
    )
  })

  it('composite: tiny attention chain', () => {
    // x→Q, x→K, scores=QKᵀ/√d, softmax, ·V — exercises the whole attention path
    const d = 4
    checkGrad(
      [
        { rows: 3, cols: d, data: rand(3 * d) }, // x
        { rows: d, cols: d, data: rand(d * d) }, // Wq
        { rows: d, cols: d, data: rand(d * d) }, // Wk
        { rows: d, cols: d, data: rand(d * d) }, // Wv
      ],
      (i) => {
        const q = matmul(i[0], i[1])
        const k = matmul(i[0], i[2])
        const v = matmul(i[0], i[3])
        const scores = scale(matmul(q, transpose(k)), 1 / Math.sqrt(d))
        const attn = rowSoftmax(scores)
        return sum(matmul(attn, v))
      },
    )
  })
})
