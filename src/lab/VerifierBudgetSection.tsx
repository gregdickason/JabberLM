import { useEffect, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'
import { addOracle, longHeldOut, traceLine } from '../data/addition'
import { runAdder, runSelfTrace, runSinglePass } from '../harness/runAdder'
import { loadAdder } from './WhatFitsSection'
import { BUNDLES } from '../data/modelStats'

/**
 * The verifier's budget.
 *
 * A model asked to check a sum has exactly the budget it had for computing one, and the only
 * way it can check is to work the sum out again. So the verdict fails where the arithmetic
 * fails — which is the argument against having one model review another's work.
 *
 * The measurement here is deliberately NOT "how often was the verdict right", because that
 * question hides the failure. Measured across every width and every method, this model accepts
 * a WRONG answer 0% of the time. By the usual framing — "it caught 100% of the errors" — it is
 * a flawless checker at every difficulty. It is not. It rejects correct answers just as
 * readily, because its own recomputation disagrees with those too. A checker that says no to
 * everything catches every error and is worth nothing.
 *
 * So both halves are plotted: what it catches, and what it wrongly rejects.
 */

const WIDTHS = [1, 2, 3, 4, 6, 8, 10, 15]
const SAMPLE = 8 // per width; each sum is judged twice, against the truth and against a lie

const COLORS = {
  caught: '#a3a3a3', // "caught the error" — flat, and misleading
  accepted: '#34d399', // accepted a correct answer — the half that collapses
  single: '#f87171',
  trace: '#fbbf24',
  loop: '#60a5fa',
  tool: '#e2e8f0',
}

interface Row {
  width: number
  caught: number // % of WRONG claims correctly rejected (the flattering metric)
  accepted: number // % of CORRECT claims correctly accepted (the honest one)
  single: number // discriminating power, checking in one pass
  trace: number | null // ... checking by writing the working out; null = no room in the window
  loop: number // ... checking with the harness loop
  tool: number // ... checking in JavaScript
}

/** Flip one digit of a correct answer: a wrong claim, plausibly shaped. */
function corrupt(answer: string, i: number): string {
  const pos = i % answer.length
  const d = Number(answer[pos])
  const alt = (d + 1 + (i % 8)) % 10
  const out = answer.slice(0, pos) + String(alt) + answer.slice(pos + 1)
  if (out === answer || out[0] === '0') return corrupt(answer, i + 1)
  return out
}

export default function VerifierBudgetSection({ embed = false }: { embed?: boolean }) {
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
      const traceFits = traceLine(pairs[0][0], pairs[0][1]).length <= ctx

      let sT = 0, sF = 0, trT = 0, trF = 0, lT = 0, lF = 0

      pairs.forEach(([a, b], i) => {
        const truth = addOracle(a, b)
        const lie = corrupt(truth, i)
        // "Accepting" a claim means the verifier's own answer matched it. That is what
        // checking by re-computation costs, and it is the only check this model can perform.
        const one = runSinglePass(t.model, t.tok, a, b).answer
        if (one === truth) sT++
        if (one === lie) sF++

        if (traceFits) {
          const tr = runSelfTrace(t.model, t.tok, a, b).answer
          if (tr === truth) trT++
          if (tr === lie) trF++
        }

        const lp = runAdder(t.model, t.tok, a, b).answer
        if (lp === truth) lT++
        if (lp === lie) lF++
      })

      const pct = (n: number) => (100 * n) / pairs.length
      out.push({
        width,
        caught: 100 - pct(sF), // wrong claims it did NOT accept
        accepted: pct(sT),
        single: pct(sT) - pct(sF),
        trace: traceFits ? pct(trT) - pct(trF) : null,
        loop: pct(lT) - pct(lF),
        tool: 100, // addOracle(a, b) === claim, exact at every width
      })
      setRows([...out])
    }
    setBusy(false)
  }

  useEffect(() => {
    if (trainer) void sweep(trainer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer])

  const trapSeries = [
    { label: 'caught the wrong answer', color: COLORS.caught, points: rows.map((r) => ({ x: r.width, y: r.caught })) },
    { label: 'accepted the right answer', color: COLORS.accepted, points: rows.map((r) => ({ x: r.width, y: r.accepted })) },
  ]
  const powerSeries = [
    { label: 'checking in one pass', color: COLORS.single, points: rows.map((r) => ({ x: r.width, y: r.single })) },
    { label: 'checking by writing the working', color: COLORS.trace, points: rows.filter((r) => r.trace !== null).map((r) => ({ x: r.width, y: r.trace as number })) },
    { label: 'checking with the loop', color: COLORS.loop, points: rows.map((r) => ({ x: r.width, y: r.loop })) },
    { label: 'checking in JavaScript', color: COLORS.tool, points: rows.map((r) => ({ x: r.width, y: r.tool })) },
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
                : `${SAMPLE} sums per width, each judged twice — once against the true answer, once against a corrupted one`}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] text-slate-400">
                the same checker, scored two ways
              </div>
              <LineChart series={trapSeries} width={430} height={190} yLabel="%" />
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-400">
                <b>discriminating power</b> — accepts-a-truth minus accepts-a-lie, by how the check
                is done
              </div>
              <LineChart series={powerSeries} width={430} height={190} yLabel="%" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500">digits in each number →</div>
        </>
      )}
    </>
  )

  if (embed) return <div className="space-y-3">{body}</div>

  return (
    <div className="space-y-4">
      <SectionIntro
        title="The verifier's budget"
        papers={[
          { title: 'Hallucination Stations: On Some Basic Limitations of Transformer-Based Language Models', url: 'https://arxiv.org/abs/2507.07505' },
          { title: 'The Expressive Power of Transformers with Chain of Thought', url: 'https://arxiv.org/abs/2310.07923' },
        ]}
      >
        Checking an answer is not automatically easier than producing one. The{' '}
        {BUNDLES.adder.paramsLabel}-parameter adder is shown a sum and a claimed answer and asked
        whether to accept it. It has no way to judge except to work the sum out again — on the
        same budget it had the first time. What happens next is a trap worth recognising, because
        it is exactly how an AI reviewer fails in production.
      </SectionIntro>

      {body}

      <div className="max-w-3xl space-y-2 text-[12px] leading-relaxed text-slate-400">
        <p>
          <b>The left chart is the trap.</b> The grey line is the metric people reach for first:
          how often did the checker catch a wrong answer? It is{' '}
          <b className="text-slate-300">100% at every width</b>. On that number alone this is a
          flawless reviewer, and it stays flawless as the problem gets harder — which should be
          the first clue that something is off.
        </p>
        <p>
          The green line is the other half. As the sums widen, the checker stops accepting{' '}
          <em>correct</em> answers too, because its own recomputation no longer matches them
          either. It has not become strict. It has started saying no to everything, and a checker
          that says no to everything catches every error while being worth precisely nothing.
        </p>
        <p>
          <b>So measure the gap, not the catch rate.</b> The right chart plots how differently
          each method treats a true claim and a false one — the only part of a verdict that
          carries information. Checking in one pass has almost none from the start. Checking by
          writing the working out has some, briefly, and loses it. Checking with the harness loop
          keeps it, because that budget grows with the problem. JavaScript comparing against the
          real sum is exact at every width and costs the model nothing at all.
        </p>
        <p>
          <b>What this means for building things.</b> The obvious way to make an AI system
          trustworthy is to have a second model review the first. This is the argument against
          relying on it: the reviewer is bounded the same way the author was, its natural method is
          to re-derive the answer, and on a hard enough problem it fails in the same place — while
          still returning a fluent, confident verdict. A review by another model is not
          independent review, and its error-catch rate will look excellent while it does this.
          Trust has to come from something that actually runs, with effort that scales to the
          problem: the test suite, the type checker, the solver, the tool. That is what the{' '}
          <a className="text-sky-400 hover:underline" href="./harness.html?section=robust">
            harness does when it validates a tool call
          </a>{' '}
          and what the{' '}
          <a className="text-sky-400 hover:underline" href="./capstone.html?section=play">
            tic-tac-toe check layer
          </a>{' '}
          does when it rejects an illegal move. Neither asks a model for an opinion.
        </p>
        <p className="text-slate-500">
          Method, stated plainly: this model does not emit a yes or a no, because it was never
          trained to. "Accepted" means its own answer matched the claim, which is what checking by
          re-computation costs a bounded model and is the only check it can actually perform.
          Wrong claims are made by flipping one digit of the true answer. {SAMPLE} sums per width,
          from a fixed seed, so each point moves in steps of {(100 / SAMPLE).toFixed(1)}%. Where
          the working would not fit in the model's {trainer?.model.cfg.contextLen ?? 96}-character
          window, that method is left unplotted rather than scored as a failure — see{' '}
          <a className="text-sky-400 hover:underline" href="./lab.html?tab=what-fits">
            what fits in one pass
          </a>
          .
        </p>
      </div>
    </div>
  )
}
