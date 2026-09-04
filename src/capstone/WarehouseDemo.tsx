import { useEffect, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { heldOutBaskets, type Basket } from '../data/warehouse'
import { runBasket, type AgentRun } from './agent'
import WarehouseGrid from './WarehouseGrid'

// The interactive core of the warehouse demo — pick a basket, watch the agent walk the
// warehouse and pack it. Extracted from CapstoneApp so the page and the embeddable frame
// (embed.html?demo=warehouse) run the SAME code: the page passes its own model toggle and
// caption through the slots below, the frame passes neither, because an embed carries none
// of its page's framing.

const btn = 'rounded border px-2 py-1 text-xs'
const PRESETS: Basket[] = [
  ['A', 'C', 'F'],
  ['A', 'B', 'C'],
  ['D', 'E', 'F'],
  ['E', 'D'],
  ['A', 'B'],
  ['B', 'C', 'D'],
]

export default function WarehouseDemo({
  trainer,
  ready,
  status,
  controls,
  caption,
}: {
  trainer: Trainer | null
  ready: boolean
  status: string
  /** page-only: the trained-agent / your-live-model switch */
  controls?: React.ReactNode
  /** page-only: the line under the grid explaining what you are looking at */
  caption?: React.ReactNode
}) {
  const [basket, setBasket] = useState<Basket>(['A', 'C', 'F'])
  const [run, setRun] = useState<AgentRun | null>(null)

  useEffect(() => {
    if (!trainer) {
      setRun(null)
      return
    }
    setRun(runBasket(trainer.model, trainer.tok, basket))
  }, [trainer, basket])

  const randomHeld = () => {
    const held = heldOutBaskets()
    setBasket(held[Math.floor(Math.random() * held.length)])
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">watch the agent pack an order:</span>
        {PRESETS.map((b) => (
          <button
            key={b.join(' ')}
            className={btn + ' border-slate-600 bg-slate-800 font-mono hover:bg-slate-700'}
            onClick={() => setBasket(b)}
          >
            {b.join(' ')}
          </button>
        ))}
        <button className={btn + ' border-sky-700 bg-sky-950/40 text-sky-200'} onClick={randomHeld}>
          🎲 random held-out
        </button>
        {controls}
      </div>
      {ready ? <WarehouseGrid run={run} /> : <div className="text-xs text-slate-400">{status}</div>}
      {caption}
    </>
  )
}
