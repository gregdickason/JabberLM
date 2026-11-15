import { useEffect, useMemo, useRef, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { generate } from '../engine/generate'
import { RNG } from '../engine/random'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG } from '../engine/config'
import { allBaskets, warePrompt, type Basket } from '../data/warehouse'
import { WAREHOUSE_RULES, gateWarehousePlan, type GatedRun, type ReadMode, type ActionEvent } from '../data/policy'

// The policy gate on the warehouse agent: every action the model asks for is checked by rules it
// never sees, BEFORE it executes. A denial stops that order and hands it to a person. The panel
// runs every one of the 83 orders and counts what a human would have to do either way — approve
// every action (IN the loop) or read only the escalations (ON the loop).
//
// The sampled run is reproducible: one RNG(7) shared across all 83 × 5 draws in a fixed order, the
// same sequence `scripts/measure-policy-gate.ts` uses, so the page and MEASURED.policyGate agree.

type Decoding = 'greedy' | 'sampled'
type Row = GatedRun & { order: Basket; plan: string }

const REPS: Record<Decoding, number> = { greedy: 1, sampled: 5 }
const PER_FRAME = 4
const kindStyle: Record<string, string> = {
  schema: 'border-slate-600 text-slate-300',
  stateless: 'border-sky-700 text-sky-300',
  history: 'border-violet-700 text-violet-300',
}

function describe(ev: ActionEvent): string {
  if (ev.action === 'done') return 'done'
  if (ev.action === 'malformed') return `"${ev.input.text}"`
  return `pick ${ev.input.sku}${ev.input.pad ? ' pad' : ''} → box ${ev.input.box}`
}

