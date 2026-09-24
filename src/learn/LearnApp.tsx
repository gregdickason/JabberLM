import { useEffect, useMemo, useState } from 'react'
import { loadDemoModel, type LoadedModel } from '../explain/loadDemoModel'
import { Section, Callout, card } from '../explain/ui'
import { traceOf } from '../engine/generate'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { pca2 } from '../interp/pca'
import { BUNDLES, MODEL_STATS } from '../data/modelStats'
import SiteNav from '../components/SiteNav'
import { useHashScroll } from '../components/useHashScroll'
import { useSectionRoute } from '../lib/useSectionRoute'
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

// Short, stable section ids for deep links, in page order. The blog series links to these by
// name; the long heading slugs they replaced still resolve, see LEARN_ALIASES.
const SECTIONS = ['tokenize', 'embed', 'attention', 'mlp', 'logits', 'training', 'grokking', 'scale'] as const
const LEARN_ALIASES = {
  'text-becomes-numbers-tokenize': 'tokenize',
  'each-number-becomes-a-vector-embed': 'embed',
  'letting-tokens-look-at-each-other-attention': 'attention',
  'each-token-does-its-own-thinking-the-mlp': 'mlp',
  'turning-the-last-vector-into-a-guess-logits-softmax': 'logits',
  'loss-gradients-and-held-out-data': 'training',
  'grokking-the-moment-it-gets-it': 'grokking',
  'bigger-models-emergent-features-and-fine-tuning': 'scale',
}

// The same shape at three sizes (section 8). GPT-2 and GPT-3 are the last generation whose
// dimensions were published in full, so the table stops there rather than guessing.
const M = BUNDLES.multitask
const fmt = (x: number) => x.toLocaleString('en-GB')
const DIMS: { name: string; params: string; d: string; layers: string; heads: string; ctx: string }[] = [
  {
    name: 'this model',
    params: fmt(M.params),
    d: fmt(M.dModel),
    layers: fmt(M.nLayers),
    heads: fmt(M.nHeads),
    ctx: fmt(M.contextLen),
  },
  { name: 'GPT-2 small', params: '124,000,000', d: '768', layers: '12', heads: '12', ctx: '1,024' },
  { name: 'GPT-3', params: '175,000,000,000', d: '12,288', layers: '96', heads: '96', ctx: '2,048' },
]

