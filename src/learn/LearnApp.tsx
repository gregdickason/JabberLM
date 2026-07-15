import { useEffect, useMemo, useState } from 'react'
import { loadDemoModel, type LoadedModel } from '../explain/loadDemoModel'
import { Section, Callout, card } from '../explain/ui'
import { traceOf } from '../engine/generate'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { pca2 } from '../interp/pca'
import { MODEL_STATS } from '../data/modelStats'
import type { Trace } from '../engine/trace'

import TokenizerView from '../components/inspector/TokenizerView'
import EmbeddingView from '../components/inspector/EmbeddingView'
import AttentionView from '../components/inspector/AttentionView'
import MLPView from '../components/inspector/MLPView'
import LogitsView from '../components/inspector/LogitsView'
import Scatter from '../viz/Scatter'

// The running example we follow through the whole forward pass. Sorting is the
// site's spine — the model genuinely learned an *algorithm*, so it's the most
// honest thing to point at when we later say "it learned a concept".
const EXAMPLE = 'sort 3 1 2 => '
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// A wide inspector view can overflow on a phone — let it scroll horizontally
// inside a calm card instead of blowing out the page.
function Viz({ children }: { children: React.ReactNode }) {
  return (
    <div className={card + ' mt-3 overflow-x-auto'}>
      <div className="min-w-fit">{children}</div>
    </div>
  )
}

// A small "ACT n" divider so the three-act structure reads at a glance.
function Act({ n, title, blurb }: { n: number; title: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <div className="rounded-lg border border-fuchsia-900/60 bg-fuchsia-950/20 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-400">Act {n}</div>
        <h2 className="mt-0.5 text-xl font-bold text-slate-100">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{blurb}</p>
      </div>
    </div>
  )
}

