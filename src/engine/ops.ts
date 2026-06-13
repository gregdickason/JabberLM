import { Tensor } from './tensor'

// Differentiable operations. Each builds an output Tensor, records its inputs as
// tape edges (`_prev`), and installs a `_backward` closure that accumulates (+=)
// gradient into those inputs' `.grad`. Shapes are checked eagerly so mistakes
// surface as readable errors rather than silent NaNs.

function out(data: Float32Array, rows: number, cols: number, prev: Tensor[], label: string): Tensor {
  const t = new Tensor(data, rows, cols, label)
  t._prev = prev
  return t
}

/** C = A (m×k) · B (k×n) */
export function matmul(a: Tensor, b: Tensor): Tensor {
  if (a.cols !== b.rows) throw new Error(`matmul: ${a.rows}x${a.cols} · ${b.rows}x${b.cols}`)
  const m = a.rows
  const k = a.cols
  const n = b.cols
  const data = new Float32Array(m * n)
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      const aip = a.data[i * k + p]
      if (aip === 0) continue
      for (let j = 0; j < n; j++) data[i * n + j] += aip * b.data[p * n + j]
    }
  }
  const c = out(data, m, n, [a, b], 'matmul')
  c._backward = () => {
    // dA += dC · Bᵀ ; dB += Aᵀ · dC
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const g = c.grad[i * n + j]
        if (g === 0) continue
        for (let p = 0; p < k; p++) {
          a.grad[i * k + p] += g * b.data[p * n + j]
          b.grad[p * n + j] += g * a.data[i * k + p]
        }
      }
    }
  }
  return c
}

/** Elementwise add of two equal-shaped tensors. */
export function add(a: Tensor, b: Tensor): Tensor {
  if (a.rows !== b.rows || a.cols !== b.cols) throw new Error('add: shape mismatch')
  const data = new Float32Array(a.size)
  for (let i = 0; i < a.size; i++) data[i] = a.data[i] + b.data[i]
  const c = out(data, a.rows, a.cols, [a, b], 'add')
  c._backward = () => {
    for (let i = 0; i < a.size; i++) {
      a.grad[i] += c.grad[i]
      b.grad[i] += c.grad[i]
    }
  }
  return c
}

/** Add a row-vector bias (1×n) broadcast across all m rows of x (m×n). */
export function addRow(x: Tensor, bias: Tensor): Tensor {
  if (bias.rows !== 1 || bias.cols !== x.cols) throw new Error('addRow: bias must be 1×cols')
  const data = new Float32Array(x.size)
  for (let i = 0; i < x.rows; i++)
    for (let j = 0; j < x.cols; j++) data[i * x.cols + j] = x.data[i * x.cols + j] + bias.data[j]
  const c = out(data, x.rows, x.cols, [x, bias], 'addRow')
  c._backward = () => {
    for (let i = 0; i < x.rows; i++)
      for (let j = 0; j < x.cols; j++) {
        const g = c.grad[i * x.cols + j]
        x.grad[i * x.cols + j] += g
        bias.grad[j] += g
      }
  }
  return c
}

/** Multiply by a scalar constant. */
export function scale(a: Tensor, s: number): Tensor {
  const data = new Float32Array(a.size)
  for (let i = 0; i < a.size; i++) data[i] = a.data[i] * s
  const c = out(data, a.rows, a.cols, [a], 'scale')
  c._backward = () => {
    for (let i = 0; i < a.size; i++) a.grad[i] += c.grad[i] * s
  }
  return c
}

/** Matrix transpose (m×n) → (n×m). */
export function transpose(a: Tensor): Tensor {
  const data = new Float32Array(a.size)
  for (let i = 0; i < a.rows; i++)
    for (let j = 0; j < a.cols; j++) data[j * a.rows + i] = a.data[i * a.cols + j]
  const c = out(data, a.cols, a.rows, [a], 'transpose')
  c._backward = () => {
    for (let i = 0; i < a.rows; i++)
      for (let j = 0; j < a.cols; j++) a.grad[i * a.cols + j] += c.grad[j * a.rows + i]
  }
  return c
}

/** Add a constant mask matrix (same shape, not tracked). Used for attention masks. */
export function addMaskConst(a: Tensor, mask: Float32Array): Tensor {
  if (mask.length !== a.size) throw new Error('addMaskConst: mask shape mismatch')
  const data = new Float32Array(a.size)
  for (let i = 0; i < a.size; i++) data[i] = a.data[i] + mask[i]
  const c = out(data, a.rows, a.cols, [a], 'mask')
  c._backward = () => {
    for (let i = 0; i < a.size; i++) a.grad[i] += c.grad[i]
  }
  return c
}