// First mention of a term links to its glossary entry. Quiet by design: a reader who already
// knows the word should be able to read straight past it.
function Gloss({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      className="underline decoration-dotted decoration-slate-500 underline-offset-2 hover:decoration-slate-300"
      href={`./glossary.html#${id}`}
    >
      {children}
    </a>
  )
}

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

  // ?section= deep links, with every legacy heading-slug anchor still resolving.
  useSectionRoute(SECTIONS, loaded, LEARN_ALIASES)
  useHashScroll(loaded) // deep-link scroll once the model loads and sections render

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
      <SiteNav current="learn">
        <span className="hidden text-xs text-slate-400 sm:inline">How a transformer actually works</span>
      </SiteNav>

      {/* hero / intro */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg leading-relaxed text-slate-200">
          A transformer is a stack of repeated steps that turn text into a guess at the next character. This
          page follows <span className="font-mono text-fuchsia-300">one real example</span> through{' '}
          <em>every</em> step of a real model, then watches that model <em>learn</em>.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          Everything on this page is computed live by the {MODEL_STATS.paramsLabel}-parameter model that ships
          with the site. The matrices below hold its actual numbers; hover any cell to read one. The running
          example is <code className="font-mono text-slate-300">{EXAMPLE.trim()}</code>, because sorting is a task
          this model genuinely <em>learns</em> (Act 2).
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          Two kinds of number fill those grids. A <Gloss id="parameter">parameter</Gloss> is a number that
          training chose and then left in place: one cell of one weight matrix. An activation is a number
          this particular example produced on its way through. This model holds{' '}
          {fmt(MODEL_STATS.params)} parameters, and training is the whole business of nudging every one of
          them a little at a time.
        </p>
        <p className="mt-3 text-[11px] text-slate-400">running on: {status}</p>
      </div>

      {!trace || !tok || !model ? (
        <div className="px-4 pb-16 text-center text-xs text-slate-400">{status}</div>
      ) : (
        <>
          {/* ───────────────────────── ACT 1 ───────────────────────── */}
          <Act
            n={1}
            title="One token's journey"
            blurb="A single pass through the model. The same example, viewed from each stage in turn — tokenize → embed → attention → MLP → next-character guess."
          />

          <Section n={1} id="tokenize" title="Text becomes numbers (tokenize)">
            <p>
              A model reads numbers, not letters. The first step maps every character to an integer id: its row
              number in a fixed vocabulary. A <Gloss id="token">token</Gloss> here is one character. Production
              models use word-pieces by the same mechanism.
            </p>
            <Viz>
              <TokenizerView trace={trace} tok={tok} />
            </Viz>
          </Section>

          <Section n={2} id="embed" title="Each number becomes a vector (embed)">
            <p>
              Each token id looks up a learned row of numbers: a <em>vector</em>, and that row is the token's{' '}
              <Gloss id="embedding">embedding</Gloss>. Over training, characters that behave alike acquire similar
              vectors. Nothing enforces this; it comes from the data.
            </p>
            <p>
              A token's embedding is the same row of numbers wherever it turns up: the vector for{' '}
              <span className="font-mono">e</span> as the first character of a line is identical to the
              one for <span className="font-mono">e</span> as the fortieth. So by itself the grid records
              <em> what</em> the characters are and nothing about the order they came in. That is what the{' '}
              <em>position signal</em> is for — the second grid below, labelled{' '}
              <span className="font-mono">positional contribution</span>. It is another vector, added on
              top, that says <em>where</em> in the input this token sits: first, second, third. Without
              it the model would read the line as a bag of characters.
            </p>
            <p>
              That grid of vectors, plus that position signal, is the{' '}
              <Gloss id="residual-stream">residual stream</Gloss>. It is best read as a running total that each
              position carries through the model: every later step reads the total, works out a small adjustment,
              and <em>adds</em> that adjustment back in. Nothing is overwritten, which is why the grid below is
              labelled "residual stream into layer 0" — it is the opening balance, and each layer edits it in
              place. It also means every step has a straight, unobstructed path back to the first one, and that is
              largely why a deep stack can be trained at all.
            </p>
            <Viz>
              <EmbeddingView trace={trace} tok={tok} />
            </Viz>
          </Section>

          <Section n={3} id="attention" title="Letting tokens look at each other (attention)">
            <p>
              Each vector starts with no information about the others.{' '}
              <strong>
                <Gloss id="attention">Attention</Gloss>
              </strong>{' '}
              moves it. Every
              position emits a <em>query</em> ("what am I looking for") and a <em>key</em> ("what do I offer").
              Comparing them decides who reads from whom. A <em>value</em> is what passes along. These are Q, K and
              V. Attention is the <em>only</em> step where information moves <em>between</em> characters.
            </p>
            <p>
              "Comparing them" is a dot product: multiply a query by a key element by element, add the results
              up, and you have one number saying how well the two match. Every query is compared with every key,
              so a line of <span className="font-mono">n</span> characters produces an{' '}
              <span className="font-mono">n × n</span> grid of scores: the grid titled{' '}
              <span className="font-mono">scores = QKᵀ / √d</span> below, one row per query, one column per key.
            </p>
            <p>
              Three things then happen to it. First it is divided by <span className="font-mono">√d</span>, where{' '}
              <span className="font-mono">d</span> is the length of one query vector. Longer vectors put more
              terms into that sum, so their dot products grow simply for being longer; dividing by{' '}
              <span className="font-mono">√d</span> cancels the growth. Skip it and a wider model gets wilder
              scores, and the softmax that follows would dump nearly all the weight onto a single cell.
            </p>
            <p>
              Second, the <strong>causal mask</strong>. Position 5 may look at positions 0 to 5 and nothing later,
              so every cell above the diagonal has <span className="font-mono">−∞</span> added to it, which is the
              blue triangle in the <span className="font-mono">additive mask</span> grid. Two things follow. The model cannot cheat by reading the character
              it is being asked to predict. And because each position depends only on what came before it, every
              position in a line can be trained in the same pass, instead of one at a time.
            </p>
            <p>
              Third, a <Gloss id="softmax">softmax</Gloss> along each row: exponentiate each score, then divide by
              the row's total. Every row now adds up to 1, so it reads as a share — "this position takes 60% of
              what it reads from there, 30% from there". That is the{' '}
              <span className="font-mono">attention weights</span> grid. Multiply each row's weights by the
              matching value vectors and add them up, and that weighted sum is what attention hands back to the
              position: the last grid, <span className="font-mono">head output = attn · V</span>.
            </p>
            <details className="rounded border border-slate-700 bg-slate-900/50 p-2 text-[12px] text-slate-300">
              <summary className="cursor-pointer select-none text-slate-400">
                Predict first: when the model is about to output the answer, which characters should it
                look at?
              </summary>
              <p className="mt-2">
                The three digits it has to sort. In the attention-weights grid below, the brightest cells in the last
                rows sit over the input digits.
              </p>
            </details>
            <p className="mt-3">
              All of that happens several times over, side by side. A <Gloss id="head">head</Gloss> is one slice
              of the machinery: the {model.cfg.dModel} numbers in a vector are cut into {model.cfg.nHeads} slices
              of {model.cfg.dModel / model.cfg.nHeads}, each slice gets its own Q, K and V and runs its own
              attention over its own part, and the {model.cfg.nHeads} results are joined back end to end and
              passed through one more learned matrix. The dropdown below is not switching model; it is showing
              you one of {model.cfg.nHeads} attentions that all happened at once.
            </p>
            <p>
              Why slice it up rather than do one big attention? Because one attention pattern is one weighted
              average per position, and an average cannot do two jobs. A model that wants both "look at the
              character just before me" and "look back at where this phrase last appeared" would have to blend the
              two into something that does neither. Separate heads let each pattern specialise, and they do: the
              grids change shape as you move the dropdown. Further on, in the{' '}
              <a className="text-fuchsia-300 underline" href="./lab.html?tab=head-ablation">
                interpretability lab
              </a>
              , you can find the individual head a skill depends on and switch that head off.
            </p>
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
              <span className="text-slate-400">different heads learn different jobs — try a few.</span>
            </div>
            <Viz>
              <AttentionView trace={trace} tok={tok} layer={layer} head={head} />
            </Viz>
          </Section>

          <Section n={4} id="mlp" title="Each token does its own thinking (the MLP)">
            <p>
              After attention has gathered context, every position is processed on its own by a small
              two-layer network — the <Gloss id="mlp">MLP</Gloss>. It expands the vector to a wider space,
              applies a non-linear squish, and contracts it back. If attention is "talk to your neighbours",
              the MLP is "now think about what you heard".
            </p>
            <p>
              Both steps are preceded by a <strong>normalisation</strong>; the one before the MLP is the grid
              below, labelled "LN2 output". It rescales the numbers in each position's vector to have mean 0 and a spread of about 1,
              then stretches them by two learned numbers. It does no thinking. It just keeps the values going into
              a step within a sane range, so one loud position cannot swamp the rest and the gradients coming back
              stay a workable size. Read a layer as four moves, then: normalise, attend, add the result into the
              residual stream; normalise again, run the MLP, add that in too.
            </p>
            <p>
              Stack attention + MLP a few times and you have the whole model. Depth is what makes the extra
              copies worth having: layer 1 never sees raw characters, it sees whatever layer 0 wrote into the
              residual stream. So layer 0 can build something like "this position is a digit inside the list to be
              sorted" and layer 1 can work in those terms, rather than starting again from the letters. This model
              has {model.cfg.nLayers} layers. GPT-3 has 96.
            </p>
            <Viz>
              <MLPView trace={trace} tok={tok} layer={layer} />
            </Viz>
          </Section>

          <Section n={5} id="logits" title="Turning the last vector into a guess (logits → softmax)">
            <p>
              At the end, the final vector for the <em>last</em> position is scored against every character
              in the vocabulary — one <Gloss id="logit">logit</Gloss> each. <strong>Softmax</strong>, the same
              operation as in section 3, turns those scores into
              probabilities that add up to 1, and the model picks from them. That's the entire output: a
              probability for every possible next character.
            </p>
            <p>
              Worth noticing what that last matrix is doing, because it is the only part of the whole
              stack that knows a vocabulary exists. Everything before it — attention, the MLP, the{' '}
              <Gloss id="residual-stream">residual stream</Gloss> — moves vectors around and never
              mentions a character. The vocabulary only reappears at the very end, when one matrix of
              shape <em>width of the model</em> × <em>size of the vocabulary</em> turns the last vector
              into one score per character.
            </p>
            <Viz>
              <LogitsView trace={trace} tok={tok} sampled={built?.sampled} />
            </Viz>
            <Callout title="Why that one guess is the whole machine">
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
            <Callout title="Swap that last matrix and the same model is a classifier">
              Nothing in the stack requires the output to be a character. Replace the final matrix with
              one of shape <em>width of the model</em> × <em>number of categories</em> and the same
              network scores your categories instead of the alphabet. That is a{' '}
              <Gloss id="classification-head">classification head</Gloss>, and it is tiny — a few
              thousand numbers bolted onto a body of millions.
              <br />
              <br />
              Two other things change with it. It runs at <em>one</em> position rather than all of them:
              here that has to be the last one, because the causal mask from section 3 means only the
              last position has seen the whole input. And training changes to match — instead of "which
              character came next", the loss becomes "which of the categories was right". This is old
              and ordinary. It is how <Gloss id="encoder">encoder</Gloss> models like BERT have been
              used since 2018, and how multiple-choice benchmarks have been scored for years.
              <br />
              <br />
              The site's own classifier does <em>not</em> do this — it keeps the vocabulary matrix and
              reads eight of its scores. That turns out to make less difference than you would expect,
              and the place it does make a difference is{' '}
              <a className="text-sky-300 underline" href="./capstone.html?section=embedded">
                measured on the capstone
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

          <Section n={6} id="training" title="Loss, gradients, and held-out data">
            <p>
              Training shows the model an example, compares its guess to the real next character, and gets a
              single number — the <Gloss id="loss">loss</Gloss> — for how wrong it was.{' '}
              <strong>Backpropagation</strong> then works out, for every one of the model's numbers, which
              way to nudge it to make the loss a little smaller. That direction, one per parameter, is the{' '}
              <Gloss id="gradient">gradient</Gloss>. Then repeat: this model took{' '}
              {fmt(MODEL_STATS.steps)} such steps, about {MODEL_STATS.minutes} minutes of{' '}
              {MODEL_STATS.runtime} on a laptop. Real models run for months across thousands of machines, but the
              step they repeat is this step.
            </p>
            <p>
              None of that has to be taken on trust. In the{' '}
              <a className="text-sky-300 underline" href="./">
                playground
              </a>
              , <strong>⇄ Step Through</strong> walks one training step matrix by matrix, forwards and then
              backwards, on the real numbers. You see the very first gradient,{' '}
              <code className="font-mono text-slate-300">∂loss/∂logits = softmax − one-hot(target)</code> — the
              probabilities it just predicted, with 1 subtracted in the slot the right answer was in — then that
              gradient travelling back through every matrix it came through, and finally the update itself,{' '}
              <code className="font-mono text-slate-300">W_after = W_before − lr × grad</code>.
            </p>
            <p>
              A model can lower its loss by <em>memorising</em> the examples. Some data is therefore{' '}
              <Gloss id="held-out">held out</Gloss>: kept back and never trained on. Accuracy on those{' '}
              <strong>unseen</strong> cases measures what generalised rather than what was memorised.
            </p>
          </Section>

          <Section n={7} id="grokking" title="Grokking: the moment it 'gets it'">
            <p>
              Train this model on sorting and held-out accuracy stays near zero for a long time, then{' '}
              <em>leaps</em>. That late jump is what <Gloss id="grokking">grokking</Gloss> names.
              Memorisation gives way to <em>generalisation</em>: an algorithm for <em>order</em>
              rather than a lookup table. The jump on unseen lists is the evidence. The picture below is the
              mechanism: the model's 9 digit vectors, projected to 2-D, arrange themselves into a{' '}
              <strong>number line</strong>, <span className="font-mono">1…9</span> in order, unprompted.
            </p>
            <details className="rounded border border-slate-700 bg-slate-900/50 p-2 text-[12px] text-slate-300">
              <summary className="cursor-pointer select-none text-slate-400">
                Predict first: as training goes on, what shape does the held-out accuracy curve make?
              </summary>
              <p className="mt-2">
                Not a smooth climb — it sits near zero for a long time (memorising the training lists), then
                <em> suddenly leaps</em> to high accuracy once it discovers the general rule. That late,
                sharp jump is "grokking".
              </p>
            </details>
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
            <Callout title="See it happen live">
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

          <Section n={8} id="scale" title="Bigger models, emergent features, and fine-tuning">
            <p>
              Real LLMs are this exact stack — attention + MLP, repeated — just far wider and deeper, on
              whole-word tokens, trained on much of the internet. With scale, the features the model
              invents get richer and more abstract, and they aren't placed by hand: specific{' '}
              <strong>heads</strong> and neurons quietly specialise. You can find the head that does the
              sorting and switch it off in the{' '}
              <a className="text-fuchsia-300 underline" href="./lab.html?tab=head-ablation">
                interpretability lab
              </a>
              .
            </p>
            <p>
              The numbers are worth seeing next to each other, because the shape does not change with size. Only
              the counts do.
            </p>
            <div className={card + ' mt-3 overflow-x-auto'}>
              <table className="min-w-full border-collapse whitespace-nowrap text-left text-[12px] tabular-nums">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1 pr-4 font-medium">model</th>
                    <th className="py-1 pr-4 font-medium">parameters</th>
                    <th className="py-1 pr-4 font-medium">d_model</th>
                    <th className="py-1 pr-4 font-medium">layers</th>
                    <th className="py-1 pr-4 font-medium">heads</th>
                    <th className="py-1 font-medium">context</th>
                  </tr>
                </thead>
                <tbody>
                  {DIMS.map((r) => (
                    <tr key={r.name} className="border-t border-slate-800">
                      <td className="py-1 pr-4 text-slate-200">{r.name}</td>
                      <td className="py-1 pr-4 font-mono text-slate-300">{r.params}</td>
                      <td className="py-1 pr-4 font-mono text-slate-300">{r.d}</td>
                      <td className="py-1 pr-4 font-mono text-slate-300">{r.layers}</td>
                      <td className="py-1 pr-4 font-mono text-slate-300">{r.heads}</td>
                      <td className="py-1 font-mono text-slate-300">{r.ctx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Every row is the stack you have just walked through: tokens in, vectors, attention, MLP, a
              next-token guess. GPT-2 and GPT-3 are the last generation whose dimensions were published in full,
              which is why the table stops there. Nobody outside the labs knows the width, depth or head count of
              a current frontier model, and the figures quoted in the press are guesses, so there is no honest
              fourth row to add. What is safe to say is that the columns kept going up and the shape stayed the
              same.
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
              far cheaper in memory and time, and enough to teach a new style or task. You can watch an adapter
              learn, and flip it on and off over a frozen model, in the{' '}
              <a className="text-sky-300 underline" href="./lab.html?tab=lora-fine-tuning">
                lab
              </a>
              .
            </p>
            <Callout title="The whole arc, in one paragraph">
              That's the whole arc: text → vectors → attention + MLP → a next-character guess; trained by
              loss and gradients until concepts <em>grok</em>; scaled up until rich features emerge; and
              adapted cheaply with fine-tuning. Now go{' '}
              <a className="text-sky-300 underline" href="./">
                poke the real thing
              </a>
              .
            </Callout>
          </Section>

          <footer className="mx-auto max-w-2xl border-t border-slate-800 px-4 py-8 text-[11px] text-slate-400">
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