export default function LearnApp() {
  const [loaded, setLoaded] = useState<LoadedModel | null>(null)
  const [status, setStatus] = useState('loading the model…')
  const [layer, setLayer] = useState(0)
  const [head, setHead] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const m = await loadDemoModel()
      if (cancelled) return
      if (m) {
        setLoaded(m)
        setStatus(m.source)
      } else {
        setStatus('could not load a model')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // One forward pass over the running example — every Act-1 view reads from this
  // single Trace, so the learner follows one example all the way through.
  const built = useMemo(() => {
    if (!loaded) return null
    const trainer = loaded.trainer
    const ids = trainer.tok.encode(EXAMPLE)
    const { trace } = traceOf(trainer.model, DEFAULT_FEATURE_FLAGS, ids.length ? ids : [0])
    // the model's top next-character pick, to highlight in the logits view
    const seq = trace.tokenIds.length
    const vocab = trace.logits.cols
    const lastProbs = trace.probs.data.subarray((seq - 1) * vocab, seq * vocab)
    let sampled = 0
    for (let i = 1; i < vocab; i++) if (lastProbs[i] > lastProbs[sampled]) sampled = i
    return { trace, sampled, trainer }
  }, [loaded])

  // The digit "number line": project the 9 digit-token embeddings to 2-D. In a
  // model that has grokked sorting they line up in order — a real picture of a
  // learned concept, computed live from the loaded model (no training needed).
  const numberLine = useMemo(() => {
    if (!loaded) return null
    const { model, tok } = loaded.trainer
    const dM = model.cfg.dModel
    const pairs = DIGITS.map((d) => ({ d, id: tok.stoi.get(d) })).filter(
      (p): p is { d: string; id: number } => p.id != null,
    )
    if (pairs.length < 2) return null
    const emb = pairs.map((p) => Array.from(model.tokenEmbed.data.subarray(p.id * dM, (p.id + 1) * dM)))
    return { points: pca2(emb), labels: pairs.map((p) => p.d) }
  }, [loaded])

  const trace: Trace | null = built?.trace ?? null
  const tok = built?.trainer.tok
  const model = built?.trainer.model

  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 bg-slate-900/60 px-4 py-2 font-mono">
        <h1 className="text-base font-bold text-sky-300">JabberLM · How a transformer actually works</h1>
        <a className="text-xs text-emerald-300 hover:underline sm:ml-auto" href="./explain.html">
          New to AI? →
        </a>
        <a className="text-xs text-sky-400 hover:underline" href="./">
          Playground →
        </a>
        <a className="text-xs text-sky-300 hover:underline" href="./harness.html">
          Tool use →
        </a>
        <a className="text-xs text-fuchsia-300 hover:underline" href="./lab.html">
          Lab →
        </a>
      </header>

      {/* hero / intro */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg leading-relaxed text-slate-200">
          A transformer is not magic and not a database — it's a stack of simple, repeated steps that
          turn text into a guess at the next character. Here we follow{' '}
          <span className="font-mono text-fuchsia-300">one real example</span> through{' '}
          <em>every</em> step of a real (tiny) model, then watch it actually <em>learn</em>.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          No equations to memorise. Everything on this page is computed live by the same{' '}
          {MODEL_STATS.paramsLabel}-parameter model that ships with the site — the matrices below are its
          actual numbers, hover any cell to read it. We'll use one running example,{' '}
          <code className="font-mono text-slate-300">{EXAMPLE.trim()}</code>, because sorting is something
          this little model genuinely <em>learns</em> (more on that in Act 2).
        </p>
        <p className="mt-3 text-[11px] text-slate-500">running on: {status}</p>
      </div>

      {!trace || !tok || !model ? (
        <div className="px-4 pb-16 text-center text-xs text-slate-500">{status}</div>
      ) : (
        <>
          {/* ───────────────────────── ACT 1 ───────────────────────── */}
          <Act
            n={1}
            title="One token's journey"
            blurb="A single pass through the model. The same example, viewed from each stage in turn — tokenize → embed → attention → MLP → next-character guess."
          />

          <Section n={1} title="Text becomes numbers (tokenize)">
            <p>
              A model can't read letters, only numbers. So the first step is to map every character to an
              integer id — its row number in a fixed vocabulary. That's <em>all</em> a "token" is here:
              one character. (Big models use word-pieces, but the idea is identical.)
            </p>
            <Viz>
              <TokenizerView trace={trace} tok={tok} />
            </Viz>
          </Section>

          <Section n={2} title="Each number becomes a vector (embed)">
            <p>
              Each token id looks up a learned row of numbers — a <em>vector</em>. This is where meaning
              starts to live: similar characters get similar vectors. This grid of vectors (one row per
              character) is the <strong>residual stream</strong> — the train track every later step reads
              from and writes back to.
            </p>
            <Viz>
              <EmbeddingView trace={trace} tok={tok} />
            </Viz>
          </Section>

          <Section n={3} title="Letting tokens look at each other (attention)">
            <p>
              On its own, each vector knows nothing about the others. <strong>Attention</strong> fixes
              that: every position emits a <em>query</em> ("what am I looking for?") and a <em>key</em>{' '}
              ("what do I offer?"); comparing them decides who reads from whom, and a <em>value</em> is
              what actually gets passed along. That's the famous Q, K, V. Attention is the <em>only</em>{' '}
              step where information moves <em>between</em> characters.
            </p>
            <details className="rounded border border-slate-700 bg-slate-900/50 p-2 text-[12px] text-slate-300">
              <summary className="cursor-pointer select-none text-slate-400">
                Predict first: when the model is about to output the answer, which characters should it
                look at?
              </summary>
              <p className="mt-2">
                The three digits it has to sort. In the "attention weights" grid below, the brightest cells
                in the last rows tend to sit over the input digits — it's gathering the numbers it needs.
              </p>
            </details>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
              <label className="flex items-center gap-1">
                layer
                <select
                  className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-slate-100"
                  value={layer}
                  onChange={(e) => setLayer(Number(e.target.value))}
                >
                  {Array.from({ length: model.cfg.nLayers }, (_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                head
                <select
                  className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-slate-100"
                  value={head}
                  onChange={(e) => setHead(Number(e.target.value))}
                >
                  {Array.from({ length: model.cfg.nHeads }, (_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-slate-500">different heads learn different jobs — try a few.</span>
            </div>
            <Viz>
              <AttentionView trace={trace} tok={tok} layer={layer} head={head} />
            </Viz>
          </Section>

          <Section n={4} title="Each token does its own thinking (the MLP)">
            <p>
              After attention has gathered context, every position is processed on its own by a small
              two-layer network — the <strong>MLP</strong>. It expands the vector to a wider space, applies
              a non-linear squish, and contracts it back. If attention is "talk to your neighbours", the
              MLP is "now think about what you heard". Stack attention + MLP a few times and you have the
              whole model.
            </p>
            <Viz>
              <MLPView trace={trace} tok={tok} layer={layer} />
            </Viz>
          </Section>

          <Section n={5} title="Turning the last vector into a guess (logits → softmax)">
            <p>
              At the end, the final vector for the <em>last</em> position is scored against every character
              in the vocabulary — one <em>logit</em> each. <strong>Softmax</strong> turns those scores into
              probabilities that add up to 1, and the model picks from them. That's the entire output: a
              probability for every possible next character.
            </p>
            <Viz>
              <LogitsView trace={trace} tok={tok} sampled={built?.sampled} />
            </Viz>
            <Callout>
              That single guess, repeated — feed the chosen character back in and run the whole pass again —
              is how all text is generated, one character at a time. For the plain-English version of this
              idea (and what it means for trusting the output), see the{' '}
              <a className="text-sky-300 underline" href="./explain.html">
                New-to-AI overview
              </a>
              . To watch the <em>full</em> forward <strong>and</strong> backward pass at the matrix level,
              open <strong>Step Through</strong> in the{' '}
              <a className="text-sky-300 underline" href="./">
                playground
              </a>
              .
            </Callout>
          </Section>

          {/* ───────────────────────── ACT 2 ───────────────────────── */}
          <Act
            n={2}
            title="How it learns"
            blurb="Those vectors and weights start random. Training is the slow process of nudging them until the guesses get good — and, sometimes, until the model suddenly grasps the whole idea."
          />

          <Section n={6} title="Loss, gradients, and held-out data">
            <p>
              Training shows the model an example, compares its guess to the real next character, and gets a
              single number — the <strong>loss</strong> — for how wrong it was.{' '}
              <strong>Backpropagation</strong> then works out, for every one of the model's numbers, which
              way to nudge it to make the loss a little smaller. Repeat millions of times.
            </p>
            <p>
              The catch: a model can lower its loss by simply <em>memorising</em> the examples. So we hold
              back data it never trains on. If it does well on those <strong>unseen</strong> cases, it has
              learned something general — not just rote-memorised the answers.
            </p>
          </Section>

          <Section n={7} title="Grokking: the moment it 'gets it'">
            <p>
              Here's the surprise. Train this tiny model on sorting and for a long time it looks hopeless on
              unseen lists — then accuracy <em>suddenly leaps</em>. It stops memorising and grasps the
              concept of <em>order</em>. The proof is below: the model's 9 digit vectors, projected to 2-D.
              A model that has truly learned to sort arranges them into a <strong>number line</strong> —{' '}
              <span className="font-mono">1…9</span> in order — all on its own.
            </p>
            {numberLine && numberLine.points.length > 0 && (
              <Viz>
                <div className="p-2">
                  <div className="mb-1 text-[11px] text-slate-400">
                    digit embeddings → 2-D (this loaded model)
                  </div>
                  <Scatter points={numberLine.points} labels={numberLine.labels} />
                </div>
              </Viz>
            )}
            <Callout>
              The leap itself only happens <em>during</em> training, so it's worth seeing live: in the{' '}
              <a className="text-sky-300 underline" href="./">
                playground
              </a>
              , hit <strong>✨ Guide me</strong> and watch the held-out accuracy sit flat… then jump. The
              same model that groks sorting will happily "solve"{' '}
              <code className="font-mono">7x + 2 = 16</code> with confident, wrong working — some ideas are
              too hard to fit in a model this small, and it <em>hallucinates</em> instead.
            </Callout>
          </Section>

          {/* ───────────────────────── ACT 3 ───────────────────────── */}
          <Act
            n={3}
            title="Scale & practicalities"
            blurb="The same machinery, made bigger — and the levers that matter once you actually use these models."
          />

          <Section n={8} title="Bigger models, emergent features, and fine-tuning">
            <p>
              Real LLMs are this exact stack — attention + MLP, repeated — just far wider and deeper, on
              whole-word tokens, trained on much of the internet. With scale, the features the model
              invents get richer and more abstract, and they aren't placed by hand: specific{' '}
              <strong>heads</strong> and neurons quietly specialise. You can find the head that does the
              sorting and switch it off in the{' '}
              <a className="text-fuchsia-300 underline" href="./lab.html">
                interpretability lab
              </a>
              .
            </p>
            <p>
              Many of the largest models go one step further with a <strong>Mixture of Experts</strong>:
              each layer's single MLP is replaced by several expert MLPs plus a <em>gate</em> that routes
              every token to just a few of them. Attention (and its heads) stay exactly the same — only
              the MLP is split — so the model can grow its total size while only running a slice of it per
              token. The lab ships a tiny MoE you can watch route tokens and ablate experts, right beside
              the head tools.
            </p>
            <p>
              Two practical consequences. First, <strong>cost</strong>: attention compares every token with
              every other, so work grows with the <em>square</em> of the length — long documents get
              expensive fast (the{' '}
              <a className="text-sky-300 underline" href="./explain.html">
                overview
              </a>{' '}
              has a live calculator). Second, <strong>fine-tuning</strong>: retraining a giant model is
              hugely expensive, so instead you freeze it and train a tiny add-on (<strong>LoRA</strong>) —
              far cheaper in memory and time, and enough to teach a new style or task. You can do that in
              the playground and watch the adapter fill in.
            </p>
            <Callout>
              That's the whole arc: text → vectors → attention + MLP → a next-character guess; trained by
              loss and gradients until concepts <em>grok</em>; scaled up until rich features emerge; and
              adapted cheaply with fine-tuning. Now go{' '}
              <a className="text-sky-300 underline" href="./">
                poke the real thing
              </a>
              .
            </Callout>
          </Section>

          <footer className="mx-auto max-w-2xl border-t border-slate-800 px-4 py-8 text-[11px] text-slate-500">
            Built by{' '}
            <a
              className="text-sky-400 hover:underline"
              href="https://www.linkedin.com/in/greg-dickason-633920/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Greg Dickason
            </a>
            . Every number on this page is real, computed in your browser by a {MODEL_STATS.paramsLabel}
            -parameter model.
          </footer>
        </>
      )}
    </div>
  )
}
