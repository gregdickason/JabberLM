// Tiny from-scratch PCA (top-2 principal components via power iteration). Used to
// project the model's digit-token embeddings (1..9) to 2D and watch them organise
// into a "number line" as the model groks sorting. Deterministic (fixed init), no
// dependency, cheap enough to recompute every N steps during live training.

function normalize(v: number[]): number[] {
  let s = 0
  for (const x of v) s += x * x
  s = Math.sqrt(s) || 1
  return v.map((x) => x / s)
}

// Apply the (implicit) covariance: C·v = Xcᵀ(Xc·v), avoiding forming the d×d matrix.
function covApply(Xc: number[][], v: number[]): number[] {
  const n = Xc.length
  const d = v.length
  const u = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = 0
    const row = Xc[i]
    for (let j = 0; j < d; j++) s += row[j] * v[j]
    u[i] = s
  }
  const w = new Array(d).fill(0)
  for (let i = 0; i < n; i++) {
    const ui = u[i]
    const row = Xc[i]
    for (let j = 0; j < d; j++) w[j] += row[j] * ui
  }
  return w
}

function fixSign(v: number[]): number[] {
  // make the largest-magnitude entry positive, so the projection's orientation is
  // stable across recomputations (frames don't randomly flip).
  let mi = 0
  for (let j = 1; j < v.length; j++) if (Math.abs(v[j]) > Math.abs(v[mi])) mi = j
  return v[mi] < 0 ? v.map((x) => -x) : v
}

function powerIter(Xc: number[][], d: number): number[] {
  // deterministic, non-degenerate init
  let v = normalize(Array.from({ length: d }, (_, i) => Math.sin(i * 1.7 + 0.3) + 0.11))
  for (let it = 0; it < 100; it++) v = normalize(covApply(Xc, v))
  return fixSign(v)
}

/** Project each input vector onto the top-2 principal components → (x, y) per row. */
export function pca2(vectors: number[][]): [number, number][] {
  const n = vectors.length
  if (n === 0) return []
  const d = vectors[0].length
  const mean = new Array(d).fill(0)
  for (const x of vectors) for (let j = 0; j < d; j++) mean[j] += x[j] / n
  const Xc = vectors.map((x) => x.map((v, j) => v - mean[j]))

  const v1 = powerIter(Xc, d)
  // deflate: remove the v1 component from the data, then PC1-of-the-remainder = PC2
  const Xc2 = Xc.map((x) => {
    let p = 0
    for (let j = 0; j < d; j++) p += x[j] * v1[j]
    return x.map((xj, j) => xj - p * v1[j])
  })
  let v2 = powerIter(Xc2, d)
  // force exact orthogonality to v1 (so collinear data projects to PC2 ≈ 0)
  let dot = 0
  for (let j = 0; j < d; j++) dot += v2[j] * v1[j]
  v2 = fixSign(normalize(v2.map((x, j) => x - dot * v1[j])))

  return Xc.map((x) => {
    let a = 0
    let b = 0
    for (let j = 0; j < d; j++) {
      a += x[j] * v1[j]
      b += x[j] * v2[j]
    }
    return [a, b] as [number, number]
  })
}
