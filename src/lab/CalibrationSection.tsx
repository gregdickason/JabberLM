import { useEffect, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { deserialize, type SavedModel } from '../engine/persist'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'
import { allDecisionStates, legalMoves, optimalMoves, ticPrompt, type Board } from '../data/tictactoe'
import { MEASURED } from '../data/modelStats'
import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'

/**
 * Calibration — does the confidence number mean anything?
 *
 * ── A correction worth reading before editing this file ─────────────────────────────────────
 * The first version of this tab scored the model's TOP-1 probability against "was the top-1 move
 * in the optimal set", concluded the strong model was badly under-confident, and published it.
 * That was a measurement artifact. 46.8% of the 4,520 states have more than one optimal move
 * (mean 1.96), so a model that correctly spreads its probability over three equally-good moves
 * shows ~0.33 and is scored right — which looks like under-confidence and is not.
 *
 * Both measures are now on screen, because which one is correct depends on which claim is being
 * tested, and that turns out to be the whole lesson:
 *   - "higher confidence means higher accuracy" is a RANKING claim; top-1 tests it fine.
 *   - "0.9 means nine times in ten" is a PROBABILITY claim; only the mass on the optimal set
 *     tests it, and by that measure this model is roughly honest rather than wildly shy.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The capstone agent already shows a confidence per cell. This asks the question nobody asks of
 * such a number: when it says 30%, is it right 30% of the time?
 *
 * Three separate properties get bundled into the word "calibrated", and the two shipped models
 * separate them cleanly, which is why this tab has two charts rather than one:
 *
 *   1. Does the number VARY?   The undertrained model's is a constant — 17.4158% to 17.4225%
 *                              across all 4,520 boards. It cannot carry information it does not
 *                              contain, and it is displayed exactly as if it did.
 *   2. Does it RANK?           The well-trained model says 71.5% when its move is optimal and
 *                              48.1% when it is not. That gap is real and useful.
 *   3. Does it MEAN 30%?       No. At a stated 30% the well-trained model is optimal ~96% of the
 *                              time. It ranks well and is badly under-confident.
 *
 * A model can pass any subset of those. Only the third is what "calibrated" literally claims.
 */

type Sel = 'weak' | 'strong'

// Sweeping all 4,520 states takes ~17s per model in a browser. A deterministic stride keeps it
// a few seconds and reproducible; the full-sweep figures are in MEASURED and quoted in the copy.
const STRIDE = 5
const BUCKETS = 10

const COLORS = {
  optimal: '#34d399',
  legal: '#60a5fa',
  ideal: '#64748b',
  bar: '#a78bfa',
}

interface Bucket {
  lo: number
  n: number
  meanConf: number
  pctOptimal: number
  pctLegal: number
}
interface Sweep {
  buckets: Bucket[]
  massBuckets: Bucket[]
  tiePct: number
  n: number
  min: number
  max: number
  mean: number
  saidWhenOptimal: number
  saidWhenNot: number
  pctOptimal: number
  pctLegal: number
}

/** The agent's own decision, read the way the capstone reads it: one pass, nine options. */
function readTop(model: Model, tok: CharTokenizer, board: Board): { top: number; conf: number; probs: number[] } {
  const ids = tok.encode(ticPrompt(board))
  const { logits } = model.forward(
    ids.slice(Math.max(0, ids.length - model.cfg.contextLen)),
    DEFAULT_FEATURE_FLAGS,
  )
  const V = logits.cols
  const base = (logits.rows - 1) * V
  const cell = Array.from({ length: 9 }, (_, c) => {
    const id = tok.stoi.get(String(c))
    return id != null ? logits.data[base + id] : -Infinity
  })
  const mx = Math.max(...cell)
  const exps = cell.map((l) => (l === -Infinity ? 0 : Math.exp(l - mx)))
  const sum = exps.reduce((a, b) => a + b, 0) || 1
  const probs = exps.map((e) => e / sum)
  let top = 0
  for (let c = 1; c < 9; c++) if (probs[c] > probs[top]) top = c
  return { top, conf: probs[top], probs }
}

const btn = 'rounded px-2 py-0.5 text-[11px]'

export default function CalibrationSection() {
  const [weak, setWeak] = useState<Trainer | null>(null)
  const [strong, setStrong] = useState<Trainer | null>(null)
  const [sel, setSel] = useState<Sel>('weak')
  const [status, setStatus] = useState('loading both agents…')
  const [sweeps, setSweeps] = useState<Partial<Record<Sel, Sweep>>>({})
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = (f: string) =>
      fetch(import.meta.env.BASE_URL + f)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j ? deserialize(j as SavedModel) : null))
        .catch(() => null)
    void Promise.all([load('tictactoe-model.json'), load('tictactoe-strong-model.json')]).then(
      ([wk, st]) => {
        if (cancelled) return
        setWeak(wk)
        setStrong(st)
        setStatus(wk || st ? '' : 'could not load the agents')
      },
    )
    return () => {
      cancelled = true
      cancelRef.current = true
    }
  }, [])

  async function sweep(which: Sel, t: Trainer) {
    setBusy(true)
    cancelRef.current = false
    const states = allDecisionStates().filter((_, i) => i % STRIDE === 0)
    const cnt = new Array(BUCKETS).fill(0)
    const confSum = new Array(BUCKETS).fill(0)
    const optHit = new Array(BUCKETS).fill(0)
    const legHit = new Array(BUCKETS).fill(0)
    // second measure: how much probability the model put on the optimal SET, which is the only
    // one that can test "0.9 means nine times in ten" when several answers are equally right
    const mCnt = new Array(BUCKETS).fill(0)
    const mSum = new Array(BUCKETS).fill(0)
    const mHit = new Array(BUCKETS).fill(0)
    let ties = 0
    let min = 1
    let max = 0
    let mean = 0
    let cOpt = 0
    let nOpt = 0
    let cNot = 0
    let nNot = 0
    let totOpt = 0
    let totLeg = 0

    const CHUNK = 60
    for (let i = 0; i < states.length; i += CHUNK) {
      if (cancelRef.current) return
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      for (const b of states.slice(i, i + CHUNK)) {
        const { top, conf, probs } = readTop(t.model, t.tok, b)
        const opt = optimalMoves(b)
        if (opt.length > 1) ties++
        const isOpt = opt.includes(top)
        const mass = opt.reduce((a, c) => a + probs[c], 0)
        const mi = Math.min(BUCKETS - 1, Math.floor(mass * BUCKETS))
        mCnt[mi]++
        mSum[mi] += mass
        if (isOpt) mHit[mi]++
        const isLegal = legalMoves(b).includes(top)
        const bi = Math.min(BUCKETS - 1, Math.floor(conf * BUCKETS))
        cnt[bi]++
        confSum[bi] += conf
        if (isOpt) {
          optHit[bi]++
          totOpt++
          cOpt += conf
          nOpt++
        } else {
          cNot += conf
          nNot++
        }
        if (isLegal) {
          legHit[bi]++
          totLeg++
        }
        min = Math.min(min, conf)
        max = Math.max(max, conf)
        mean += conf
      }
    }

    const n = states.length
    const mk = (c: number[], s: number[], h: number[]): Bucket[] => {
      const out: Bucket[] = []
      for (let i = 0; i < BUCKETS; i++) {
        if (!c[i]) continue
        out.push({
          lo: (100 * i) / BUCKETS,
          n: c[i],
          meanConf: (100 * s[i]) / c[i],
          pctOptimal: (100 * h[i]) / c[i],
          pctLegal: (100 * (legHit[i] ?? 0)) / c[i],
        })
      }
      return out
    }
    const buckets = mk(cnt, confSum, optHit)
    const massBuckets = mk(mCnt, mSum, mHit)
    setSweeps((s) => ({
      ...s,
      [which]: {
        buckets,
        massBuckets,
        tiePct: (100 * ties) / n,
        n,
        min: 100 * min,
        max: 100 * max,
        mean: (100 * mean) / n,
        saidWhenOptimal: (100 * cOpt) / (nOpt || 1),
        saidWhenNot: (100 * cNot) / (nNot || 1),
        pctOptimal: (100 * totOpt) / n,
        pctLegal: (100 * totLeg) / n,
      } as Sweep,
    }))
    setBusy(false)
  }

  // sweep whichever model is selected, once, when it is first shown
  useEffect(() => {
    const t = sel === 'weak' ? weak : strong
    if (t && !sweeps[sel] && !busy) void sweep(sel, t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, weak, strong])

  const cur = sweeps[sel]
  const t = sel === 'weak' ? weak : strong

  const reliability = cur
    ? [
        {
          label: 'if the number meant what it says',
          color: COLORS.ideal,
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 100 },
          ],
        },
        {
          label: 'scored on its top pick only',
          color: COLORS.optimal,
          points: cur.buckets.map((b) => ({ x: b.meanConf, y: b.pctOptimal })),
        },
        {
          label: 'scored on all the moves that were equally good',
          color: COLORS.legal,
          points: cur.massBuckets.map((b) => ({ x: b.meanConf, y: b.pctOptimal })),
        },
      ]
    : []

  const maxBucket = cur ? Math.max(...cur.buckets.map((b) => b.n)) : 1

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Calibration — does the confidence number mean anything?"
        papers={[
          { title: 'On Calibration of Modern Neural Networks (Guo et al.)', url: 'https://arxiv.org/abs/1706.04599' },
          { title: 'Verified Uncertainty Calibration (Kumar et al.)', url: 'https://arxiv.org/abs/1909.10155' },
        ]}
      >
        The capstone agent shows you a confidence for the cell it picks, and it is easy to read that
        as a measurement. This asks the question nobody asks of such a number:{' '}
        <b>when it says 30%, is it right 30% of the time?</b> The two shipped agents answer very
        differently, and neither answer is the obvious one.
      </SectionIntro>

      {status && <p className="text-[11px] text-amber-400">{status}</p>}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">agent:</span>
        <button
          className={btn + (sel === 'weak' ? ' bg-fuchsia-700 text-white' : ' bg-slate-800 text-slate-300')}
          onClick={() => setSel('weak')}
          disabled={!weak}
        >
          undertrained
        </button>
        <button
          className={btn + (sel === 'strong' ? ' bg-fuchsia-700 text-white' : ' bg-slate-800 text-slate-300')}
          onClick={() => setSel('strong')}
          disabled={!strong}
        >
          well-trained
        </button>
        <span className="text-slate-400">
          {busy ? 'measuring…' : cur ? `${cur.n} boards, every ${STRIDE}th of the 4,520` : t ? 'ready' : ''}
        </span>
      </div>

      {cur && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
              <div className="text-[11px] text-slate-400">the number ranged over</div>
              <div className="mt-0.5 font-mono text-[13px] text-slate-200">
                {cur.min.toFixed(1)}% – {cur.max.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">
                {cur.max - cur.min < 1 ? 'it barely moves at all' : 'it varies with the board'}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
              <div className="text-[11px] text-slate-400">said, when it was right / wrong</div>
              <div className="mt-0.5 font-mono text-[13px] text-slate-200">
                {cur.saidWhenOptimal.toFixed(1)}% / {cur.saidWhenNot.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">
                {Math.abs(cur.saidWhenOptimal - cur.saidWhenNot) < 1
                  ? 'no difference — it cannot tell you'
                  : 'lower when it is about to be wrong'}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
              <div className="text-[11px] text-slate-400">said on average / actually optimal</div>
              <div className="mt-0.5 font-mono text-[13px] text-slate-200">
                {cur.mean.toFixed(1)}% / {cur.pctOptimal.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">
                {cur.mean > cur.pctOptimal ? 'over-confident overall' : 'under-confident overall'}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] text-slate-400">
              <b>Does it vary at all?</b> How many boards fell in each confidence band. A single bar
              means the number is the same whatever it is looking at.
            </div>
            <div className="flex items-end gap-0.5" style={{ height: '5rem' }}>
              {Array.from({ length: BUCKETS }, (_, i) => {
                const b = cur.buckets.find((x) => Math.floor(x.lo / (100 / BUCKETS)) === i)
                const h = b ? Math.max(2, Math.round((100 * b.n) / maxBucket)) : 0
                return (
                  <div key={i} className="flex-1" title={`${i * 10}–${i * 10 + 10}%: ${b?.n ?? 0} boards`}>
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
              <b>Does it mean what it says?</b> Grey is what a perfectly honest number would look
              like: above it is under-confident, below it is over-confident. The two coloured lines
              are the <em>same model</em>, scored two different ways — and the gap between them is
              the trap this tab is really about.
            </div>
            <LineChart series={reliability} width={460} height={200} yLabel="% actually" />
            <div className="text-[11px] text-slate-500">stated confidence →</div>
          </div>
        </>
      )}

      <div className="max-w-3xl space-y-2 text-[12px] leading-relaxed text-slate-400">
        <p>
          <b className="text-slate-300">The undertrained agent's confidence is a constant.</b> Over
          all {MEASURED.ttt.states.toLocaleString()} board positions it ranges from{' '}
          <b>17.4158%</b> to <b>17.4225%</b> — a spread of{' '}
          {MEASURED.ttt.confidence.weak.spreadPp} of a percentage point. It says the same thing
          about every board it has ever been shown, including boards where its chosen cell is
          already occupied. It is not a wrong measurement. It is not a measurement: the number
          contains no information about the position, and it is displayed exactly as though it did.
        </p>
        <p>
          <b className="text-slate-300">The well-trained agent's does vary, and it ranks.</b> It
          says {MEASURED.ttt.confidence.strong.saidWhenOptimal}% when the move it is about to play
          is optimal and {MEASURED.ttt.confidence.strong.saidWhenNot}% when it is not. That gap is
          genuinely useful: you could route the low-confidence cases to something else and catch
          most of the mistakes.
        </p>
        <p>
          <b className="text-slate-300">Whether it "means what it says" depends on how you score
          it, and that is the part worth slowing down for.</b> Read only the top pick and this
          model looks wildly shy: at a stated 30% it plays an optimal move about 96% of the time.
          But <b>{MEASURED.ttt.confidence.ties.multiOptimalPct}% of positions have more than one
          optimal move</b> — {MEASURED.ttt.confidence.ties.meanOptimalMoves} on average. A model
          that correctly spreads its belief over three equally good moves shows 0.33 on each and is
          then marked right, which manufactures the appearance of under-confidence out of nothing.
          Score the probability it put on <em>all</em> the equally-good moves and the same model is
          roughly honest, and slightly over-confident at the bottom end.
        </p>
        <p>
          This tab got that wrong on the first attempt, published it, and had it caught in review.
          It is left visible rather than quietly fixed because the mistake is the more useful
          artifact: the model did not change, the scoring rule did, and the verdict flipped from
          badly broken to broadly fine.
        </p>
        <p>
          So "calibrated" is really three questions. <b>Does the number vary at all?</b>{' '}
          <b>Does it rank — higher when the answer is more likely right?</b>{' '}
          <b>Does 0.9 literally mean nine times in ten?</b> A model can pass any and fail the
          others, they need different measurements, and the second and third come apart hard the
          moment more than one answer is acceptable — which is the normal case in real work.
          Routing a support ticket, grading a risk, choosing a next action: several answers are
          usually defensible. Worth asking which of the three a vendor means, and how they scored
          it when several answers were right.
        </p>
        <p>
          The same question, asked of the language model elsewhere on this site, gives a third
          answer. On held-out sorts the three-skill model is{' '}
          <b>{MEASURED.multitaskSortConfidence.whenRight}%</b> confident when it gets the answer
          right and <b>{MEASURED.multitaskSortConfidence.whenWrong}%</b> confident when it gets it
          wrong. There is a signal in there, and it is far too small to act on — the failure you
          actually meet is a model that is 94% sure and mistaken.
        </p>
        <p>
          This tab pairs with{' '}
          <a className="text-sky-400 hover:underline" href="./lab.html?tab=verifiers-budget">
            the verifier's budget
          </a>
          , which shows a checker whose error-catch rate reads 100% and is worth nothing. Both are
          the same caution: a number that looks like evidence has to be checked against outcomes
          before it counts as any.
        </p>
        <p className="text-slate-500">
          Method: the agent's own decision, read as the capstone reads it — one forward pass, a
          softmax over the nine cell tokens, the probability of its top pick. "Optimal" and "legal"
          come from the same minimax oracle the agent was trained against. On screen this sweeps
          every {STRIDE}th of the {MEASURED.ttt.states.toLocaleString()} reachable positions to keep
          it quick; the figures quoted in the text are from the full sweep.
        </p>
      </div>
    </div>
  )
}