function Toggle<T extends string>({ value, options, onChange, disabled }: { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex overflow-hidden rounded border border-slate-700">
      {options.map(([v, label]) => (
        <button
          key={v}
          disabled={disabled}
          className={'px-2 py-0.5 text-[11px] ' + (value === v ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </span>
  )
}

function Tile({ big, label, tone = 'text-slate-100' }: { big: string | number; label: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className={'font-mono text-xl font-bold ' + tone}>{big}</div>
      <div className="text-[11px] leading-snug text-slate-400">{label}</div>
    </div>
  )
}

export default function PolicyGate({ trainer }: { trainer: Trainer | null }) {
  const [decoding, setDecoding] = useState<Decoding>('greedy')
  const [reading, setReading] = useState<ReadMode>('strict')
  // plans are generated once per decoding; the gate re-reads them instantly when `reading` flips
  const [plans, setPlans] = useState<{ order: Basket; plan: string }[]>([])
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const jobRef = useRef(0)

  const total = allBaskets().length * REPS[decoding]

  function run(d: Decoding) {
    if (!trainer) return
    const job = ++jobRef.current
    setDecoding(d)
    setPlans([])
    setSelected(null)
    setRunning(true)
    const queue: Basket[] = []
    for (const b of allBaskets()) for (let r = 0; r < REPS[d]; r++) queue.push(b)
    const rng = new RNG(d === 'sampled' ? 7 : 1)
    const temperature = d === 'sampled' ? 0.8 : 0
    let i = 0
    const tick = () => {
      if (jobRef.current !== job) return
      const batch: { order: Basket; plan: string }[] = []
      for (let k = 0; k < PER_FRAME && i < queue.length; k++, i++) {
        const order = queue[i]
        const out = generate(trainer.model, DEFAULT_FEATURE_FLAGS, trainer.tok, warePrompt(order), { ...DEFAULT_SAMPLE_CONFIG, temperature, maxNewTokens: 64 }, rng)
        batch.push({ order, plan: out.split('\n')[0] })
      }
      setPlans((p) => [...p, ...batch])
      if (i < queue.length) requestAnimationFrame(tick)
      else setRunning(false)
    }
    requestAnimationFrame(tick)
  }

  // run once when the model arrives, so the panel is never empty
  useEffect(() => {
    if (trainer) run('greedy')
    return () => {
      jobRef.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer])

  const rows: Row[] = useMemo(
    () => plans.map((p) => ({ ...gateWarehousePlan(p.plan, p.order, reading), order: p.order, plan: p.plan })),
    [plans, reading],
  )

  const stats = useMemo(() => {
    const s = { actions: 0, completed: 0, escalated: 0, unfinished: 0, wrongThrough: 0, falseAlarms: 0, wasteful: 0 }
    const hits: Record<string, number> = {}
    for (const r of rows) {
      s.actions += r.steps.length
      s[r.outcome]++
      if (r.denial) hits[r.denial.rule] = (hits[r.denial.rule] || 0) + 1
      if (r.outcome === 'completed' && !r.correct) s.wrongThrough++
      if (r.outcome !== 'completed' && r.correct) s.falseAlarms++
      if (r.outcome === 'completed' && (r.extra ?? 0) > 0) s.wasteful++
    }
    return { ...s, hits }
  }, [rows])

  const escalations = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.outcome !== 'completed')
  const slipped = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.outcome === 'completed' && !r.correct)
  const shownIdx = selected ?? (escalations.length ? escalations[escalations.length - 1].i : rows.length - 1)
  const shown = shownIdx >= 0 ? rows[shownIdx] : undefined

  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded border border-emerald-600 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-200 disabled:opacity-50"
          disabled={!trainer || running}
          onClick={() => run(decoding)}
        >
          ▶ Run every order again
        </button>
        <span className="text-slate-400">tries per order:</span>
        <Toggle
          value={decoding}
          disabled={!trainer || running}
          options={[['greedy', 'one (its best guess)'], ['sampled', 'five (sampled)']]}
          onChange={(d) => run(d)}
        />
        <span className="text-slate-400">reading the model's output:</span>
        <Toggle value={reading} options={[['strict', 'strict schema'], ['lax', 'lax parser']]} onChange={setReading} />
        <span className="text-slate-400">
          {running ? `running… ${plans.length}/${total}` : `${rows.length} plans checked`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile big={stats.completed} label="orders the agent finished on its own" tone="text-emerald-300" />
        <Tile big={stats.escalated + stats.unfinished} label="stopped and sent to a person" tone="text-amber-300" />
        <Tile
          big={stats.wrongThrough}
          label={<>wrong plans that got through <span className="text-slate-500">(audit: checked against the answer key)</span></>}
          tone={stats.wrongThrough ? 'text-rose-300' : 'text-slate-100'}
        />
        <Tile big={stats.falseAlarms} label="correct plans stopped by mistake" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
          <div className="text-[11px] font-semibold text-slate-300">A human IN the loop</div>
          <div className="mt-1 text-slate-400">
            approves every action before it runs: <span className="font-mono text-lg font-bold text-slate-100">{stats.actions}</span>{' '}
            approvals, almost all of them for actions that were fine.
          </div>
        </div>
        <div className="rounded border border-amber-900/50 bg-slate-950/60 px-3 py-2">
          <div className="text-[11px] font-semibold text-amber-300">A human ON the loop</div>
          <div className="mt-1 text-slate-400">
            writes the rules, then reads only what the gate stopped:{' '}
            <span className="font-mono text-lg font-bold text-amber-200">{stats.escalated + stats.unfinished}</span> escalations, each with
            the rule it broke. And watches the one thing no rule covers:{' '}
            <span className="font-mono text-slate-200">{stats.wasteful}</span> finished orders walked further than they needed to.
          </div>
        </div>
      </div>

      {reading === 'lax' && slipped.length > 0 && (
        <div className="rounded border border-rose-800 bg-rose-950/30 px-3 py-2 text-rose-200">
          The lax parser let a wrong plan through:{' '}
          <span className="font-mono">{slipped[0].r.plan}</span>. It read <span className="font-mono">pak1</span> as box 1. Nothing was
          wrong with the rules. The gap is in turning the model's text into the actions the rules check, which is why real policy
          engines validate every action against a schema first. Switch back to strict and it is stopped.
        </div>
      )}
      {reading === 'lax' && decoding === 'greedy' && (
        <div className="text-[11px] text-slate-400">
          With one try per order the lax parser happens to cost nothing. Try five sampled tries per order: one of the 415 plans
          contains a typo.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-1 text-[11px] text-slate-400">
            {shown ? (
              <>
                order <span className="font-mono text-slate-200">{shown.order.join(' ')}</span>, action by action, as the gate saw it
              </>
            ) : (
              'waiting for the first order…'
            )}
          </div>
          {shown && (
            <div className="space-y-0.5 font-mono">
              {shown.steps.map((st, k) => (
                <div key={k} className="flex flex-wrap gap-x-2">
                  <span className={st.verdict.allow ? 'text-emerald-300' : 'font-bold text-amber-300'}>
                    {st.verdict.allow ? 'ALLOW' : 'DENY '}
                  </span>
                  <span className="text-slate-200">{describe(st.event)}</span>
                  {!st.verdict.allow && (
                    <span className="text-amber-200/80">
                      [{st.verdict.rule}] {st.verdict.reason}
                    </span>
                  )}
                </div>
              ))}
              {shown.outcome === 'unfinished' && <div className="text-amber-300">stopped without "done": nothing tells it to finish</div>}
              <div className="pt-1 text-[11px] text-slate-500">
                the model wrote: {shown.plan || '(nothing)'}
                {shown.outcome !== 'completed' && ' · the denied action and everything after it never ran'}
              </div>
            </div>
          )}
        </div>

        <div className="rounded border border-amber-900/50 bg-slate-950/60 p-3">
          <div className="mb-1 text-[11px] font-semibold text-amber-300">The escalation queue ({escalations.length})</div>
          <div className="max-h-48 space-y-0.5 overflow-y-auto font-mono text-[11px]">
            {escalations.length === 0 && <div className="text-slate-500">nothing yet</div>}
            {escalations.map(({ r, i }) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={'block w-full text-left hover:bg-slate-800 ' + (i === shownIdx ? 'bg-slate-800' : '')}
              >
                <span className="text-slate-300">{r.order.join(' ').padEnd(6)}</span>{' '}
                <span className="text-amber-300">[{r.denial?.rule ?? 'unfinished'}]</span>{' '}
                <span className="text-slate-400">{r.denial?.reason ?? 'never said done'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="rounded border border-slate-800 bg-slate-950/60 p-3">
        <summary className="cursor-pointer text-slate-300">
          The {WAREHOUSE_RULES.length} rules (one schema, three about the action alone, two about its history), and how often each fired
        </summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {WAREHOUSE_RULES.map((r) => (
            <div key={r.id} className="rounded border border-slate-800 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={'rounded border px-1.5 text-[10px] ' + kindStyle[r.kind]}>{r.kind}</span>
                <span className="font-mono text-slate-200">{r.id}</span>
                <span className="ml-auto font-mono text-amber-300">{stats.hits[r.id] ?? 0}×</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{r.label}</div>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-950 p-2 text-[10px] leading-snug text-slate-300">{r.source}</pre>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Written in the style of Dogwood, AWS's open-source policy language for agents, to show the shape. It is not real Dogwood: here
          each rule is a few lines of TypeScript. In Dogwood, rules about a single action can be formally analysed (proved, for example,
          never to let a given action through); rules about history are checked as the agent runs, not proved, and AWS says so.
        </p>
      </details>
    </div>
  )
}
