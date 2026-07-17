import { Model } from '../engine/model'

// Weight quantisation — the 4th "cheaper inference" lever (alongside distillation,
// Mixture-of-Experts, and KV-caching). A model's weights are stored as 32-bit floats;
// quantisation stores them with far fewer bits, shrinking the model (and the memory
// bandwidth that dominates inference) at some cost to accuracy.
//
// We simulate it honestly with **quantise → dequantise**: round each weight to one of
// 2^bits levels, then map it back to a float. The stored *value* is now one a low-bit
// model could hold, but the forward pass still runs in float — so we measure the exact
// accuracy hit of that rounding, with no engine change. The forward pass reads each
// Tensor's `.data` on every call, so mutating those arrays changes inference directly.

/**
 * Symmetric quantise→dequantise of one weight matrix to `bits` precision, in place.
 * Levels span [−maxAbs, +maxAbs] as a signed integer range (int8 → −127..127); each
 * value snaps to the nearest level. `bits >= 32` is a no-op (already full precision).
 */
export function quantiseMatrix(data: Float32Array, bits: number): void {
  if (bits >= 32) return
  const levels = (1 << (bits - 1)) - 1 // int8 → 127, int4 → 7, "2-bit" → 1 (ternary)
  if (levels < 1) return // 1-bit sign-only is out of scope; sweep uses bits >= 2
  let maxAbs = 0
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i])
    if (a > maxAbs) maxAbs = a
  }
  if (maxAbs === 0) return
  const scale = maxAbs / levels
  for (let i = 0; i < data.length; i++) {
    let q = Math.round(data[i] / scale)
    if (q > levels) q = levels
    else if (q < -levels) q = -levels
    data[i] = q * scale
  }
}

// A weight *matrix* has both dims > 1 (token/pos embeddings, Wq/Wk/Wv/Wo, W1/W2, gate,
// unembed). The LayerNorm gains/biases and MLP biases are all 1×d vectors (rows === 1) —
// tiny in count but high-impact, so real quantisation schemes keep them in full precision.
const isWeightMatrix = (rows: number) => rows > 1

/**
 * Quantise every weight matrix of a model in place to `bits` precision; leaves the
 * LayerNorm gains/biases and MLP biases in fp32. Returns the number of weights quantised.
 * Operate on a throwaway copy (e.g. a fresh `deserialize`) — this mutates the model.
 */
export function quantiseModel(model: Model, bits: number): number {
  let n = 0
  for (const p of model.params) {
    if (isWeightMatrix(p.rows)) {
      quantiseMatrix(p.data, bits)
      n += p.size
    }
  }
  return n
}

/**
 * Bytes to store the model's weights when the matrices use `bits` per value and the
 * small LN/bias vectors stay fp32 — the "size" side of the accuracy-vs-size trade-off.
 */
export function modelBytes(model: Model, bits: number): number {
  let totalBits = 0
  for (const p of model.params) totalBits += p.size * (isWeightMatrix(p.rows) ? bits : 32)
  return totalBits / 8
}
