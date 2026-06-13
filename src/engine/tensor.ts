import { RNG } from './random'

// A deliberately small, fully-inspectable tensor: a flat Float32Array plus a
// (rows, cols) shape. The whole transformer is expressed with 2D matrices (and
// per-head 2D slices), which keeps the math readable — the entire point of this
// project. Every op (in ops.ts) records a `_backward` closure on its output, so
// `backward()` is a plain reverse walk of the tape that accumulates gradients.
//
// Because every intermediate Tensor stays referenced in the graph, the UI can
// read `.data` on any of them (Q, K, V, scores, attn weights, ...) for free.

export class Tensor {
  data: Float32Array
  grad: Float32Array
  rows: number
  cols: number
  label: string

  /** Inputs that produced this tensor (the tape edges). */
  _prev: Tensor[]
  /** Accumulate this node's grad into its inputs' grads. No-op for leaves. */
  _backward: () => void
  /** Parameters are updated by the optimizer; constants/inputs are not. */
  requiresGrad: boolean

  constructor(data: Float32Array, rows: number, cols: number, label = '') {
    if (data.length !== rows * cols) {
      throw new Error(`Tensor shape ${rows}x${cols} != data length ${data.length}`)
    }
    this.data = data
    this.grad = new Float32Array(rows * cols)
    this.rows = rows
    this.cols = cols
    this.label = label
    this._prev = []
    this._backward = () => {}
    this.requiresGrad = false
  }

  get size(): number {
    return this.rows * this.cols
  }

  at(r: number, c: number): number {
    return this.data[r * this.cols + c]
  }

  // --- constructors -------------------------------------------------------

  static zeros(rows: number, cols: number, label = ''): Tensor {
    return new Tensor(new Float32Array(rows * cols), rows, cols, label)
  }

  static from(values: number[], rows: number, cols: number, label = ''): Tensor {
    return new Tensor(Float32Array.from(values), rows, cols, label)
  }

  /** A trainable parameter, randomly initialised with the given std-dev. */
  static param(rows: number, cols: number, std: number, rng: RNG, label = ''): Tensor {
    const data = new Float32Array(rows * cols)
    for (let i = 0; i < data.length; i++) data[i] = rng.randn() * std
    const t = new Tensor(data, rows, cols, label)
    t.requiresGrad = true
    return t
  }

  zeroGrad(): void {
    this.grad.fill(0)
  }

  clone(): Tensor {
    return new Tensor(this.data.slice(), this.rows, this.cols, this.label)
  }

  // --- backward -----------------------------------------------------------

  /** Reverse-mode autodiff: topo-sort the graph then run each `_backward`. */
  backward(): void {
    const topo: Tensor[] = []
    const visited = new Set<Tensor>()
    const build = (t: Tensor) => {
      if (visited.has(t)) return
      visited.add(t)
      for (const p of t._prev) build(p)
      topo.push(t)
    }
    build(this)

    // seed: d(self)/d(self) = 1
    this.grad.fill(1)
    for (let i = topo.length - 1; i >= 0; i--) topo[i]._backward()
  }
}
