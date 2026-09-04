import { useEffect, useMemo, useRef, useState } from 'react'
import { SITE, PACK, GRID, padFor, boxFor, type Basket } from '../data/warehouse'
import type { AgentRun } from './agent'

// Animated 6×6 warehouse: the agent (a forklift dot) walks from the pack station to each
// site in the order the MODEL chose, picks the item, pads it if the plan says so, and drops
// it in a box — then returns to pack. Each action is marked ✓/✗ against the true rule, so a
// wrong pad/box shows up red. Purely presentational: it replays whatever plan it's handed.

const CELL = 40
const PAD = 14 // outer padding for labels
const W = GRID * CELL + PAD * 2
const H = GRID * CELL + PAD * 2
const cx = (c: number) => PAD + c * CELL + CELL / 2
const cy = (r: number) => PAD + r * CELL + CELL / 2

// full manhattan cell path (col then row) between two cells, excluding `from`, including `to`
function legCells(from: [number, number], to: [number, number]): [number, number][] {
  const cells: [number, number][] = []
  let [c, r] = from
  const stepTo = (target: number, cur: number) => (target > cur ? cur + 1 : cur - 1)
  while (c !== to[0]) { c = stepTo(to[0], c); cells.push([c, r]) }
  while (r !== to[1]) { r = stepTo(to[1], r); cells.push([c, r]) }
  return cells
}

interface Frame { cell: [number, number]; arriveAction: number | null }

