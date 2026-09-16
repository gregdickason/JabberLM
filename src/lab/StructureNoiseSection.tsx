import { useEffect, useMemo, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_MODEL_CONFIG, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import { crossEntropy } from '../engine/ops'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'
import { ConvergenceGate } from './converged'
import { matchedCorpora } from '../data/automata'
import { JABBER_POEMS } from '../data/jabberPoems'

/**
 * Structure vs noise — what a bounded learner can extract.
 *
 * Three corpora, identical in length and alphabet. Two are produced by a deterministic
 * three-line rule; one is genuinely random. Classically they carry the same information and a
 * deterministic rule adds none. The same tiny model reads each for the same number of steps,
 * and the held-out curves come apart.
 *
 * ── The constraint that makes or breaks this demo ────────────────────────────────────────
 * To predict a cell you need its three neighbours in the PREVIOUS row, which sit about
 * `width + 1` characters earlier in the serialised text. So the context window must
 * comfortably exceed the row width, or the rule is not merely hard to learn — it is invisible,
 * and all three corpora flatten onto the noise floor together. Measured: at width 64 in a
 * 32-character window, rule 110 is indistinguishable from random (~0.77 both). At width 12 in
 * a 48-character window it separates cleanly. Do not widen ROW without widening the context.
 */

const ROW = 12 // cells per row — must stay well under TINY.contextLen (see above)
const TINY = { ...DEFAULT_MODEL_CONFIG, dModel: 24, nHeads: 2, nLayers: 2, contextLen: 48, dFF: 96 }

const CHARS = 9_000 // per corpus, identical across all runs
const HELD = 2_000 // a genuine continuation of each, never trained on
const CAP = 1_000

const COLORS = {
  r110: '#34d399', // green — compressible
  r30: '#fbbf24', // amber — deterministic, and yet
  random: '#f87171', // red — the floor
  fwd: '#60a5fa',
  rev: '#c084fc',
}

const EVAL_EVERY = 50

/** Cross-entropy on text the model never trained on. Lower means it found real structure. */
function heldOutLoss(t: Trainer, text: string, windows = 12): number {
  const ids = t.tok.encode(text)
  const L = Math.min(t.model.cfg.contextLen, ids.length - 1)
  if (L < 1) return 0
  const maxStart = ids.length - L - 1
  if (maxStart < 1) return 0
  let sum = 0
  let n = 0
  for (let i = 0; i < windows; i++) {
    const start = windows === 1 ? 0 : Math.round((maxStart * i) / (windows - 1))
    const input = ids.slice(start, start + L)
    const target = ids.slice(start + 1, start + L + 1)
    if (input.length < L || target.length < L) continue
    const { logits } = t.model.forward(input, DEFAULT_FEATURE_FLAGS)
    sum += crossEntropy(logits, target).loss.data[0]
    n++
  }
  return n ? sum / n : 0
}

/**
 * A window onto what the model is actually reading. The characters are the real ones — `0`,
 * `1` and a newline per row — with the 1s lit so the pattern is visible at a glance. Rows are
 * taken from partway in rather than from the start, because the opening rows of an automaton
 * grown from a single live cell are mostly empty and are not what the model spends its time on.
 */
function Sample({ text, color, rows = 10, from = 300 }: { text: string; color: string; rows?: number; from?: number }) {
  const lines = text.split('\n').slice(from, from + rows)
  return (
    <div className="font-mono text-[10px] leading-[1.15]">
      {lines.map((line, i) => (
        <div key={i}>
          {[...line].map((ch, j) => (
            <span key={j} style={{ color: ch === '1' ? color : '#334155' }}>
              {ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

interface Run {
  key: string
  label: string
  color: string
  trainer: Trainer
  held: string
}
interface Point {
  step: number
  held: number
}

const btn = 'rounded border px-3 py-1 text-xs'

export default function StructureNoiseSection() {
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [hist, setHist] = useState<Record<string, Point[]>>({})
  const [autoPaused, setAutoPaused] = useState<'converged' | 'cap' | null>(null)
  const [withOrder, setWithOrder] = useState(false)
  const [, force] = useState(0)

  const runsRef = useRef<Run[]>([])
  const runningRef = useRef(false)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const stepsRef = useRef(1)
  const lastEvalRef = useRef(0)
  // Plateau, not threshold: three loss curves that settle at three different levels, and the
  // random one is at its floor from the start. A shared bar would never fire.
  const gateRef = useRef(new ConvergenceGate({ mode: 'plateau', window: 4, epsilon: 0.03 }))

  const corpora = useMemo(() => matchedCorpora(CHARS, ROW, HELD), [])
  const trainCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.008 }), [])

  // Forward vs reversed needs a LARGE, non-repeating corpus. A short poem repeated to length
  // gets memorised in both directions and the effect vanishes (measured: reversed came out
  // *easier*, which was the memorisation, not the ordering). JABBER_POEMS is ~90k characters.
  const ordered = useMemo(() => {
    const fwd = JABBER_POEMS.slice(0, CHARS + HELD)
    const rev = [...JABBER_POEMS].reverse().join('').slice(0, CHARS + HELD)
    return { fwd, rev }
  }, [])

  function build(): Run[] {
    const base: Run[] = [
      { key: 'r110', label: corpora[0].label, color: COLORS.r110, trainer: new Trainer(corpora[0].train, TINY, 1337), held: corpora[0].held },
      { key: 'r30', label: corpora[1].label, color: COLORS.r30, trainer: new Trainer(corpora[1].train, TINY, 1337), held: corpora[1].held },
      { key: 'random', label: corpora[2].label, color: COLORS.random, trainer: new Trainer(corpora[2].train, TINY, 1337), held: corpora[2].held },
    ]
    if (withOrder) {
      base.push(
        { key: 'fwd', label: 'poems, forward', color: COLORS.fwd, trainer: new Trainer(ordered.fwd.slice(0, CHARS), TINY, 1337), held: ordered.fwd.slice(CHARS) },
        { key: 'rev', label: 'poems, reversed', color: COLORS.rev, trainer: new Trainer(ordered.rev.slice(0, CHARS), TINY, 1337), held: ordered.rev.slice(CHARS) },
      )
    }
    runsRef.current = base
    force((n) => n + 1)
    return base
  }

  function evalAll(runs: Run[], s: number) {
    const next: Record<string, Point[]> = {}
    for (const r of runs) next[r.key] = [{ step: s, held: heldOutLoss(r.trainer, r.held) }]
    setHist((h) => {
      const merged = { ...h }
      for (const r of runs) {
        merged[r.key] = [...(merged[r.key] ?? []), next[r.key][0]].slice(-200)
        gateRef.current.record(r.key, next[r.key][0].held)
      }
      return merged
    })
    lastEvalRef.current = s
  }

  function loop() {
    if (!runningRef.current) return
    const runs = runsRef.current.length ? runsRef.current : build()
    const n = stepsRef.current
    let ms = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      // every run takes the same steps on the same schedule — the only difference between
      // them is what they are reading
      for (const r of runs) r.trainer.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS)
      ms += performance.now() - a
      stepCountRef.current += 1
      if (stepCountRef.current - lastEvalRef.current >= EVAL_EVERY) evalAll(runs, stepCountRef.current)
      if (stepCountRef.current >= CAP) {
        runningRef.current = false
        setRunning(false)
        setAutoPaused('cap')
      } else if (gateRef.current.converged()) {
        runningRef.current = false
        setRunning(false)
        setAutoPaused('converged')
      }
      if (!runningRef.current) break
    }
    const perStep = ms / n
    const want = Math.max(1, Math.min(12, Math.round(20 / Math.max(0.2, perStep))))
    stepsRef.current = Math.max(1, Math.round(n * 0.6 + want * 0.4))
    setStep(stepCountRef.current)
    if (runningRef.current) rafRef.current = requestAnimationFrame(loop)
  }

  function play() {
    if (!runsRef.current.length) build()
    setAutoPaused(null)
    runningRef.current = true
    setRunning(true)
    rafRef.current = requestAnimationFrame(loop)
  }
  function pause() {
    runningRef.current = false
    setRunning(false)
    cancelAnimationFrame(rafRef.current)
  }
  function reset() {
    pause()
    const runs = build()
    stepCountRef.current = 0
    stepsRef.current = 1
    lastEvalRef.current = 0
    setStep(0)
    setHist({})
    gateRef.current.reset()
    setAutoPaused(null)
    evalAll(runs, 0)
  }

  // rebuild when the ordering run is toggled, so a chart never mixes two different setups
  useEffect(() => {
    reset()
    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withOrder])

  const series = (keys: string[]) =>
    runsRef.current
      .filter((r) => keys.includes(r.key))
      .map((r) => ({
        label: r.label,
        color: r.color,
        points: (hist[r.key] ?? []).map((p) => ({ x: p.step, y: p.held })),
      }))

  const latest = (k: string) => (hist[k] ?? []).at(-1)
  const trio = ['r110', 'r30', 'random']

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Structure vs noise — what a bounded learner can extract"
        papers={[
          { title: 'From Entropy to Epiplexity: Rethinking Information for Computationally Bounded Intelligence', url: 'https://arxiv.org/abs/2601.03220' },
          { title: 'Wolfram — Elementary Cellular Automata (Rule 30, Rule 110)', url: 'https://mathworld.wolfram.com/ElementaryCellularAutomaton.html' },
        ]}
      >
        Three corpora of <b>{CHARS.toLocaleString()} characters</b> each, written in nothing but{' '}
        <span className="font-mono text-slate-200">0</span>,{' '}
        <span className="font-mono text-slate-200">1</span> and a line break — you can read all
        three below before anything is trained. Two of them are produced by a deterministic rule of
        three lines; the third is coin flips. Classically all three carry the same information, and
        running a rule adds none of it. The same tiny model reads each for the same number of steps,
        and the curves come apart. What separates them is not in the data — it is what a learner{' '}
        <em>this size</em> can get out of it.
      </SectionIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!running ? (
          <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>
            ▶ {step > 0 ? 'Resume' : 'Train all three'}
          </button>
        ) : (
          <button className={btn + ' border-amber-600 bg-amber-900/40 text-amber-200'} onClick={pause}>
            ⏸ Pause
          </button>
        )}
        <button className={btn + ' border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'} onClick={reset}>
          ↺ Reset
        </button>
        <span className="text-slate-400">step {step}</span>
        {autoPaused && (
          <span className="text-emerald-300">
            {autoPaused === 'converged'
              ? '✓ settled — auto-paused (Reset to run again)'
              : 'reached step cap — paused'}
          </span>
        )}
        <label className="ml-auto flex items-center gap-1 text-slate-400">
          <input type="checkbox" checked={withOrder} onChange={(e) => setWithOrder(e.target.checked)} />
          also run the same poems forwards and backwards
        </label>
      </div>

      <p className="text-[11px] text-slate-500">
        Each training corpus is exactly {CHARS.toLocaleString()} characters over the alphabet{' '}
        <span className="font-mono text-slate-400">0 1 \n</span>, in rows of {ROW} cells. Nothing
        about the quantity of data differs between the runs. Give it a minute.
      </p>

      <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-2 text-[11px] text-slate-400">
          <b>What the model is actually reading.</b> Ten rows from partway through each corpus, in
          the characters themselves. Rule 110 has visible diagonal structure. Rule 30 and the random
          bits look much the same to the eye — and, as the curves below show, one of them is not.
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: corpora[0].label, text: corpora[0].train, color: COLORS.r110 },
            { label: corpora[1].label, text: corpora[1].train, color: COLORS.r30 },
            { label: corpora[2].label, text: corpora[2].train, color: COLORS.random },
          ].map((s) => (
            <div key={s.label}>
              <div className="mb-1 text-[11px] font-semibold" style={{ color: s.color }}>
                {s.label}
              </div>
              <Sample text={s.text} color={s.color} />
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] leading-relaxed text-slate-500">
          The first two are generated by the same three lines of code, differing only in an
          eight-bit number: each cell looks at itself and its two neighbours on the row above, and
          that trio picks the new value out of a lookup table. Rule 110 is table{' '}
          <span className="font-mono text-slate-400">01101110</span>; rule 30 is{' '}
          <span className="font-mono text-slate-400">00011110</span>. Nothing else differs. The
          third column is coin flips.
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] text-slate-400">
          <b>held-out loss</b> — measured on a continuation of each source the model never trained
          on. Lower means it found real structure. This is the honest curve: a model can memorise
          training characters from anything, so the training loss would tell you nothing.
        </div>
        <LineChart series={series(trio)} width={460} height={200} yLabel="loss" />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {runsRef.current
          .filter((r) => trio.includes(r.key))
          .map((r) => {
            const p = latest(r.key)
            return (
              <div key={r.key} className="rounded border border-slate-800 bg-slate-900/40 p-2">
                <div className="text-[11px] font-semibold" style={{ color: r.color }}>
                  {r.label}
                </div>
                <div className="mt-0.5 font-mono text-[13px] text-slate-300">
                  {p ? p.held.toFixed(3) : '—'}
                </div>
              </div>
            )
          })}
      </div>

      {withOrder && (
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            <b>the same text, one way round and the other.</b> Identical characters, identical
            count. Classically, identical information.
          </div>
          <LineChart series={series(['fwd', 'rev'])} width={460} height={180} yLabel="loss" />
        </div>
      )}

      <div className="max-w-3xl space-y-2 text-[12px] leading-relaxed text-slate-400">
        <p>
          <b style={{ color: COLORS.random }}>Random bits</b> is the floor. There is nothing to
          find, and no amount of training will move it. Read the other two against it.
        </p>
        <p>
          <b style={{ color: COLORS.r110 }}>Rule 110</b> falls well below that floor. The model
          finds the local rule and predicts the next row from the one above. Note what that does
          not mean: it has not understood the automaton, it has learned to predict it.
        </p>
        <p>
          <b style={{ color: COLORS.r30 }}>Rule 30 is the interesting one.</b> It is exactly as
          deterministic as rule 110 — three lines of code, no randomness anywhere, the same amount
          of output — and this model extracts far less from it. It lands between the other two,
          much nearer the noise floor than rule 110 does. Given a bigger model or a far longer run
          it would very likely do better, and that is the whole point: <em>how much structure is
          here</em> has no answer until you say who is looking and how long they get. The paper's
          name for the part a bounded observer can extract is{' '}
          <a className="text-sky-400 hover:underline" href="./glossary.html#epiplexity">
            epiplexity
          </a>
          ; the part it cannot is{' '}
          <a className="text-sky-400 hover:underline" href="./glossary.html#time-bounded-entropy">
            time-bounded entropy
          </a>
          . Neither is a property of the data alone.
        </p>
        {withOrder && (
          <p>
            <b>Forwards and backwards</b> makes the same point from the other side. The reversed
            text contains exactly the same characters in exactly the same quantity, and it is
            measurably harder for this model to learn. Classical information theory says ordering
            cannot matter, because a reversal is a deterministic transformation that destroys
            nothing. For a learner with a fixed budget it plainly does matter.
          </p>
        )}
        <p>
          The practical consequence is why this tab sits beside the harness pages. When a harness
          runs code, executes a query or simulates a system and hands the result back, it is not
          merely rearranging information the model already had. To a reader with a fixed budget
          that output is genuinely new — which is the argument for doing hard work outside the
          model rather than inside a longer prompt. See{' '}
          <a className="text-sky-400 hover:underline" href="./lab.html?tab=what-fits">
            what fits in one pass
          </a>
          .
        </p>
      </div>
    </div>
  )
}
