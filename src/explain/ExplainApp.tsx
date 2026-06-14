import { useEffect, useState } from 'react'
import { loadDemoModel, type LoadedModel } from './loadDemoModel'
import { Section, Callout } from './ui'
import NextTokenDemo from './NextTokenDemo'
import RandomnessDemo from './RandomnessDemo'
import ContextDemo from './ContextDemo'
import HallucinationDemo from './HallucinationDemo'
import CostsDemo from './CostsDemo'
import Governance from './Governance'

export default function ExplainApp() {
  const [loaded, setLoaded] = useState<LoadedModel | null>(null)
  const [status, setStatus] = useState('loading the demo model…')

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
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 bg-slate-900/60 px-4 py-2 font-mono">
        <h1 className="text-base font-bold text-fuchsia-300">JabberLM · AI explained simply</h1>
        <a className="text-xs text-sky-400 hover:underline sm:ml-auto" href="./">
          Technical playground →
        </a>
        <a className="text-xs text-fuchsia-300 hover:underline" href="./lab.html">
          Interpretability lab ↗
        </a>
      </header>

      {/* hero / intro */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg leading-relaxed text-slate-200">
          A real AI language model, running entirely in your browser — explained without any maths, for
          people who <span className="text-fuchsia-300">use</span> these tools at work.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          Everything below is driven by a tiny model that predicts the next <em>character</em> of text.
          The large models you use at work do the very same thing with whole words, trained on a huge
          slice of the internet — but the mechanics, and the catches, are identical. You can poke every
          demo yourself.
        </p>
        <p className="mt-3 text-[11px] text-slate-500">running on: {status}</p>
      </div>

      {!loaded ? (
        <div className="px-4 pb-16 text-center text-xs text-slate-500">{status}</div>
      ) : (
        <>
          <Section n={1} title="It predicts the next piece of text">
            <p>
              At heart, a language model is very advanced autocomplete. Given the text so far, it
              estimates how likely <em>every</em> possible next piece of text is, then picks one. It
              isn't looking anything up — it's predicting what tends to come next.
            </p>
            <NextTokenDemo trainer={loaded.trainer} />
            <Callout>
              A fluent, confident answer is a prediction, not a fact or a citation. It's excellent for a
              first draft — a clause, a summary, a memo — but the authority has to come from you checking
              it.
            </Callout>
          </Section>

          <Section n={2} title="Why the same question gives different answers">
            <p>
              Models usually add a little randomness when choosing the next piece, controlled by a
              setting called <em>temperature</em>. Turn it down for consistency; turn it up for variety.
            </p>
            <RandomnessDemo trainer={loaded.trainer} />
            <Callout>
              For anything that must be consistent or auditable — policy answers, figures, standard
              wording — use a low temperature, record the model version, and keep the output. Never
              assume two runs of the same prompt will match.
            </Callout>
          </Section>

          <Section n={3} title="What it can 'see' — and why it forgets">
            <p>
              A model only reads a limited amount of text at once: its <em>context window</em>. When it
              chooses the next piece it leans more on some earlier parts than others (its "attention").
            </p>
            <ContextDemo trainer={loaded.trainer} />
            <Callout>
              Long contracts, policies, or filings can exceed the window or get truncated, so a key
              clause buried deep can simply be missed. Put the critical instruction and facts up front,
              and break very long documents into chunks.
            </Callout>
          </Section>

          <Section n={4} title="Why it sometimes makes things up">
            <p>
              Because it always predicts plausible-looking text, a model will produce a confident answer
              even when it has nothing real to go on. That's a "hallucination".
            </p>
            <HallucinationDemo trainer={loaded.trainer} />
            <Callout>
              Treat every fact, number, quotation, citation, and case name as unverified until you've
              checked the source. The risk is highest exactly where it matters most — legal references,
              financial figures, names and dates.
            </Callout>
          </Section>

          <Section n={5} title="What it costs to run">
            <p>
              You pay by the <em>token</em> — roughly a few characters of text — for what goes in
              <strong> and</strong> what comes out. Cost scales with document length, answer length, how
              often you re-run, and how capable a model you choose.
            </p>
            <CostsDemo />
            <Callout>
              Budget by tokens, not by "questions". Summarising or repeatedly querying large documents is
              where spend accumulates; a more capable model can cost several times more per token. Pick
              the smallest model that does the job.
            </Callout>
          </Section>

          <Section n={6} title="What you can't see, and questions to ask">
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
      )}
    </div>
  )
}
