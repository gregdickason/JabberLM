import { useEffect, useState } from 'react'
import type { WalkStep } from '../engine/walkthrough'
import Heatmap from '../viz/Heatmap'
import BarChart from '../viz/BarChart'

const btn =
  'rounded border border-slate-600 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 disabled:opacity-30'

// A full-screen guided tour of one forward pass + backprop. The user clicks
// through stages; each shows the real values/gradients with an explanation.
export default function Walkthrough({ steps, onClose }: { steps: WalkStep[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = steps[i]
  const atEnd = i === steps.length - 1

  const next = () => setI((v) => Math.min(steps.length - 1, v + 1))
  const prev = () => setI((v) => Math.max(0, v - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isFwd = step.phase === 'forward'
  const accent = isFwd ? 'text-emerald-300' : 'text-amber-300'
  const accentBg = isFwd ? 'bg-emerald-600' : 'bg-amber-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
      <div className="flex max-h-full w-full max-w-3xl flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <div className="flex items-center gap-2 text-xs">
            <span className={'rounded px-2 py-0.5 text-white ' + accentBg}>
              {isFwd ? 'Forward pass' : 'Backpropagation'}
            </span>
            <span className="text-slate-400">{step.stage}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              {i + 1} / {steps.length}
            </span>
            <button className={btn} onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* progress segments (emerald = forward, amber = backward) */}
        <div className="flex gap-px px-4 pt-2">
          {steps.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              title={s.stage}
              className={
                'h-1.5 flex-1 rounded-sm ' +
                (idx === i
                  ? 'bg-sky-400'
                  : s.phase === 'forward'
                    ? 'bg-emerald-800'
                    : 'bg-amber-800')
              }
            />
          ))}
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <h3 className={'text-sm font-bold ' + accent}>{step.title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{step.explanation}</p>
          <div className="mt-3">
            <StepBody step={step} />
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2">
          <button className={btn} onClick={prev} disabled={i === 0}>
            ← Back
          </button>
          <span className="text-[10px] text-slate-600">
            ← / → or space to navigate · Esc to close
          </span>
          {atEnd ? (
            <button className={btn + ' border-sky-700 bg-sky-900/50 text-sky-200'} onClick={onClose}>
              Done ✓
            </button>
          ) : (
            <button className={btn + ' border-sky-700 bg-sky-900/50 text-sky-200'} onClick={next}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepBody({ step }: { step: WalkStep }) {
  if (step.kind === 'tokens' && step.tokens) {
    return (
      <div className="flex flex-wrap gap-1">
        {step.tokens.labels.map((lbl, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 px-2 py-1"
          >
            <span className="text-sm text-slate-100">{lbl}</span>
            <span className="text-[9px] text-slate-500">{step.tokens!.ids[i]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (step.kind === 'matrices' && step.matrices) {
    return (
      <div className="flex flex-wrap gap-4">
        {step.matrices.map((m, i) => (
          <Heatmap
            key={i}
            matrix={m.matrix}
            title={m.label}
            scale={m.scale ?? 'diverging'}
            rowLabels={m.rowLabels}
            colLabels={m.colLabels}
          />
        ))}
      </div>
    )
  }
  if (step.kind === 'bars' && step.bars) {
    return (
      <div className="max-w-md">
        <BarChart
          values={step.bars.values}
          labels={step.bars.labels}
          highlight={step.bars.highlight}
          max={step.bars.max}
        />
      </div>
    )
  }
  if (step.kind === 'scalar' && step.scalar) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-sky-300">{step.scalar.value.toFixed(4)}</span>
        <span className="text-xs text-slate-400">{step.scalar.label}</span>
      </div>
    )
  }
  return null
}
