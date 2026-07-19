import { useEffect, useState } from 'react'
import { loadDemoModel, type LoadedModel } from './loadDemoModel'
import { MODEL_STATS, MODEL_METHOD } from '../data/modelStats'
import SiteNav from '../components/SiteNav'
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
import QuantizationDemo from './QuantizationDemo'
import Governance from './Governance'

// Placeholder shown in a model-driven demo slot while the tiny model is still loading —
// so the lesson copy renders immediately instead of a blank page behind "loading…".
function DemoLoading() {
  return (
    <div className="my-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-800 text-[11px] text-slate-500">
      loading the model…
    </div>
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
          Everything below is driven by a tiny model that predicts the next <em>character</em> of text.
          The large models you use at work do the very same thing with <em>tokens</em> — word-pieces rather
          than single characters (more on that below) — trained on a huge slice of the internet, running on{' '}
          <strong>the same core prediction mechanism</strong>, at vastly larger scale. The mechanics you can
          see here, and the catches they cause, carry over. You can poke every demo yourself.
        </p>
        <p className="mt-3 text-[11px] text-slate-500">running on: {status}</p>
        {loaded?.source.includes('three-skill') && (
          <>
            <p className="mt-1 text-[11px] text-slate-600">
              This built-in model — just {MODEL_STATS.paramsLabel} parameters — was trained in about{' '}
              {MODEL_STATS.minutes} minutes of {MODEL_STATS.runtime} on a {MODEL_STATS.machine} to do three
              things: write poems, sort numbers, and "solve" equations (watch the maths go wrong). It sorts
              unseen lists ~{MODEL_STATS.sortAccuracy}% of the time. No data centre, no GPU.
            </p>
            <p className="mt-1 text-[10px] text-slate-600/80">{MODEL_METHOD}</p>
          </>
        )}
      </div>

      <>
          <Section n={1} id="prediction" title="It predicts the next piece of text">
            <p>
              At heart, a language model is very advanced autocomplete. Given the text so far, it
              estimates how likely <em>every</em> possible next piece of text is, then picks one. It
              isn't looking anything up — it's predicting what tends to come next.
            </p>
            {loaded ? <NextTokenDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              A fluent, confident answer is a prediction, not a fact or a citation. It's excellent for a
              first draft — a clause, a summary, a memo — but the authority has to come from you checking
              it.
            </Callout>
          </Section>

          <Section n={2} id="randomness" title="Why the same question gives different answers">
            <p>
              Models usually add a little randomness when choosing the next piece, controlled by a
              setting called <em>temperature</em>. Turn it down for consistency; turn it up for variety.
            </p>
            {loaded ? <RandomnessDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              For anything that must be consistent or auditable — policy answers, figures, standard
              wording — use a low temperature, record the model version, and keep the output. Never
              assume two runs of the same prompt will match.
            </Callout>
          </Section>

          <Section n={3} id="context" title="What it can 'see' — and why it forgets">
            <p>
              A model only reads a limited amount of text at once: its <em>context window</em>. When it
              chooses the next piece it leans more on some earlier parts than others (its "attention").
            </p>
            {loaded ? <ContextDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              Long contracts, policies, or filings can exceed the window or get truncated, so a key
              clause buried deep can simply be missed. Put the critical instruction and facts up front,
              and break very long documents into chunks.
            </Callout>
          </Section>

          <Section n={4} id="hallucination" title="Why it sometimes makes things up">
            <p>
              Because it always predicts plausible-looking text, a model will produce a confident answer
              even when it has nothing real to go on. That's a "hallucination".
            </p>
            {loaded ? <HallucinationDemo trainer={loaded.trainer} /> : <DemoLoading />}
            <Callout>
              Treat every fact, number, quotation, citation, and case name as unverified until you've
              checked the source. The risk is highest exactly where it matters most — legal references,
              financial figures, names and dates.
            </Callout>
          </Section>

          <Section n={5} id="tokens" title="How it reads text — tokens, and why letters trip it up">
            <p>
              A model doesn't read letters. Text is first chopped into <em>tokens</em> — and real models
              use <strong>subword chunks</strong>, not single characters. That one design choice explains a
              whole class of famous failures: counting letters, spelling, and digit-by-digit arithmetic.
            </p>
            <TokenizationDemo />
            <Callout>
              When a model miscounts letters, botches a spelling, or fumbles a long number, it's often not
              "dumb" — it literally never saw the characters, only the chunks. For letter- or digit-exact
              work (codes, IDs, string edits), give it tools or verify the output; don't trust it to see
              inside a word.
            </Callout>
          </Section>

          <Section n={6} id="embeddings" title="Words as coordinates — how meaning becomes maths">
            <p>
              Before any of the above, every word is turned into a list of numbers — an{' '}
              <em>embedding</em> — positioned so that words with similar meaning sit close together. The
              model isn't told what "king" means; it places the word from the company it keeps. Search,
              recommendations, and the retrieval below all run on this one idea.
            </p>
            <EmbeddingsDemo />
            <Callout>
              This is why an AI search can find the right document even when it shares <em>no words</em> with
              your query — it matches meaning, not spelling. It's also why bias in the training text becomes
              bias in the geometry: the associations are learned, not designed.
            </Callout>
          </Section>

          <Section n={7} id="rag" title="Giving it real facts — retrieval (RAG)">
            <p>
              A model only knows what was in its training text, and it will confidently fill gaps by making
              things up (§4). The standard fix isn't a bigger model — it's <strong>retrieval</strong>: find
              the relevant text and paste it into the context, so the answer is grounded in a real source you
              can point to. This is "RAG", and it's how most business chatbots answer from <em>your</em>{' '}
              documents.
            </p>
            <RagDemo />
            <Callout>
              For anything private or current — your policies, this quarter's numbers, a specific contract —
              a retrieval system that quotes the source beats a bigger model guessing from memory. Ask any
              vendor: <em>where does the answer come from, and can it show me the passage?</em>
            </Callout>
          </Section>

          <Section n={8} id="cost" title="What it costs to run">
            <p>
              You pay by the <em>token</em> — roughly a few characters of text — for what goes in
              <strong> and</strong> what comes out. Cost scales with document length, answer length, how
              often you re-run, and how capable a model you choose.
            </p>
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-[12px] leading-relaxed">
              <strong>Just how big is "capable"?</strong> A model's size is counted in{' '}
              <em>parameters</em> — the adjustable numbers it learns. The scale gap is staggering:
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
                  <a className="text-sky-300 underline" href="./lab.html">
                    Mixture-of-Experts
                  </a>{' '}
                  so only a slice runs on each token.
                </li>
              </ul>
            </div>
            <CostsDemo />
            <p className="mt-4">
              Cost isn't the only trade-off — <strong>bigger models are also slower</strong>. Here's the
              same work at three sizes, timed live in your browser:
            </p>
            <SpeedDemo />
            <Callout>
              Budget by tokens, not by "questions". Summarising or repeatedly querying large documents is
              where spend accumulates; a more capable model can cost several times more per token — and
              answer more slowly. Pick the smallest model that does the job, and weigh a small,
              self-hosted open model where control, privacy, or predictable cost matter.
            </Callout>
          </Section>

          <Section n={9} id="inference" title="Inference economics — the same answer can cost very different amounts">
            <p>
              Two levers move the bill far more than the price-per-token headline: <strong>which model</strong>{' '}
              you run for a task, and <strong>how you handle the context</strong> (the KV cache). Both are
              becoming the main reason products are designed the way they are.
            </p>
            <p className="mt-3 font-semibold text-slate-200">1. Run the smallest model that does the job.</p>
            <SpecialistCostDemo />
            <p className="mt-4 font-semibold text-slate-200">2. Don't pay to re-read the context every step.</p>
            <KVCostDemo />
            <p className="mt-4 font-semibold text-slate-200">3. Shrink the weights themselves.</p>
            <QuantizationDemo />
            <Callout>
              The cheapest token is the one you don't recompute. For high-volume tasks, weigh a small
              fine-tuned or distilled model over a big generalist, cache long prompts you reuse, and remember
              output tokens cost more than input — so terse, well-structured answers are cheaper than rambling
              ones.
            </Callout>
          </Section>

          <Section n={10} id="governance" title="What you can't see, and questions to ask">
            <Governance />
          </Section>

          <footer className="mx-auto max-w-2xl border-t border-slate-800 px-4 py-8 text-[11px] text-slate-500">
            Want to see the actual maths — attention, training, gradients? Open the{' '}
            <a className="text-sky-400 hover:underline" href="./">
              technical playground
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