/** Row-wise softmax (numerically stable). */
export function rowSoftmax(a: Tensor): Tensor {
  const data = new Float32Array(a.size)
  const n = a.cols
  for (let i = 0; i < a.rows; i++) {
    let max = -Infinity
    for (let j = 0; j < n; j++) max = Math.max(max, a.data[i * n + j])
    let sum = 0
    for (let j = 0; j < n; j++) {
      const e = Math.exp(a.data[i * n + j] - max)
      data[i * n + j] = e
      sum += e
    }
    for (let j = 0; j < n; j++) data[i * n + j] /= sum
  }
  const c = out(data, a.rows, n, [a], 'softmax')
  c._backward = () => {
    for (let i = 0; i < a.rows; i++) {
      // dx_j = s_j * (dy_j - Σ_k dy_k s_k)
      let dot = 0
      for (let j = 0; j < n; j++) dot += c.grad[i * n + j] * data[i * n + j]
      for (let j = 0; j < n; j++)
        a.grad[i * n + j] += data[i * n + j] * (c.grad[i * n + j] - dot)
    }
  }
  return c
}

/** Row-wise LayerNorm with learned gamma/beta (each 1×n). */
export function layerNorm(x: Tensor, gamma: Tensor, beta: Tensor, eps = 1e-5): Tensor {
  const n = x.cols
  const data = new Float32Array(x.size)
  const xhat = new Float32Array(x.size)
  const invStd = new Float32Array(x.rows)
  for (let i = 0; i < x.rows; i++) {
    let mean = 0
    for (let j = 0; j < n; j++) mean += x.data[i * n + j]
    mean /= n
    let varr = 0
    for (let j = 0; j < n; j++) {
      const d = x.data[i * n + j] - mean
      varr += d * d
    }
    varr /= n
    const is = 1 / Math.sqrt(varr + eps)
    invStd[i] = is
    for (let j = 0; j < n; j++) {
      const xh = (x.data[i * n + j] - mean) * is
      xhat[i * n + j] = xh
      data[i * n + j] = xh * gamma.data[j] + beta.data[j]
    }
  }
  const c = out(data, x.rows, n, [x, gamma, beta], 'layerNorm')
  c._backward = () => {
    for (let i = 0; i < x.rows; i++) {
      const is = invStd[i]
      let sumDxhat = 0
      let sumDxhatXhat = 0
      for (let j = 0; j < n; j++) {
        const dout = c.grad[i * n + j]
        const dxhat = dout * gamma.data[j]
        sumDxhat += dxhat
        sumDxhatXhat += dxhat * xhat[i * n + j]
        gamma.grad[j] += dout * xhat[i * n + j]
        beta.grad[j] += dout
      }
      for (let j = 0; j < n; j++) {
        const dxhat = c.grad[i * n + j] * gamma.data[j]
        x.grad[i * n + j] += (is / n) * (n * dxhat - sumDxhat - xhat[i * n + j] * sumDxhatXhat)
      }
    }
  }
  return c
}

/** GELU (sigmoid approximation: x·σ(1.702x)). Clean derivative, good for teaching. */
export function gelu(a: Tensor): Tensor {
  const data = new Float32Array(a.size)
  const sig = new Float32Array(a.size)
  for (let i = 0; i < a.size; i++) {
    const s = 1 / (1 + Math.exp(-1.702 * a.data[i]))
    sig[i] = s
    data[i] = a.data[i] * s
  }
  const c = out(data, a.rows, a.cols, [a], 'gelu')
  c._backward = () => {
    for (let i = 0; i < a.size; i++) {
      const s = sig[i]
      // d/dx [x·σ(1.702x)] = σ + x·1.702·σ(1−σ)
      a.grad[i] += c.grad[i] * (s + a.data[i] * 1.702 * s * (1 - s))
    }
  }
  return c
}

/** ReLU. */
export function relu(a: Tensor): Tensor {
  const data = new Float32Array(a.size)
  for (let i = 0; i < a.size; i++) data[i] = a.data[i] > 0 ? a.data[i] : 0
  const c = out(data, a.rows, a.cols, [a], 'relu')
  c._backward = () => {
    for (let i = 0; i < a.size; i++) if (a.data[i] > 0) a.grad[i] += c.grad[i]
  }
  return c
}

