import { useMemo, useState } from 'react'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'
import { CALIBRATION, CAL_EXAMPLES, readSpread, type AgentKey } from '../data/calibration'

/**
 * Calibration — does the confidence number mean anything?
 *
 * Opens on cached FULL sweeps of all 4,520 positions for BOTH agents
 * (`src/data/calibration.ts`, kept honest by `src/data/__tests__/calibration.test.ts`), so both
 * curves are on screen immediately rather than filling in over seconds of in-browser measurement.
 *
 * Two measures are plotted, because 46.8% of positions have more than one optimal move:
 *   - the probability on the single top pick, which tests whether the number RANKS;
 *   - the probability summed over every optimal move, which tests whether it is a PROBABILITY.
 *
 * The per-board panel shows both for one position at a time, which is where it lands: 34% on the
 * move it picked, 99.8% across the three moves that were equally good. Switching the agent to the
 * undertrained one on that panel shows the nine numbers not moving between positions at all.
 */

const COLORS = {
  top: '#fbbf24',
  mass: '#34d399',
  ideal: '#64748b',
  bar: '#a78bfa',
  optimal: '#34d399',
}

const btn = 'rounded px-2 py-0.5 text-[11px]'

function Cell({
  i,
  pct,
  optimal,
  isTop,
  mark,
}: {
  i: number
  pct: number
  optimal: boolean
  isTop: boolean
  mark: string
}) {
  const taken = mark === 'X' || mark === 'O'
  return (
    <div
      className="relative flex h-12 w-12 items-center justify-center rounded border text-[11px]"
      style={{
        borderColor: optimal ? COLORS.optimal : '#334155',
        background: taken ? '#0f172a' : `rgba(167,139,250,${Math.min(0.55, pct / 100)})`,
      }}
      title={
        taken
          ? `cell ${i}: already ${mark}`
          : `cell ${i}: ${pct.toFixed(1)}%${optimal ? ' · one of the best moves' : ''}`
      }
    >
      {taken ? (
        <span className="text-[15px] font-bold text-slate-500">{mark}</span>
      ) : (
        <>
          <span className={isTop ? 'font-bold text-white' : 'text-slate-200'}>{pct.toFixed(0)}</span>
          {isTop && <span className="absolute right-0.5 top-0 text-[9px] text-sky-300">pick</span>}
        </>
      )}
    </div>
  )
}

