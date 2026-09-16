import { useEffect, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { deserialize, type SavedModel } from '../engine/persist'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'
import { longHeldOut, traceLine } from '../data/addition'
import { runAdder, runSelfTrace, runSinglePass } from '../harness/runAdder'
import { BUNDLES } from '../data/modelStats'

/**
 * What fits in one pass.
 *
 * Three ways to ask the same model for the same sum, measured live across widths:
 *
 *   1. one pass          — answer it outright. Fixed work, and it fails almost everywhere.
 *   2. write the working — chain of thought. More passes, bought one token at a time. It
 *                          genuinely helps at one and two digits, then collapses.
 *   3. the harness loop  — one fresh pass per column. Correct at every width tested.
 *
 * The middle curve is the one that earns this tab. It is the honest counterweight to the
 * strong claim that a transformer "cannot" do tasks above some complexity: writing the working
 * out really does buy computation, and really does extend what fits. It also runs out, and you
 * can see exactly where — first because the model loses its place, and eventually because the
 * working no longer fits in the context window at all.
 */

const WIDTHS = [1, 2, 3, 4, 6, 8, 10, 15, 20, 25]
const SAMPLE = 6 // sums per width; fixed seed, so the sweep repeats exactly

const COLORS = {
  single: '#f87171', // red — one pass
  trace: '#fbbf24', // amber — chain of thought
  loop: '#34d399', // green — the harness loop
}

interface Row {
  width: number
  single: number
  trace: number | null // null = a full trace cannot fit in the context window
  loop: number
  traceChars: number
  passes: number
}

export function loadAdder(): Promise<Trainer | null> {
  return fetch(import.meta.env.BASE_URL + 'adder-model.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j ? deserialize(j as SavedModel) : null))
    .catch(() => null)
}

export default function WhatFitsSection({ embed = false }: { embed?: boolean }) {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the adder…')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void loadAdder().then((t) => {
      if (cancelled) return
      if (t) {
        setTrainer(t)
        setStatus('')
      } else setStatus('could not load the adder (public/adder-model.json)')
    })
    return () => {
      cancelled = true
      cancelRef.current = true
    }
  }, [])

  // One width per frame, so the tab stays responsive and the table fills in as it measures.
  async function sweep(t: Trainer) {
    setBusy(true)
    setRows([])
    cancelRef.current = false
    const ctx = t.model.cfg.contextLen
    const out: Row[] = []
    for (const width of WIDTHS) {
      if (cancelRef.current) break
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const pairs = longHeldOut(SAMPLE, width)

      // How long the model's own working would have to be for a sum this wide. Past the
      // context window it is not a failure of skill — there is nowhere to put the working.
      const needed = traceLine(pairs[0][0], pairs[0][1]).length
      const traceFits = needed <= ctx

      let single = 0
      let trace = 0
      let loop = 0
      for (const [a, b] of pairs) {
        if (runSinglePass(t.model, t.tok, a, b).correct) single++
        if (traceFits && runSelfTrace(t.model, t.tok, a, b).correct) trace++
        if (runAdder(t.model, t.tok, a, b).correct) loop++
      }
      const pct = (n: number) => (100 * n) / pairs.length
      out.push({
        width,
        single: pct(single),
        trace: traceFits ? pct(trace) : null,
        loop: pct(loop),
        traceChars: needed,
        passes: width,
      })
      setRows([...out])
    }
    setBusy(false)
  }

  useEffect(() => {
    if (trainer) void sweep(trainer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer])

  const ctx = trainer?.model.cfg.contextLen ?? 0
  const series = [
    { label: 'one pass', color: COLORS.single, points: rows.map((r) => ({ x: r.width, y: r.single })) },
    {
      label: 'writing the working (chain of thought)',
      color: COLORS.trace,
      points: rows.filter((r) => r.trace !== null).map((r) => ({ x: r.width, y: r.trace as number })),
    },
    { label: 'the harness loop', color: COLORS.loop, points: rows.map((r) => ({ x: r.width, y: r.loop })) },
  ]

  const body = (
    <>
      {status && <p className="text-[11px] text-amber-400">{status}</p>}

      {trainer && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              className="rounded border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              onClick={() => void sweep(trainer)}
              disabled={busy}
            >
              ↺ Measure again
            </button>
            <span className="text-slate-400">
              {busy
                ? `measuring ${rows.length + 1} of ${WIDTHS.length} widths…`
                : `${SAMPLE} sums per width, the same ones every run`}
            </span>
          </div>

          <LineChart series={series} width={460} height={200} yLabel="% correct" />
          <div className="text-[11px] text-slate-500">digits in each number →</div>

          <div className="overflow-x-auto">
            <table className="text-[12px]">
              <thead>
                <tr className="text-slate-400">
                  <th className="px-2 py-0.5 text-left font-normal">digits</th>
                  <th className="px-2 py-0.5 text-right font-normal">one pass</th>
                  <th className="px-2 py-0.5 text-right font-normal">writing the working</th>
                  <th className="px-2 py-0.5 text-right font-normal">the loop</th>
                  <th className="px-2 py-0.5 text-right font-normal">working needs</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {rows.map((r) => (
                  <tr key={r.width}>
                    <td className="px-2 py-0.5 text-slate-300">{r.width}</td>
                    <td className="px-2 py-0.5 text-right" style={{ color: COLORS.single }}>
                      {r.single.toFixed(0)}%
                    </td>
                    <td className="px-2 py-0.5 text-right" style={{ color: COLORS.trace }}>
                      {r.trace === null ? (
                        <span className="text-slate-600">no room</span>
                      ) : (
                        `${r.trace.toFixed(0)}%`
                      )}
                    </td>
                    <td className="px-2 py-0.5 text-right" style={{ color: COLORS.loop }}>
                      {r.loop.toFixed(0)}%
                    </td>
                    <td
                      className={
                        'px-2 py-0.5 text-right ' +
                        (r.traceChars > ctx ? 'text-rose-400' : 'text-slate-500')
                      }
                    >
                      {r.traceChars} chars
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ctx > 0 && (
            <p className="text-[11px] text-slate-500">
              This model's context window is <b className="text-slate-400">{ctx} characters</b>. Once
              the working needs more than that, there is nowhere to put it — so those rows are marked{' '}
              <span className="text-slate-600">no room</span> rather than scored as a failure.
            </p>
          )}
        </>
      )}
    </>
  )

  if (embed) return <div className="space-y-3">{body}</div>

  return (
    <div className="space-y-4">
      <SectionIntro
        title="What fits in one pass"
        papers={[
          { title: 'Hallucination Stations: On Some Basic Limitations of Transformer-Based Language Models', url: 'https://arxiv.org/abs/2507.07505' },
          { title: 'The Expressive Power of Transformers with Chain of Thought', url: 'https://arxiv.org/abs/2310.07923' },
        ]}
      >
        A forward pass costs a fixed amount of work — set by how long the input is and how wide the
        model is, not by how hard the question is. Here the same{' '}
        {BUNDLES.adder.paramsLabel}-parameter model is asked for the same sums three ways, and the
        only thing that differs between the three is <b>how many passes the answer is allowed to
        take</b>. Same weights throughout. Nothing is learned in between.
      </SectionIntro>

      {body}

      <div className="max-w-3xl space-y-2 text-[12px] leading-relaxed text-slate-400">
        <p>
          <b className="text-rose-300">One pass</b> is the bottom line, and it is worth being clear
          about why it is so bad. This model was <em>trained</em> on whole sums of up to four
          digits, thousands of them. It still almost never gets one right in a single pass. That is
          not missing knowledge — the task was in its training data.
        </p>
        <p>
          <b className="text-amber-300">Writing the working out</b> is chain of thought, and this is
          the curve that matters. At one and two digits it is <em>markedly better</em> than
          answering outright: spending more passes genuinely buys the model computation it did not
          otherwise have. Then it falls apart, and it does so well before it runs out of room —
          losing its place in the bookkeeping long before the working stops fitting in the window.
          Both limits are real, and the window is the harder one: you can compute exactly which
          width it stops at, and no amount of training moves it.
        </p>
        <p>
          <b className="text-emerald-300">The harness loop</b> gives every column a fresh pass with
          a prompt of constant length. It is correct at every width here, including widths where
          the model's own working could not physically fit. The budget now grows with the problem
          instead of being fixed in advance.
        </p>
        <p>
          <b>So what the strong version of this argument gets wrong.</b> It is sometimes said that a
          transformer simply <em>cannot</em> perform tasks above some complexity, full stop. The
          amber curve is the counter-example: more passes really do extend what fits, which is why
          reasoning models are trained to produce them. What survives is the shape rather than the
          prohibition — work per pass is fixed, extra passes are the only currency, and the supply
          is finite. Build accordingly: check whether the task fits, break it up if it does not, and
          hand the parts that still do not to something whose effort scales. Then ask who checks the
          result — which is{' '}
          <a className="text-sky-400 hover:underline" href="./lab.html?tab=verifiers-budget">
            the verifier's budget
          </a>
          , the third tab in this group.
        </p>
        <p className="text-slate-500">
          Method: {SAMPLE} sums per width, drawn from a fixed seed so the sweep repeats exactly, so
          each point moves in steps of {(100 / SAMPLE).toFixed(0)}%. The loop and the single pass
          are the two modes on the{' '}
          <a className="text-sky-400 hover:underline" href="./harness.html?section=reasoning-loop">
            adder's own page
          </a>
          .
        </p>
      </div>
    </div>
  )
}
