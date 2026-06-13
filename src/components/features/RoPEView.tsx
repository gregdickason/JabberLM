import { useEffect, useRef, useState } from 'react'
import type { Trace } from '../../engine/trace'
import type { FeatureFlags } from '../../engine/config'
import { ropeFreqs } from '../../engine/rope'

// Visualizes RoPE as rotation. For a chosen dimension-pair, each token position
// rotates its (x0, x1) sub-vector by an angle proportional to position × the
// pair's frequency. We draw the per-position rotation directions plus the head's
// actual rotated query vectors, so the "relative position = relative angle" idea
// is visible.
export default function RoPEView({
  trace,
  layer,
  head,
  flags,
}: {
  trace: Trace
  layer: number
  head: number
  flags: FeatureFlags
}) {
  const ht = trace.layers[layer]?.heads[head]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const headDim = ht?.q.cols ?? 0
  const nPairs = Math.floor(headDim / 2)
  const [pair, setPair] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !ht) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const R = Math.min(W, H) / 2 - 18
    ctx.clearRect(0, 0, W, H)

    // axes + unit circle
    ctx.strokeStyle = '#334155'
    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(W, cy)
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx, H)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, 2 * Math.PI)
    ctx.stroke()

    const freqs = ropeFreqs(headDim, flags.ropeBase)
    const freq = freqs[pair] ?? 0
    const seq = trace.tokenIds.length

    // conceptual unit vectors rotated by position × freq (dashed, position-coloured)
    for (let p = 0; p < seq; p++) {
      const angle = trace.positions[p] * freq
      const hue = (p / Math.max(1, seq - 1)) * 280
      ctx.strokeStyle = `hsl(${hue}, 70%, 60%)`
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * R, cy - Math.sin(angle) * R)
      ctx.stroke()
    }

    // the head's actual (rotated) query sub-vectors for this pair (white dots)
    let amax = 1e-6
    for (let p = 0; p < seq; p++) {
      amax = Math.max(amax, Math.abs(ht.q.data[p * headDim + 2 * pair]))
      amax = Math.max(amax, Math.abs(ht.q.data[p * headDim + 2 * pair + 1]))
    }
    ctx.fillStyle = '#e2e8f0'
    for (let p = 0; p < seq; p++) {
      const x0 = ht.q.data[p * headDim + 2 * pair] / amax
      const x1 = ht.q.data[p * headDim + 2 * pair + 1] / amax
      ctx.beginPath()
      ctx.arc(cx + x0 * R, cy - x1 * R, 2.5, 0, 2 * Math.PI)
      ctx.fill()
    }
  }, [ht, pair, headDim, flags.ropeBase, trace])

  if (!ht) return null

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-slate-400">
        {flags.positional === 'rope' ? (
          <>
            RoPE is <span className="text-emerald-300">on</span>. Coloured spokes show the rotation
            angle for each token position (purple→pink = later positions); white dots are this
            head's actual rotated query components for the selected pair.
          </>
        ) : (
          <>
            RoPE is <span className="text-amber-300">off</span> (positional = “{flags.positional}”).
            The spokes show the rotation RoPE <em>would</em> apply — switch positional to “RoPE” in
            the sidebar to feed it into the model.
          </>
        )}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        dimension pair
        <input
          type="range"
          min={0}
          max={Math.max(0, nPairs - 1)}
          value={pair}
          onChange={(e) => setPair(Number(e.target.value))}
        />
        <span className="text-slate-200">
          {pair} / {nPairs - 1}
        </span>
      </label>
      <canvas
        ref={canvasRef}
        width={260}
        height={260}
        className="rounded border border-slate-700 bg-slate-900/60"
      />
      <div className="text-[10px] text-slate-500">
        Lower pairs rotate fast (short-range), higher pairs rotate slowly (long-range) — that spread
        of frequencies is how one head encodes positions at many scales.
      </div>
    </div>
  )
}