export default function WarehouseGrid({ run }: { run: AgentRun | null }) {
  // Build the full step-by-step path + the box contents that accumulate on arrivals.
  const { frames, actions } = useMemo(() => {
    const acts = run?.actions ?? []
    const waypoints: [number, number][] = [PACK, ...acts.map((a) => SITE[a.sku]), PACK]
    const frames: Frame[] = [{ cell: PACK, arriveAction: null }]
    for (let i = 1; i < waypoints.length; i++) {
      const leg = legCells(waypoints[i - 1], waypoints[i])
      if (leg.length === 0) {
        // same cell as previous waypoint (duplicate site) — register an in-place arrival
        frames.push({ cell: waypoints[i], arriveAction: i - 1 < acts.length ? i - 1 : null })
        continue
      }
      leg.forEach((cell, k) => {
        const isLast = k === leg.length - 1
        frames.push({ cell, arriveAction: isLast && i - 1 < acts.length ? i - 1 : null })
      })
    }
    return { frames, actions: acts }
  }, [run])

  const [idx, setIdx] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  // (re)start the animation whenever the run changes
  useEffect(() => {
    setIdx(0)
    if (frames.length <= 1) return
    timer.current = window.setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) { window.clearInterval(timer.current); return i }
        return i + 1
      })
    }, 90)
    return () => window.clearInterval(timer.current)
  }, [frames])

  const basket: Basket = run?.basket ?? []
  const agent = frames[Math.min(idx, frames.length - 1)]?.cell ?? PACK
  // which actions have been "picked" so far (arrival at or before the current frame)
  const pickedThrough = useMemo(() => {
    let last = -1
    for (let f = 0; f <= Math.min(idx, frames.length - 1); f++) {
      if (frames[f].arriveAction != null) last = frames[f].arriveAction as number
    }
    return last
  }, [idx, frames])

  const box1 = actions.filter((a, i) => i <= pickedThrough && a.box === 1)
  const box2 = actions.filter((a, i) => i <= pickedThrough && a.box === 2)

  // Make wrongness unmistakable in the warehouse: animate whatever the agent guessed, then
  // (once the walk finishes) stamp a big red ✗ over the grid. A malformed/no-plan run has no
  // walk to play, so the ✗ shows immediately.
  const finished = idx >= frames.length - 1
  const noPlan = !!run && run.actions == null
  const showX = !!run && !run.correct && finished

  return (
    <div className="flex flex-wrap gap-4">
      <svg width={W} height={H} className={'rounded border bg-slate-900/40 ' + (showX ? 'border-red-500' : 'border-slate-700')}>
        {/* grid lines */}
        {Array.from({ length: GRID + 1 }, (_, i) => (
          <g key={i} stroke="#1e293b" strokeWidth={1}>
            <line x1={PAD + i * CELL} y1={PAD} x2={PAD + i * CELL} y2={H - PAD} />
            <line x1={PAD} y1={PAD + i * CELL} x2={W - PAD} y2={PAD + i * CELL} />
          </g>
        ))}
        {/* packing station: the agent returns to the middle; a box on each side (1 and 2) fills
            with the items it packs, so it's clear there are TWO boxes to sort into */}
        <rect x={cx(PACK[0]) - 12} y={cy(PACK[1]) - 12} width={24} height={24} rx={4} fill="none" stroke="#475569" strokeDasharray="3 2" />
        <text x={cx(PACK[0])} y={cy(PACK[1]) + 3} textAnchor="middle" fontSize={10} fill="#94a3b8">pack</text>
        {([1, 2] as const).map((n) => {
          const col = PACK[0] + (n === 1 ? -1 : 1)
          const items = n === 1 ? box1 : box2
          return (
            <g key={n}>
              <rect x={cx(col) - 17} y={cy(PACK[1]) - 17} width={34} height={34} rx={4} fill="#1e293b" stroke="#6366f1" strokeWidth={1.5} />
              <text x={cx(col)} y={cy(PACK[1]) - 7} textAnchor="middle" fontSize={10} fill="#93c5fd">box {n}</text>
              <text x={cx(col)} y={cy(PACK[1]) + 9} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#e0e7ff">
                {items.map((a) => a.sku).join(' ') || ''}
              </text>
            </g>
          )
        })}
        {/* SKU pick sites */}
        {Object.entries(SITE).map(([sku, cell]) => {
          const inOrder = basket.includes(sku)
          const done = actions.some((a, i) => i <= pickedThrough && a.sku === sku)
          return (
            <g key={sku}>
              <rect
                x={cx(cell[0]) - 15} y={cy(cell[1]) - 15} width={30} height={30} rx={5}
                fill={done ? '#064e3b' : inOrder ? '#3f3f16' : '#0f172a'}
                stroke={inOrder ? '#eab308' : '#334155'} strokeWidth={inOrder ? 2 : 1}
              />
              <text x={cx(cell[0])} y={cy(cell[1]) + 5} textAnchor="middle" fontSize={14} fontWeight="bold" fill={inOrder ? '#fde68a' : '#94a3b8'}>{sku}</text>
            </g>
          )
        })}
        {/* the agent */}
        <circle cx={cx(agent[0])} cy={cy(agent[1])} r={9} fill="#38bdf8" stroke="#0ea5e9" strokeWidth={2} />
        {/* big red ✗ when the pack is wrong (or there was no coherent plan) */}
        {showX && (
          <g pointerEvents="none">
            <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="#ef4444" opacity={0.12} />
            <line x1={W / 2 - 62} y1={H / 2 - 62} x2={W / 2 + 62} y2={H / 2 + 62} stroke="#ef4444" strokeWidth={12} strokeLinecap="round" opacity={0.9} />
            <line x1={W / 2 + 62} y1={H / 2 - 62} x2={W / 2 - 62} y2={H / 2 + 62} stroke="#ef4444" strokeWidth={12} strokeLinecap="round" opacity={0.9} />
            {noPlan && (
              <text x={W / 2} y={H - PAD - 6} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#fca5a5">no coherent plan</text>
            )}
          </g>
        )}
      </svg>

      {/* order + boxes + per-action correctness */}
      <div className="min-w-[220px] space-y-2 text-[12px]">
        <div className="font-mono text-slate-300">
          order: <span className="text-amber-300">{basket.join(' ') || '—'}</span>
        </div>
        <Box label="Box 1" items={box1} basket={basket} />
        <Box label="Box 2" items={box2} basket={basket} />
        {run && (
          <div className="pt-1 font-mono text-[11px]">
            {run.actions == null ? (
              <span className="text-red-400">malformed plan ✗</span>
            ) : run.correct ? (
              <span className="text-emerald-400">packed correctly ✓ · {run.tiles} tiles{run.extra ? ` (+${run.extra} vs best)` : ' (optimal)'}</span>
            ) : (
              <span className="text-red-400">packed wrong ✗</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Box({ label, items, basket }: { label: string; items: { sku: string; pad: boolean; box: 1 | 2 }[]; basket: Basket }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-800/40 p-2">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1 font-mono">
        {items.length === 0 ? (
          <span className="text-slate-400">empty</span>
        ) : (
          items.map((a, i) => {
            const padOk = a.pad === padFor(a.sku, basket)
            const boxOk = a.box === boxFor(a.sku, basket)
            const ok = padOk && boxOk
            return (
              <span key={i} className={'rounded px-1.5 py-0.5 ' + (ok ? 'bg-emerald-900/50 text-emerald-200' : 'bg-red-900/50 text-red-200')} title={ok ? 'rule-correct' : 'wrong pad/box'}>
                {a.sku}{a.pad ? ' 🛡' : ''} {ok ? '✓' : '✗'}
              </span>
            )
          })
        )}
      </div>
    </div>
  )
}
