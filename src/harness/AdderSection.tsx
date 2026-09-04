import { useEffect, useMemo, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { runAdder, runSinglePass, runSelfTrace, type AdderTrace } from './runAdder'
import { sumLine, traceLine, colPrompt } from '../data/addition'
import { Section, Callout, card } from '../explain/ui'

// The REASONING-LOOP section. The tool harness above lets a JS function do the maths; here
// the MODEL does every single sum and the harness only remembers where it is. Same loop
// shape, completely different division of labour.

async function loadAdder(): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'adder-model.json')
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

const inputCls =
  'w-40 rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm text-slate-100 focus:border-sky-600 focus:outline-none'
const btnCls =
  'rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700 disabled:opacity-40'

const clean = (s: string) => s.replace(/\D/g, '').slice(0, 30)

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={ok ? 'text-emerald-300' : 'text-rose-300'}>
      {ok ? '✓ ' : '✗ '}
      {children}
    </span>
  )
}

/** One row of the loop: the exact prompt the model saw, and exactly what it said back. */
function LoopTrace({ trace }: { trace: AdderTrace }) {
  return (
    <div className="mt-2 space-y-1 font-mono text-[11px]">
      {trace.steps.map((s) => (
        <div key={s.col} className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 whitespace-nowrap text-slate-400">col {s.col}</span>
          <span className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-300">{s.prompt.trim()}</span>
          <span className="text-slate-500">→</span>
          <span className={'rounded px-1.5 py-0.5 ' + (s.ok ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300')}>
            {s.raw.trim() || '(nothing)'}
          </span>
          <span className="text-slate-400">
            keep <b className="text-slate-300">{s.digit ?? '?'}</b>, carry{' '}
            <b className="text-slate-300">{s.carryOut ?? '?'}</b>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdderSection({ n, embed = false }: { n: number; embed?: boolean }) {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the adder…')
  const [a, setA] = useState('23498')
  const [b, setB] = useState('94321')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{
    single: ReturnType<typeof runSinglePass>
    self: ReturnType<typeof runSelfTrace> | null
    loop: AdderTrace
  } | null>(null)

  useEffect(() => {
    let live = true
    void loadAdder().then((t) => {
      if (!live) return
      setTrainer(t)
      setStatus(t ? '' : 'adder model not found — run `npm run gen:adder`')
    })
    return () => {
      live = false
    }
  }, [])

  // How long each format's line is, computed from the REAL formats — never a stale number.
  const budget = useMemo(() => {
    const ctx = trainer?.model.cfg.contextLen ?? 96
    return [2, 4, 6, 10, 15].map((d) => {
      const x = '8'.repeat(d)
      const y = '5'.repeat(d)
      return { d, single: sumLine(x, y).length, trace: traceLine(x, y).length, loop: colPrompt(8, 5, 1).length, ctx }
    })
  }, [trainer])

  useEffect(() => {
    if (embed && trainer) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed, trainer])

  const run = () => {
    if (!trainer || !a || !b) return
    setBusy(true)
    // let the button repaint before the (synchronous) forward passes
    setTimeout(() => {
      const short = Math.max(a.length, b.length) <= 6
      setOut({
        single: runSinglePass(trainer.model, trainer.tok, a, b),
        self: short ? runSelfTrace(trainer.model, trainer.tok, a, b) : null,
        loop: runAdder(trainer.model, trainer.tok, a, b),
      })
      setBusy(false)
    }, 0)
  }

  const intro = (
    <>
      <p>
        Everything above hands the hard part to a <b>tool</b>: the model says{' '}
        <code className="font-mono text-slate-300">sum(6 9 2)</code> and JavaScript computes it. This
        last section is the opposite. Here a second tiny model does <b>every single sum itself</b> — the
        harness only keeps track of where it is.
      </p>
      <p className="text-[13px] text-slate-400">
        It was taught exactly one thing: the addition table. <b>200 facts</b>, of the form{' '}
        <code className="font-mono text-slate-300">add 8 1 0 =&gt; 9 0</code> — "eight plus one plus a
        carry of nothing is nine, carry nothing". That is the whole of its arithmetic. Everything else
        below is the <em>loop</em>.
      </p>
    </>
  )

  const body = (
    <>
      {status && <p className="text-[11px] text-amber-400">{status}</p>}

      {trainer && (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-slate-400">
                first number
                <input className={inputCls + ' mt-1 block'} value={a} onChange={(e) => setA(clean(e.target.value))} />
              </label>
              <span className="pb-2 text-lg text-slate-400">+</span>
              <label className="text-[11px] text-slate-400">
                second number
                <input className={inputCls + ' mt-1 block'} value={b} onChange={(e) => setB(clean(e.target.value))} />
              </label>
              <button className={btnCls + ' mb-0.5'} onClick={run} disabled={busy || !a || !b}>
                {busy ? 'thinking…' : 'add them'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="text-slate-400">try:</span>
              {[
                ['23498', '94321'],
                ['7', '8'],
                ['9999999999', '1'],
                ['123456789012345', '987654321098765'],
              ].map(([x, y]) => (
                <button
                  key={x}
                  className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-slate-300 hover:bg-slate-800"
                  onClick={() => {
                    setA(x)
                    setB(y)
                    setOut(null)
                  }}
                >
                  {x.length > 8 ? `${x.length} digits` : `${x} + ${y}`}
                </button>
              ))}
            </div>
          </div>

          {out && (
            <div className="mt-3 space-y-3">
              <div className={card}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  1 · ask for the whole answer at once
                </div>
                <div className="mt-1 font-mono text-xs text-slate-300">
                  sum {a} {b} =&gt; <span className="text-rose-300">{out.single.answer || '(nothing)'}</span>
                </div>
                <div className="mt-1 text-[11px]">
                  <Verdict ok={out.single.correct}>
                    {out.single.correct ? 'right' : `wrong — the answer is ${out.single.expected}`}
                  </Verdict>
                  <span className="ml-2 text-slate-400">
                    one forward pass, no working — it has to hold every carry at once.
                  </span>
                </div>
              </div>

              {out.self && (
                <div className={card}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    2 · ask it to show its working, all in one go
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] text-slate-400">
                    {out.self.raw.trim() || '(nothing)'}
                  </div>
                  <div className="mt-1 text-[11px]">
                    <Verdict ok={out.self.correct}>
                      {out.self.correct ? 'right' : 'it cannot reliably do this'}
                    </Verdict>
                    <span className="ml-2 text-slate-400">
                      to write "the rightmost digits are 8 and 1" it must <em>find</em> them by counting
                      along the number — and counting positions is something tiny models are bad at.
                    </span>
                  </div>
                </div>
              )}

              <div className={card + ' border-emerald-900'}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                  3 · the loop — one column at a time
                </div>
                <LoopTrace trace={out.loop} />
                <div className="mt-2 font-mono text-sm">
                  <span className="text-slate-400">= </span>
                  <span className={out.loop.correct ? 'text-emerald-300' : 'text-rose-300'}>{out.loop.answer}</span>
                  {!out.loop.correct && <span className="ml-2 text-[11px] text-rose-300">(should be {out.loop.expected})</span>}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {out.loop.steps.length} questions to the model · every prompt{' '}
                  <b className="text-slate-300">{out.loop.maxPromptChars} characters</b> long, however big the sum.
                </div>
              </div>
            </div>
          )}

          {!embed && (
            <p className="mt-4">
              The harness slices off one column, asks the model, writes down the digit, and carries the
              carry. <b>It never adds anything itself.</b> Every number in that answer came out of the
              model — the harness is doing what a person does with a pencil: keeping the place.
            </p>
          )}

          <div className={card + ' mt-3'}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              why the loop keeps working when the others stop
            </div>
            <table className="w-full font-mono text-[11px]">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 text-left font-normal">digits</th>
                  <th className="py-1 text-right font-normal">all at once</th>
                  <th className="py-1 text-right font-normal">showing working</th>
                  <th className="py-1 text-right font-normal">one column</th>
                </tr>
              </thead>
              <tbody>
                {budget.map((r) => (
                  <tr key={r.d} className="border-t border-slate-800">
                    <td className="py-1 text-slate-300">{r.d}</td>
                    <td className="py-1 text-right text-slate-400">{r.single}</td>
                    <td className={'py-1 text-right ' + (r.trace > r.ctx ? 'text-rose-300' : 'text-slate-400')}>
                      {r.trace}
                      {r.trace > r.ctx ? ' ✗' : ''}
                    </td>
                    <td className="py-1 text-right text-emerald-300">{r.loop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-400">
              Characters the model must hold at once. Its memory is{' '}
              <b className="text-slate-300">{budget[0]?.ctx}</b> characters. Writing out the working grows
              with the sum and runs out of room; asking one column at a time never does.
            </p>
          </div>

          {!embed && (
            <Callout>
              Two different jobs get muddled together as "the agent thinks". <b>Reasoning</b> is the model
              doing a step it could not do in one go — here, every single addition. <b>Memory</b> is the
              harness holding the place so the model never has to. This model knows only the addition table
              and can't add two 4-digit numbers on its own, yet it adds 25-digit numbers correctly, because
              the loop turns one big problem into many tiny ones it <em>can</em> do. When you buy an "agent",
              ask which of those two you are getting — and what happens to the answer when one step is wrong.
            </Callout>
          )}
        </>
      )}
    </>
  )

  if (embed) return <div className="space-y-3">{body}</div>
  return (
    <Section n={n} title="Reasoning in a loop — the model does the maths, the harness remembers" id="reasoning-loop">
      {intro}
      {body}
    </Section>
  )
}
