import { useEffect, useState } from 'react'
import { loadDemoModel, type LoadedModel } from './loadDemoModel'
import { MODEL_STATS, MODEL_METHOD } from '../data/modelStats'
import SiteNav from '../components/SiteNav'
import { useHashScroll } from '../components/useHashScroll'
import { Section, Callout } from './ui'
import NextTokenDemo from './NextTokenDemo'
import RandomnessDemo from './RandomnessDemo'
import ContextDemo from './ContextDemo'
import HallucinationDemo from './HallucinationDemo'
import CostsDemo from './CostsDemo'
import SpeedDemo from './SpeedDemo'
import SpecialistCostDemo from './SpecialistCostDemo'
import KVCostDemo from './KVCostDemo'
import TokenizationDemo from './TokenizationDemo'
import EmbeddingsDemo from './EmbeddingsDemo'
import RagDemo from './RagDemo'
import GraphDemo from './GraphDemo'
import QuantizationDemo from './QuantizationDemo'
import Governance from './Governance'

// Placeholder shown in a model-driven demo slot while the tiny model is still loading —
// so the lesson copy renders immediately instead of a blank page behind "loading…".
function DemoLoading() {
  return (
    <div className="my-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-800 text-[11px] text-slate-400">
      loading the model…
    </div>
  )
}