/** Take a contiguous block of columns [start, start+count) → (rows×count). */
export function sliceCols(x: Tensor, start: number, count: number): Tensor {
  if (start < 0 || start + count > x.cols) throw new Error('sliceCols: out of range')
  const data = new Float32Array(x.rows * count)
  for (let i = 0; i < x.rows; i++)
    for (let j = 0; j < count; j++) data[i * count + j] = x.data[i * x.cols + (start + j)]
  const c = out(data, x.rows, count, [x], 'sliceCols')
  c._backward = () => {
    for (let i = 0; i < x.rows; i++)
      for (let j = 0; j < count; j++) x.grad[i * x.cols + (start + j)] += c.grad[i * count + j]
  }
  return c
}

/** Concatenate tensors column-wise (all must share row count). */
export function concatCols(parts: Tensor[]): Tensor {
  const rows = parts[0].rows
  let totalCols = 0
  for (const p of parts) {
    if (p.rows !== rows) throw new Error('concatCols: row mismatch')
    totalCols += p.cols
  }
  const data = new Float32Array(rows * totalCols)
  let colOffset = 0
  for (const p of parts) {
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < p.cols; j++) data[i * totalCols + (colOffset + j)] = p.data[i * p.cols + j]
    colOffset += p.cols
  }
  const c = out(data, rows, totalCols, parts, 'concatCols')
  c._backward = () => {
    let off = 0
    for (const p of parts) {
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < p.cols; j++) p.grad[i * p.cols + j] += c.grad[i * totalCols + (off + j)]
      off += p.cols
    }
  }
  return c
}

/** Gather rows of an embedding table (vocab×d) by token ids → (seq×d). */
export function embeddingLookup(table: Tensor, ids: number[]): Tensor {
  const d = table.cols
  const data = new Float32Array(ids.length * d)
  for (let i = 0; i < ids.length; i++) {
    const base = ids[i] * d
    for (let j = 0; j < d; j++) data[i * d + j] = table.data[base + j]
  }
  const c = out(data, ids.length, d, [table], 'embedding')
  c._backward = () => {
    for (let i = 0; i < ids.length; i++) {
      const base = ids[i] * d
      for (let j = 0; j < d; j++) table.grad[base + j] += c.grad[i * d + j]
    }
  }
  return c
}

/** Sum all elements → scalar (1×1). Handy for reductions and gradient checks. */
export function sum(a: Tensor): Tensor {
  let s = 0
  for (let i = 0; i < a.size; i++) s += a.data[i]
  const c = out(Float32Array.from([s]), 1, 1, [a], 'sum')
  c._backward = () => {
    for (let i = 0; i < a.size; i++) a.grad[i] += c.grad[0]
  }
  return c
}

export interface CrossEntropyResult {
  loss: Tensor // scalar (1×1)
  probs: Float32Array // (seq×vocab) softmax — handy for inspection
}

/**
 * Mean cross-entropy of next-token prediction over a sequence.
 * logits: (seq×vocab), targets: token id per position.
 */
export function crossEntropy(logits: Tensor, targets: number[]): CrossEntropyResult {
  const seq = logits.rows
  const vocab = logits.cols
  if (targets.length !== seq) throw new Error('crossEntropy: targets length != seq')
  const probs = new Float32Array(seq * vocab)
  let loss = 0
  for (let i = 0; i < seq; i++) {
    let max = -Infinity
    for (let j = 0; j < vocab; j++) max = Math.max(max, logits.data[i * vocab + j])
    let sumE = 0
    for (let j = 0; j < vocab; j++) {
      const e = Math.exp(logits.data[i * vocab + j] - max)
      probs[i * vocab + j] = e
      sumE += e
    }
    for (let j = 0; j < vocab; j++) probs[i * vocab + j] /= sumE
    loss += -Math.log(probs[i * vocab + targets[i]] + 1e-12)
  }
  loss /= seq
  const c = out(Float32Array.from([loss]), 1, 1, [logits], 'crossEntropy')
  c._backward = () => {
    const g = c.grad[0] / seq
    for (let i = 0; i < seq; i++) {
      for (let j = 0; j < vocab; j++) {
        const t = targets[i] === j ? 1 : 0
        logits.grad[i * vocab + j] += g * (probs[i * vocab + j] - t)
      }
    }
  }
  return { loss: c, probs }
}
