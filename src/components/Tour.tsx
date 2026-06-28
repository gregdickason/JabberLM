import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A tiny "walk me through" tour: spotlights an element (by data-tour attribute),
// shows a tooltip with Next / Back / Skip, and advances through a list of steps.
// No dependency; finds targets via querySelector so it works across components.
// If a step's target isn't on screen yet, the tooltip centres instead of pointing.

export interface TourStep {
  anchor: string // matches data-tour="<anchor>"
  title: string
  body: React.ReactNode
}

const TOOLTIP_W = 300

export default function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [tipH, setTipH] = useState(160)
  const step = steps[i]

  // measure the tooltip's real height so we can keep it fully on-screen (a tall
  // step — e.g. the grokking explainer — must never push its Next button below
  // the viewport). Only set state when it actually changes to avoid a loop.
  useLayoutEffect(() => {
    const h = tipRef.current?.offsetHeight
    if (h && Math.abs(h - tipH) > 1) setTipH(h)
  })

  // (re)locate the current target and follow it on scroll / resize / layout change
  useLayoutEffect(() => {
    let raf = 0
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.anchor}"]`) as HTMLElement | null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const el = document.querySelector(`[data-tour="${step.anchor}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    measure()
    const onScrollResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    const id = window.setInterval(measure, 400) // catch layout shifts (e.g. grok panel appearing)
    return () => {
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
      window.clearInterval(id)
      cancelAnimationFrame(raf)
    }
  }, [step.anchor])

  // keyboard: → / ← / Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') setI((n) => Math.min(steps.length - 1, n + 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steps.length, onClose])

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  // tooltip placement: prefer below the target, else above; then clamp into the
  // viewport (top kept >= 8 and bottom kept on-screen) so Next is always reachable.
  let tip: React.CSSProperties
  if (rect) {
    const left = Math.max(8, Math.min(rect.left, vw - TOOLTIP_W - 8))
    const desired =
      rect.bottom + 12 + tipH + 8 <= vh ? rect.bottom + 12 : rect.top - tipH - 12
    const top = Math.max(8, Math.min(desired, vh - tipH - 8))
    tip = { left, top }
  } else {
    tip = { left: Math.max(8, vw / 2 - TOOLTIP_W / 2), top: Math.max(8, vh / 2 - tipH / 2) }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* dim everything except a hole around the target (box-shadow trick); clicks pass through */}
      <div className="pointer-events-none absolute inset-0">
        {rect && (
          <div
            className="absolute rounded-md transition-all duration-200"
            style={{
              left: rect.left - 6,
              top: rect.top - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: '0 0 0 9999px rgba(2,6,23,0.72)',
              outline: '2px solid rgba(232,121,249,0.9)',
            }}
          />
        )}
        {!rect && <div className="absolute inset-0" style={{ background: 'rgba(2,6,23,0.72)' }} />}
      </div>

      {/* tooltip */}
      <div
        ref={tipRef}
        className="pointer-events-auto absolute rounded-lg border border-fuchsia-700 bg-slate-900 p-3 text-xs text-slate-200 shadow-2xl"
        style={{ width: TOOLTIP_W, ...tip }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-bold text-fuchsia-300">{step.title}</span>
          <span className="text-[10px] text-slate-500">
            {i + 1}/{steps.length}
          </span>
        </div>
        <div className="leading-relaxed text-slate-300">{step.body}</div>
        <div className="mt-3 flex items-center justify-between">
          <button className="text-[11px] text-slate-500 hover:text-slate-300" onClick={onClose}>
            Skip tour
          </button>
          <span className="flex gap-2">
            <button
              className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              onClick={() => setI((n) => Math.max(0, n - 1))}
              disabled={i === 0}
            >
              Back
            </button>
            {i < steps.length - 1 ? (
              <button
                className="rounded border border-fuchsia-600 bg-fuchsia-900/50 px-2 py-0.5 text-[11px] text-fuchsia-100 hover:bg-fuchsia-900/80"
                onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}
              >
                Next →
              </button>
            ) : (
              <button
                className="rounded border border-fuchsia-600 bg-fuchsia-900/50 px-2 py-0.5 text-[11px] text-fuchsia-100 hover:bg-fuchsia-900/80"
                onClick={onClose}
              >
                Done ✓
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