export default function CalibrationSection({ embed = false }: { embed?: boolean }) {
  const [agent, setAgent] = useState<AgentKey>('strong')
  const [exIdx, setExIdx] = useState(0)

  const cur = CALIBRATION[agent]
  const ex = CAL_EXAMPLES[exIdx]
  const probs = ex[agent]
  const spread = useMemo(() => readSpread(probs, ex.optimal), [probs, ex])

  const reliability = [
    {
      label: 'an honest number would sit on this line',
      color: COLORS.ideal,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    },
    { label: 'its top pick only', color: COLORS.top, points: cur.top.map((b) => ({ x: b.conf, y: b.opt })) },
    {
      label: 'all the equally-good moves together',
      color: COLORS.mass,
      points: cur.mass.map((b) => ({ x: b.conf, y: b.opt })),
    },
  ]

  const maxN = Math.max(...cur.top.map((b) => b.n))
  const flat = cur.max - cur.min < 1

  // The embed is the worked position and the headline tiles — one self-contained idea that needs
  // no surrounding prose. The two aggregate charts stay on the lab page, where there is room to
  // explain what a reliability diagram is.
  const picker = (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">agent:</span>
        <button
          className={btn + (agent === 'weak' ? ' bg-fuchsia-700 text-white' : ' bg-slate-800 text-slate-300')}
          onClick={() => setAgent('weak')}
        >
          undertrained
        </button>
        <button
          className={btn + (agent === 'strong' ? ' bg-fuchsia-700 text-white' : ' bg-slate-800 text-slate-300')}
          onClick={() => setAgent('strong')}
        >
          well-trained
        </button>
        <span className="text-slate-500">all {cur.n.toLocaleString()} positions</span>
      </div>

      {/* one position at a time — where the two measures become obvious */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400">a position where {ex.label}:</span>
          {CAL_EXAMPLES.map((e, i) => (
            <button
              key={e.board}
              onClick={() => setExIdx(i)}
              className={btn + (i === exIdx ? ' bg-slate-700 text-slate-100' : ' bg-slate-800 text-slate-400')}
            >
              {e.optimal.length} best {e.optimal.length === 1 ? 'move' : 'moves'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="grid w-fit grid-cols-3 gap-1">
              {Array.from({ length: 9 }, (_, i) => (
                <Cell
                  key={i}
                  i={i}
                  pct={probs[i]}
                  optimal={ex.optimal.includes(i)}
                  isTop={i === spread.top}
                  mark={ex.board[i]}
                />
              ))}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              green outline = an optimal move · {ex.toMove} to play
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[11px] text-slate-400">confidence in the move it picked</div>
              <div className="font-mono text-[20px]" style={{ color: COLORS.top }}>
                {spread.topPct.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">
                across all {ex.optimal.length} equally-good {ex.optimal.length === 1 ? 'move' : 'moves'}
              </div>
              <div className="font-mono text-[20px]" style={{ color: COLORS.mass }}>
                {spread.massPct.toFixed(1)}%
              </div>
            </div>
          </div>

          <p className="max-w-xs text-[11px] leading-relaxed text-slate-400">
            {agent === 'weak' ? (
              <>
                Switch between the three positions and watch these nine numbers. They do not change.
                This agent returns the same distribution whatever is on the board, so its confidence
                could not track the position even in principle.
              </>
            ) : ex.optimal.length === 1 ? (
              <>
                Only one move works here, and the agent puts nearly everything on it. Both readings
                agree, because there is nothing for the probability to be split across.
              </>
            ) : (
              <>
                Both numbers describe the same model on the same board. It looks unsure if you read
                only its top pick, and almost certain if you read everything it rates as best. Which
                one you use decides whether this model looks calibrated.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
          <div className="text-[11px] text-slate-400">the number ranged over</div>
          <div className="mt-0.5 font-mono text-[13px] text-slate-200">
            {cur.min.toFixed(flat ? 4 : 1)}% – {cur.max.toFixed(flat ? 4 : 1)}%
          </div>
          <div className="text-[11px] text-slate-500">
            {flat ? 'the same number every time' : 'it varies with the position'}
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
          <div className="text-[11px] text-slate-400">said when right / when wrong</div>
          <div className="mt-0.5 font-mono text-[13px] text-slate-200">
            {cur.saidOpt.toFixed(1)}% / {cur.saidNot.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500">
            {Math.abs(cur.saidOpt - cur.saidNot) < 1 ? 'it cannot tell you' : 'lower before a mistake'}
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
          <div className="text-[11px] text-slate-400">optimal / legal overall</div>
          <div className="mt-0.5 font-mono text-[13px] text-slate-200">
            {cur.pctOpt.toFixed(1)}% / {cur.pctLegal.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500">{cur.tiePct}% of positions have a tie</div>
        </div>
      </div>

    </>
  )

  const charts = (
    <>
      <div>
        <div className="mb-1 text-[11px] text-slate-400">
          <b>Does it vary?</b> Positions per confidence band. One bar means one answer, whatever the
          board.
        </div>
        <div className="flex items-end gap-0.5" style={{ height: '4rem' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const b = cur.top.find((x) => x.lo === i * 10)
            const h = b ? Math.max(3, Math.round((100 * b.n) / maxN)) : 0
            return (
              <div key={i} className="flex-1" title={`${i * 10}–${i * 10 + 10}%: ${b?.n ?? 0} positions`}>
                <div
                  style={{ height: `${h}%`, background: h ? COLORS.bar : 'transparent' }}
                  className="w-full rounded-t"
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>0%</span>
          <span>stated confidence →</span>
          <span>100%</span>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] text-slate-400">
          <b>Does it mean what it says?</b> Above the grey line is under-confident, below it is
          over-confident. Both coloured lines are the same model, read the two ways.
        </div>
        <LineChart series={reliability} width={460} height={200} yLabel="% actually optimal" />
        <div className="text-[11px] text-slate-500">stated confidence →</div>
      </div>
    </>
  )

  if (embed)
    return (
      <div className="space-y-3">
        {picker}
        <p className="text-[11px] leading-relaxed text-slate-400">
          A tic-tac-toe agent that picks one of nine cells in a single pass, with a confidence on
          each. Switch agents and positions, and watch what the confidence number does.
        </p>
      </div>
    )

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Calibration — does the confidence number mean anything?"
        papers={[
          { title: 'On Calibration of Modern Neural Networks (Guo et al.)', url: 'https://arxiv.org/abs/1706.04599' },
          { title: 'Verified Uncertainty Calibration (Kumar et al.)', url: 'https://arxiv.org/abs/1909.10155' },
        ]}
      >
        The capstone agent shows a confidence for the cell it picks, and it is easy to read that as
        a measurement. This asks what nobody asks of such a number: <b>when it says 30%, is it right
        30% of the time?</b> Reading a model's scores over a fixed set of allowed answers is how
        multiple-choice benchmarks are scored and how a growing number of products work, and in all
        of them this number does the work that correctness cannot.
      </SectionIntro>

      {picker}
      {charts}

      <div className="max-w-3xl space-y-2 text-[12px] leading-relaxed text-slate-400">
        <p>
          <b className="text-slate-300">The undertrained agent's confidence is a constant.</b> Over
          every position it ranges from <b>17.4158%</b> to <b>17.4225%</b>. It returns the same nine
          numbers whatever the board, which the panel above shows directly: switch between three
          completely different positions and nothing moves. It is not a poor estimate. It is not an
          estimate — and it sat on screen for weeks looking exactly like one.
        </p>
        <p>
          <b className="text-slate-300">The well-trained agent's varies, and ranks.</b> It says{' '}
          {CALIBRATION.strong.saidOpt}% when the move it is about to play is optimal and{' '}
          {CALIBRATION.strong.saidNot}% when it is not. That gap is worth something: route the
          low-confidence cases elsewhere and you catch most of the mistakes.
        </p>
        <p>
          <b className="text-slate-300">Whether it is calibrated depends on how you score it.</b>{' '}
          {CALIBRATION.strong.tiePct}% of positions have more than one optimal move. Read only the
          top pick and a model splitting evenly across three good moves can never show more than
          about a third, so it looks badly under-confident — the amber line, far above the diagonal.
          Read the probability across every move that was equally good and the same model sits close
          to honest, slightly over-confident at the low end. Same weights, same positions, opposite
          verdicts.
        </p>
        <p>
          So "calibrated" is three questions. <b>Does the number vary at all?</b>{' '}
          <b>Does it rank — higher when the answer is more likely right?</b>{' '}
          <b>Does 0.9 mean nine times in ten?</b> A model can pass any and fail the others, they
          need different measurements, and the last two come apart the moment more than one answer
          is acceptable. Routing a ticket, grading a risk, choosing a next action: several answers
          are usually defensible, so that is the normal case rather than a quirk of a board game.
        </p>
        <p>
          <b className="text-slate-300">What the number is for.</b> A confidence score earns its
          place by letting software decide when to act alone: above a threshold act, below it ask a
          person, and raise the bar when the decision matters more. Both failures above break that.
          A confidence that never varies cannot carry a threshold, because every decision falls on
          the same side of any line you draw. A confidence whose apparent honesty flips with the
          scoring rule leaves you unable to say where the line belongs.
        </p>
        <p>
          <b className="text-slate-300">Why this has to be trained for deliberately.</b> A model
          like this one is trained with cross-entropy, which is a <em>proper scoring rule</em>: the
          only way to minimise it is to report the probabilities you actually believe. Claim 0.99 on
          something that happens half the time and it punishes you; hedge everything at 0.5 and it
          punishes you too. Preference tuning does not have that property. The model is scored by
          another model trained to predict which answer a human rater preferred, and a rater can see
          fluency and confidence far more easily than correctness — so the reward is highest for
          what <em>looks</em> right, and a capable optimiser finds the gap. Calibration measured
          worse after post-training than before it, as reported for GPT-4.
        </p>
        <p>
          This pairs with{' '}
          <a className="text-sky-400 hover:underline" href="./lab.html?tab=verifiers-budget">
            the verifier's budget
          </a>
          , where a checker's error-catch rate reads 100% and is worth nothing. Both are the same
          caution: a number that looks like evidence has to be checked against outcomes before it
          counts as any.
        </p>
        <p className="text-slate-500">
          Method: the agent's own decision, read as the capstone reads it — one forward pass, a
          softmax over the nine cell tokens. "Optimal" comes from the same minimax oracle it was
          trained against. Figures are the full sweep of all {CALIBRATION.strong.n.toLocaleString()}{' '}
          non-terminal positions, cached in{' '}
          <span className="font-mono">src/data/calibration.ts</span> and re-checked against the
          shipped weights by a unit test, so a retrain fails the build rather than leaving a stale
          chart.
        </p>
      </div>
    </div>
  )
}
