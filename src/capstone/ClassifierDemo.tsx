import { useEffect, useMemo, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { deserialize, type SavedModel } from '../engine/persist'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { CATEGORIES, askPrompt, catIndex, demoMessages, type Message } from '../data/packing'
import { MEASURED } from '../data/modelStats'
import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'

/**
 * A grocery-order message classifier, and the escalation rule around it.
 *
 * This is the shape being sold as a decision model: one forward pass, eight allowed answers, a
 * probability on each, no prose. The demo exists to show the two halves of that working together
 * — the routing, and the threshold that decides when the routing is not trusted.
 *
 * The messages below the line are held out. Five of them are deliberately ambiguous, sitting
 * across two categories, and the design intent was that the model would be unsure about those
 * and the threshold would send them to a person.
 *
 * MEASURED, AND IT IS NOT WHAT HAPPENS. Three of the five come back at 77% or more on one of the
 * two readings, so at a sensible threshold they are routed automatically and nobody sees them.
 * The confidence tracks how familiar the WORDING is, not how genuinely two-sided the message is:
 * "the milk was warm when it arrived" contains "arrived", which saturates the delivery examples,
 * so it answers delivery time at 98% and never weighs the other reading at all.
 *
 * That is the same failure as the unseen-phrasing rows at the bottom, and it is left on the page
 * rather than tuned away, because a section arguing that a confidence threshold is a real control
 * has to show where the control stops working.
 */

/** One forward pass; softmax over the eight category tokens only. Same read as the game agent. */
function classify(model: Model, tok: CharTokenizer, text: string): number[] {
  const ids = tok.encode(askPrompt(text))
  const { logits } = model.forward(
    ids.slice(Math.max(0, ids.length - model.cfg.contextLen)),
    DEFAULT_FEATURE_FLAGS,
  )
  const V = logits.cols
  const base = (logits.rows - 1) * V
  const raw = CATEGORIES.map((c) => {
    const id = tok.stoi.get(c.code)
    return id != null ? logits.data[base + id] : -Infinity
  })
  const mx = Math.max(...raw)
  const ex = raw.map((l) => (l === -Infinity ? 0 : Math.exp(l - mx)))
  const s = ex.reduce((a, b) => a + b, 0) || 1
  return ex.map((e) => e / s)
}

const topOf = (p: number[]) => p.reduce((a, _, i) => (p[i] > p[a] ? i : a), 0)

interface Row {
  m: Message
  probs: number[]
  top: number
  conf: number
}

export default function ClassifierDemo({ embed = false }: { embed?: boolean }) {
  const [t, setT] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the classifier…')
  const [threshold, setThreshold] = useState(70)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetch(import.meta.env.BASE_URL + 'classifier-model.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        if (j) {
          setT(deserialize(j as SavedModel))
          setStatus('')
        } else setStatus('could not load the classifier (public/classifier-model.json)')
      })
      .catch(() => !cancelled && setStatus('could not load the classifier'))
    return () => {
      cancelled = true
    }
  }, [])

  const rows: Row[] = useMemo(() => {
    if (!t) return []
    return demoMessages().map((m: Message) => {
      const probs = classify(t.model, t.tok, m.text)
      const top = topOf(probs)
      return { m, probs, top, conf: 100 * probs[top] }
    })
  }, [t])

  const typedRow: Row | null = useMemo(() => {
    const clean = typed.toLowerCase().replace(/[^a-z ]/g, '').trim()
    if (!t || clean.length < 4) return null
    const probs = classify(t.model, t.tok, clean)
    const top = topOf(probs)
    return { m: { text: clean, label: 'missing' }, probs, top, conf: 100 * probs[top] }
  }, [t, typed])

  const auto = rows.filter((r) => r.conf >= threshold)
  const human = rows.filter((r) => r.conf < threshold)
  const autoWrong = auto.filter((r) => r.top !== catIndex(r.m.label))
  const ambiguousCaught = rows.filter((r) => r.m.ambiguous && r.conf < threshold).length
  const ambiguousTotal = rows.filter((r) => r.m.ambiguous).length

  function RowView({ r }: { r: Row }) {
    const escalate = r.conf < threshold
    const second = [...r.probs.keys()].sort((a, b) => r.probs[b] - r.probs[a])[1]
    return (
      <div
        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-slate-800 py-1"
        title={CATEGORIES.map((c, i) => `${c.label} ${(100 * r.probs[i]).toFixed(0)}%`).join(' · ')}
      >
        <span className="w-[13rem] shrink-0 truncate text-slate-300">{r.m.text}</span>
        <span className="font-mono" style={{ color: escalate ? '#fbbf24' : '#34d399' }}>
          {r.conf.toFixed(0)}%
        </span>
        <span className={escalate ? 'text-slate-500' : 'text-slate-300'}>
          {CATEGORIES[r.top].label}
        </span>
        {escalate ? (
          <span className="rounded border border-amber-800 px-1 text-[10px] uppercase text-amber-400">
            → a person
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">→ {CATEGORIES[r.top].desk}</span>
        )}
        {r.m.ambiguous && (
          <span className="text-[10px] text-slate-500">
            (reads two ways — a person could file it as{' '}
            {CATEGORIES[catIndex(r.top === catIndex(r.m.label) ? r.m.also! : r.m.label)].label};
            second choice {CATEGORIES[second].label} {(100 * r.probs[second]).toFixed(0)}%)
          </span>
        )}
        {r.m.novelPhrasing && (
          <span className="text-[10px] text-rose-400">
            (a phrasing it never trained on — should be {CATEGORIES[catIndex(r.m.label)].label})
            {r.top === catIndex(r.m.label) ? ' · right this time, and barely sure' : ''}
          </span>
        )}
      </div>
    )
  }

  const body = (
    <>
      {status && <p className="text-[11px] text-amber-400">{status}</p>}

      {t && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <label className="flex items-center gap-2">
              <span className="text-slate-400">act alone above</span>
              <input
                type="range"
                min={30}
                max={99}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-40"
              />
              <span className="w-10 font-mono text-slate-200">{threshold}%</span>
            </label>
            <span className="text-slate-400">
              <b className="text-emerald-300">{auto.length}</b> routed automatically ·{' '}
              <b className="text-amber-300">{human.length}</b> to a person
            </span>
            {autoWrong.length > 0 && (
              <span className="text-rose-400">
                {autoWrong.length} routed automatically and wrong
              </span>
            )}
          </div>

          <div className="font-mono text-[11px]">
            {rows.map((r, i) => (
              <RowView key={i} r={r} />
            ))}
          </div>

          <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
            <div className="mb-1 text-[11px] text-slate-400">write your own complaint:</div>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="the apples were mouldy"
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[12px] text-slate-100 placeholder:text-slate-600"
            />
            {typedRow && (
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2 font-mono text-[11px]">
                <span
                  style={{ color: typedRow.conf < threshold ? '#fbbf24' : '#34d399' }}
                  className="text-[14px]"
                >
                  {typedRow.conf.toFixed(0)}%
                </span>
                <span className="text-slate-200">{CATEGORIES[typedRow.top].label}</span>
                <span className="text-slate-500">
                  {typedRow.conf < threshold
                    ? '→ a person'
                    : `→ ${CATEGORIES[typedRow.top].desk}`}
                </span>
              </div>
            )}
            <div className="mt-1 text-[10px] text-slate-600">
              lower case letters only — it reads characters, and it only ever saw this alphabet
            </div>
          </div>
        </>
      )}
    </>
  )

  if (embed) return <div className="space-y-3">{body}</div>

  return (
    <div className="space-y-3">
      {body}
      {t && (
        <div className="max-w-3xl space-y-2 text-[11px] leading-relaxed text-slate-400">
          <p>
            Nothing here was trained on. The first eight name products the model has never seen —{' '}
            <b>melon</b>, <b>salmon</b> — in complaint wordings it has, and it gets{' '}
            <b>{MEASURED.classifier.unseenProduct}%</b> of that kind right across{' '}
            {MEASURED.classifier.nUnseenProduct} messages. That is the realistic case: your
            catalogue changes constantly, the ways people complain do not.
          </p>
          <p>
            The next five were written by hand to sit across two routes, and they are the rows to
            look at, because the model is mostly <em>not</em> unsure about them. At the threshold
            above, <b>{ambiguousCaught} of {ambiguousTotal}</b> escalate. The rest are routed
            automatically at high confidence, on one of the two readings, with nobody asked. The
            first one is the clearest: "the milk was warm when it arrived" contains{' '}
            <b>arrived</b>, a word all over the delivery examples, so it answers{' '}
            <b>delivery time at 98%</b> and never weighs the complaint being about the milk.
          </p>
          <p>
            The last two show the same thing from the other side. Their <em>phrasing</em> was held
            out — "i cannot find the bread at all" shares almost no words with any training
            wording for a missing item — and on that kind it manages{' '}
            <b>{MEASURED.classifier.unseenPhrasing}%</b> against {MEASURED.classifier.chance}% for
            guessing. One lands on the right route and one does not, and both come back under 70%,
            so both escalate. One cause under both results: at this size it is matching wording
            rather than meaning, and its confidence is a report on the wording.
          </p>
          <p>
            So the threshold is a real control and a partial one, and the two numbers say where
            the line is. On unseen products — the case it can do — it says{' '}
            <b>{MEASURED.classifier.saidWhenRight}%</b> when right and{' '}
            <b>{MEASURED.classifier.saidWhenWrong}%</b> when wrong, and thirty points of daylight
            is somewhere to put a threshold. On unseen phrasings it says{' '}
            <b>{MEASURED.classifier.saidWhenRightNovel}%</b> when right and{' '}
            <b>{MEASURED.classifier.saidWhenWrongNovel}%</b> when wrong, and there is no line that
            separates those. A confidence score sorts best exactly where the model was already
            competent, and loses its grip where you most need it to hold.
          </p>
          <p>
            Drag the slider and watch the trade run: at 99% almost everything escalates, which is
            safe and automates nothing; at 30% the ambiguous ones go through on a coin-flip. Where
            you set it is a commercial decision about the cost of being wrong. What this demo is
            for is the part that is easy to skip — setting it carefully is not the same as being
            safe, because some of what it lets through is confident and wrong.
          </p>
        </div>
      )}
    </div>
  )
}
