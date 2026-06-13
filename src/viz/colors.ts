// Color scales for the heatmaps, tuned for the dark theme.

type RGB = [number, number, number]

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

const NEUTRAL: RGB = [30, 41, 59] // slate-800
const POS: RGB = [248, 113, 113] // red-400
const NEG: RGB = [96, 165, 250] // blue-400
const SEQ_HI: RGB = [52, 211, 153] // emerald-400

/** Diverging scale for signed values; `absMax` sets the saturation range. */
export function divergingColor(v: number, absMax: number): string {
  const t = absMax > 0 ? Math.max(-1, Math.min(1, v / absMax)) : 0
  const c = t >= 0 ? mix(NEUTRAL, POS, t) : mix(NEUTRAL, NEG, -t)
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Sequential scale for non-negative values in [0, max] (e.g. attention weights). */
export function sequentialColor(v: number, max: number): string {
  const t = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0
  const c = mix(NEUTRAL, SEQ_HI, t)
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Largest absolute value in a buffer — used to scale diverging heatmaps. */
export function absMax(data: Float32Array): number {
  let m = 0
  for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i]))
  return m
}

export function maxOf(data: Float32Array): number {
  let m = 0
  for (let i = 0; i < data.length; i++) m = Math.max(m, data[i])
  return m
}