// Compact in-page contents so the ten sections read as three tiers — and signal that the
// cost/inference sections are an optional deeper module for decision-makers.
const TOC: { group: string; items: [string, string][] }[] = [
  { group: 'The basics', items: [['prediction', 'Prediction'], ['randomness', 'Randomness'], ['context', 'Context & memory'], ['hallucination', 'Hallucination']] },
  { group: 'Under the hood', items: [['tokens', 'Tokens'], ['embeddings', 'Embeddings'], ['rag', 'Retrieval (RAG)']] },
  { group: 'For decision-makers', items: [['cost', 'Cost'], ['inference', 'Inference economics'], ['governance', 'What to ask']] },
]
function ContentsNav() {
  return (
    <nav className="mx-auto max-w-2xl px-4 py-4" aria-label="Contents">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">On this page</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {TOC.map((g) => (
            <div key={g.group}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</div>
              <ul className="mt-0.5 space-y-0.5">
                {g.items.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-[12px] text-sky-400 hover:underline">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function ExplainApp() {
  const [loaded, setLoaded] = useState<LoadedModel | null>(null)
  const [status, setStatus] = useState('loading the model…')

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

  // Deep-link scroll (e.g. explain.html#cost) — re-runs once the model loads so it lands
  // correctly after the §1–4 demos hydrate and the layout above the target settles.
  useHashScroll(loaded)

  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <SiteNav current="explain">
        <span className="hidden text-xs text-slate-400 sm:inline">AI, explained simply</span>
      </SiteNav>

      {/* hero / intro */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg leading-relaxed text-slate-200">
          A real AI language model, running entirely in your browser — explained without any maths, for
          people who <span className="text-fuchsia-300">use</span> these tools at work.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          Every demo below runs on a tiny model that predicts the next <em>character</em> of text.
          Production models predict the next <em>token</em> — a word-piece rather than a character — after
          training on a large slice of the internet. The prediction mechanism is{' '}
          <strong>the same mechanism</strong>. So are the failures it produces.
        </p>
        <p className="mt-3 text-[11px] text-slate-400">running on: {status}</p>
        {loaded?.source.includes('three-skill') && (
          <details className="group mt-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5">
            <summary className="cursor-pointer select-none list-none text-[12px] text-slate-400 hover:text-slate-200 [&::-webkit-details-marker]:hidden">
              <span className="mr-1 font-mono text-slate-400 group-open:hidden">+</span>
              <span className="mr-1 hidden font-mono text-slate-400 group-open:inline">−</span>
              how this model was trained, and how the {MODEL_STATS.sortAccuracy}% was measured
            </summary>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
              {MODEL_STATS.paramsLabel} parameters, trained in about {MODEL_STATS.minutes} minutes of{' '}
              {MODEL_STATS.runtime} on a {MODEL_STATS.machine}. It does three things: write poems, sort
              numbers, and "solve" equations. It sorts unseen lists ~{MODEL_STATS.sortAccuracy}% of the
              time. No data centre, no GPU.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{MODEL_METHOD}</p>
          </details>
        )}
      </div>

      <>
          <ContentsNav />
          <Section n={1} id="prediction" title="It predicts the next piece of text">
            <p>
              A language model estimates how likely <em>every</em> possible next piece of text is, then
              picks one. It looks nothing up. It predicts what tends to follow.
            </p>
            {loaded ? <NextTokenDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              A fluent answer is a prediction. It is not a fact and not a citation. Authority comes from
              the source you check it against.
            </Callout>
          </Section>

          <Section n={2} id="randomness" title="Why the same question gives different answers">
            <p>
              Sampling adds randomness to the choice of next piece. The <em>temperature</em> setting
              controls how much. Low temperature repeats. High temperature varies.
            </p>
            {loaded ? <RandomnessDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              For output that must be consistent or auditable — policy answers, figures, standard
              wording — set a low temperature, record the model version, and keep the output. Two runs of
              the same prompt do not have to match.
            </Callout>
          </Section>

          <Section n={3} id="context" title="What it can 'see' — and why it forgets">
            <p>
              A model reads a fixed amount of text at once: the <em>context window</em>. Inside it,
              attention decides how much each earlier piece influences the next choice. Outside it, text
              has no influence at all.
            </p>
            {loaded ? <ContextDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              A long contract, policy or filing can exceed the window and be truncated. A clause that
              falls outside the window has no effect on the answer. Put critical instructions and facts
              first. Split long documents into chunks.
            </Callout>
          </Section>

          <Section n={4} id="hallucination" title="Why it sometimes makes things up">
            <p>
              The model predicts plausible text. With nothing real to draw on, it still predicts
              plausible text. That output is a hallucination.
            </p>
            <details className="rounded border border-slate-700 bg-slate-900/50 p-2 text-[12px] text-slate-300">
              <summary className="cursor-pointer select-none text-slate-400">
                Predict first: this model was trained on equations like <span className="font-mono">7x + 2 = 16</span>.
                Will it solve a new one correctly?
              </summary>
              <p className="mt-2">
                No. It learned the <em>shape</em> of the working and writes fluent steps. The arithmetic is
                invented. A model this size cannot compute.
              </p>
            </details>
            {loaded ? <HallucinationDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              Every fact, number, quotation, citation and name is unverified until checked against a
              source. Legal references, financial figures, names and dates carry the highest risk.
            </Callout>
          </Section>

          <Section n={5} id="tokens" title="How it reads text — tokens, and why letters trip it up">
            <p>
              A model does not read letters. Text is cut into <em>tokens</em> before the model sees it,
              and production models use <strong>subword chunks</strong>. Counting letters, spelling and
              digit-by-digit arithmetic fail for that reason.
            </p>
            <TokenizationDemo />
            <Callout>
              A model that miscounts letters never received the letters. It received chunks. For
              letter-exact or digit-exact work — codes, IDs, string edits — give it a tool or verify the
              output.
            </Callout>
          </Section>

          <Section n={6} id="embeddings" title="Words as coordinates — how meaning becomes maths">
            <p>
              Every token becomes a list of numbers: an <em>embedding</em>. Tokens with similar meaning
              end up close together. Nothing defines "king" for the model; its position is learned from
              the words it appears near. Search, recommendation and the retrieval below all run on this.
            </p>
            <EmbeddingsDemo />
            <Callout>
              Semantic search finds a document that shares <em>no words</em> with the query, because it
              matches position rather than spelling. Bias in the training text becomes bias in the
              geometry. The associations are learned, not designed.
            </Callout>
          </Section>

          <Section n={7} id="rag" title="Giving it real facts — retrieval (RAG)">
            <p>
              A model knows what was in its training text. It fills the gaps with plausible invention
              (§4). <strong>Retrieval</strong> closes the gap: find the relevant text, put it in the
              context, and the answer comes from a source you can quote. This is RAG, and it is how a
              chatbot answers from <em>your</em> documents.
            </p>
            <RagDemo />
            <p className="mt-4">
              <strong>Two shapes of context.</strong> Retrieval above finds the most relevant{' '}
              <em>chunk of text</em>. Context can also be <em>structured</em>: facts and the connections
              between them, as a <strong>knowledge graph</strong>. A graph answers relational questions by
              walking connections across several hops, which chunk retrieval cannot compose. It also
              stores <strong>memory</strong> that can be updated in place:
            </p>
            <GraphDemo />
            <Callout>
              For anything private or current — your policies, this quarter's numbers, a specific
              contract — retrieval that quotes the source beats a larger model recalling from training.
              Ask a vendor where the answer comes from and whether the system can show the passage. For
              questions spanning many connected facts, ask whether they use a knowledge graph, and how
              memory is stored and updated.
            </Callout>
          </Section>

          <div className="mx-auto max-w-2xl border-t border-slate-800 px-4 pt-6">
            <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 px-3 py-2 text-[12px] text-sky-100">
              <span className="font-semibold text-sky-300">For product &amp; technical decision-makers</span> —
              the last three sections cover what these systems cost to run and what to ask before buying or
              building.
            </div>
          </div>

          <Section n={8} id="cost" title="What it costs to run">
            <p>
              You pay by the <em>token</em> — a few characters of text — for what goes in
              <strong> and</strong> what comes out. Cost scales with document length, answer length,
              re-runs, and the capability of the model.
            </p>
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-[12px] leading-relaxed">
              <strong>How big is "capable"?</strong> Model size is counted in <em>parameters</em>, the
              adjustable numbers it learns. The gap spans six orders of magnitude:
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                <li>
                  <strong>JabberLM</strong> (this page's built-in model): about{' '}
                  <strong>90 thousand</strong> parameters.
                </li>
                <li>
                  <strong>GPT-2</strong> (2019): 124 million to 1.5 billion — roughly{' '}
                  <strong>1,000–17,000×</strong> bigger.
                </li>
                <li>
                  The model behind the <strong>first ChatGPT</strong> (2022): about 175 billion —{' '}
                  roughly <strong>2 million×</strong> bigger.
                </li>
                <li>
                  <strong>Today's frontier models</strong>: sizes aren't published, but estimates run
                  from hundreds of billions to a few <strong>trillion</strong> — and many now use{' '}
                  <a className="text-sky-300 underline" href="./lab.html?tab=mixture-of-experts">
                    Mixture-of-Experts
                  </a>{' '}
                  so only a slice runs on each token.
                </li>
              </ul>
            </div>
            <CostsDemo />
            <p className="mt-4">
              <strong>Bigger models are also slower.</strong> The same work at three sizes, timed in your
              browser:
            </p>
            <SpeedDemo />
            <Callout>
              Forecast from token volume. Manage by outcome. Track input, output, caching, retries, tool
              calls and human rework per workflow, and measure cost per{' '}
              <strong>successfully completed task</strong> rather than per request. Spend accumulates on
              summarising and repeatedly querying large documents. A more capable model costs several times
              more per token. Pick the smallest model that clears the bar.
            </Callout>
          </Section>

          <Section n={9} id="inference" title="Inference economics — the same answer can cost very different amounts">
            <p>
              Two levers move the bill more than the headline price per token:{' '}
              <strong>which model</strong> runs a task, and <strong>how the context is handled</strong>{' '}
              (the KV cache).
            </p>
            <p className="mt-3 font-semibold text-slate-200">1. Run the smallest model that does the job.</p>
            <SpecialistCostDemo />
            <p className="mt-4 font-semibold text-slate-200">2. Don't pay to re-read the context every step.</p>
            <KVCostDemo />
            <p className="mt-4 font-semibold text-slate-200">3. Shrink the weights themselves.</p>
            <QuantizationDemo />
            <Callout>
              A token you do not recompute costs nothing. For high-volume tasks, compare a small
              fine-tuned or distilled model against a large generalist. Cache long prompts you reuse.
              Output tokens cost more than input tokens, so terse answers are cheaper than long ones.
            </Callout>
          </Section>

          <Section n={10} id="governance" title="What you can't see, and questions to ask">
            <Governance />
          </Section>

          <footer className="mx-auto max-w-2xl border-t border-slate-800 px-4 py-8 text-[11px] text-slate-400">
            The maths — attention, training, gradients — is in the{' '}
            <a className="text-sky-400 hover:underline" href="./">
              playground
            </a>
            . Built by{' '}
            <a
              className="text-sky-400 hover:underline"
              href="https://www.linkedin.com/in/greg-dickason-633920/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Greg Dickason
            </a>
            .
          </footer>
        </>
    </div>
  )
}
