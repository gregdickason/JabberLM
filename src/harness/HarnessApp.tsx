import { useEffect, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { Section, Callout } from '../explain/ui'
import { AgentLoopDemo, FlakyDemo, InjectionDemo, ToolCallDemo, loadHarnessModel } from './demos'
import AdderSection from './AdderSection'
import SiteNav from '../components/SiteNav'
import { useHashScroll } from '../components/useHashScroll'
import { useSectionRoute } from '../lib/useSectionRoute'

// Short, stable section ids for deep links. The long heading slugs these replaced are still
// honoured (the capstone and the guide published some of them), see HARNESS_ALIASES.
const SECTIONS = ['tools', 'robust', 'loop', 'injection', 'reasoning-loop', 'where-this-leaves-you'] as const
const HARNESS_ALIASES = {
  'ask-it-to-do-something-watch-the-harness-work': 'tools',
  'why-harnesses-need-to-be-robust': 'robust',
  'loop-it-and-its-an-agent': 'loop',
  'the-catch-prompt-injection': 'injection',
}

// Garbled outputs a flaky tiny model might produce — what the harness must cope
// with. Each shows a different failure mode (and one that still parses despite junk).
export default function HarnessApp() {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the tool-calling model…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const t = await loadHarnessModel()
      if (cancelled) return
      if (t) {
        setTrainer(t)
        setStatus('')
      } else {
        setStatus('could not load the tool-calling model (public/harness-model.json)')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ?section= deep links, with every legacy heading-slug anchor still resolving.
  useSectionRoute(SECTIONS, trainer, HARNESS_ALIASES)
  useHashScroll(trainer) // deep-link scroll once the model loads and sections render


  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <SiteNav current="harness">
        <span className="hidden text-xs text-slate-400 sm:inline">Tool use &amp; a tiny harness</span>
      </SiteNav>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg leading-relaxed text-slate-200">
          A <span className="text-sky-300">harness</span> is the code <em>around</em> a model that lets
          it use <b>tools</b>. The model on this page does not compute answers. It emits a{' '}
          <b>tool call</b>. A JavaScript harness parses that call, runs a real function, and returns the
          result.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          The same model that <b>hallucinates arithmetic</b> elsewhere on this site is <b>exact</b> here,
          because it does no arithmetic. It emits{' '}
          <code className="font-mono text-slate-300">sum(6&nbsp;9&nbsp;2)</code>. JavaScript computes{' '}
          <code className="font-mono text-slate-300">17</code>.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          There is a rule underneath this whole page. <b>A model does the same amount of work on every
          question, however hard the question is.</b> One pass through the model costs a fixed number of
          operations, set by the size of the input and the size of the model, and the difficulty of what
          you asked does not enter into it. So anything that needs more computation than one pass can
          hold has to be broken into pieces the model can do, or handed to something whose effort grows
          with the problem. That is what a harness is for.
        </p>
        <p className="mt-3 text-[11px] text-slate-400">{status || 'model loaded — try an instruction below'}</p>
      </div>

      {trainer && (
        <>
          <Section n={1} id="tools" title="Ask it to do something — watch the harness work">
            <ToolCallDemo trainer={trainer} />
            <Callout>
              A model's answer is a guess. A tool's output is a computation. Parsing the intent, calling
              a real tool and using the tool's result makes the execution authoritative for anything a
              tool does: maths, lookups, code, search. The hallucination is removed from that step only.
              The model can still misread the intent, and the tool's data, permissions and inputs can be
              wrong or hostile (see the prompt-injection section below). Reliability comes from the engineering around the call.
            </Callout>
          </Section>

          <Section n={2} id="robust" title="Why harnesses need to be robust">
            <p>
              The model is small and its output is sometimes a <b>malformed</b> call. The harness
              validates before it dispatches. Each click feeds it a different failure — these four are
              written by hand rather than sampled, so you can see each failure mode on demand:
            </p>
            <div className="mt-2">
              <FlakyDemo />
            </div>
            <Callout>
              Parsing, validating, retrying, sandboxing calls and managing what the model sees is{' '}
              <b>harness engineering</b>. Most of an agent's reliability comes from there rather than from
              the weights.
            </Callout>
          </Section>

          <Section n={3} id="loop" title="Loop it — and it's an agent">
            <p>
              A single call is <b>function calling</b>. An <b>agent</b> adds the <b>loop</b>: the harness
              runs the tool, <b>writes the result back into the context</b>, and the model reads it to
              choose the <em>next</em> call, until it emits <code>done</code>. Give it a two-step job:
            </p>
            <AgentLoopDemo trainer={trainer} />
            <Callout>
              An agent is observe → act → observe → act → finish. The loop is identical at 88 thousand
              parameters and at a trillion. The scaffolding is what turns a next-token predictor into a
              system that completes tasks.
            </Callout>
          </Section>

          <Section n={4} id="injection" title="The catch — prompt injection">
            <p>
              The loop writes the tool's <b>output</b> back into the context with{' '}
              <b>no boundary between data and instructions</b>. Whoever controls what a tool{' '}
              <em>returns</em> — a fetched web page, a retrieved document — controls text the model reads
              as its <em>next command</em>. The first tool's result below is attacker-controlled:
            </p>
            <InjectionDemo trainer={trainer} />
            <Callout>
              An agent cannot separate <b>data</b> from <b>instructions</b>. Tool output is an attack
              surface, like user input. Typed, untrusted output stops a planted <em>instruction</em> — the
              tool switch above — and cannot make a poisoned <em>value</em> true.{' '}
              <b>Authorise consequential actions</b> — a payment, a deletion, an email — instead of letting
              tool output trigger them. Models trained on natural language are easier to hijack this way
              than this one. The mechanism is the same.
            </Callout>

          </Section>

          <AdderSection n={5} />

          <Section n={6} id="where-this-leaves-you" title="Where this leaves you">
            <p>
              A harness does three separable jobs, all three on this page: it <b>checked</b> what the
              model produced, it <b>ran the tool</b> the model asked for, and in the adder it{' '}
              <b>held the state</b> the model could not. Most systems need all three.
            </p>
            <p>
              The fixed-work rule from the top of the page decides where each job has to live. Checking
              belongs outside the model for the same reason computing does: verifying an answer is
              often at least as much work as producing it, and a second model asked to review the first
              has exactly the same fixed budget and exactly the same blind spot. A review by another
              model is not independent review. Trust comes from something that actually runs — the
              tool, the test, the simulation — and whose effort scales with the problem, not from a
              model's report of its own confidence, and not from another model's.
            </p>
            <p>
              Handing work off is not a trick to get round the model. For a reader with a fixed budget,
              the result of running the code is new information it could not have produced by thinking
              harder. The{' '}
              <a className="text-sky-400 hover:underline" href="./lab.html">lab</a> is where the rule
              becomes measurable on this site's own models.
            </p>
            <footer className="mx-auto max-w-2xl border-t border-slate-800 px-0 py-6 text-[11px] text-slate-400">
              This tool-caller was trained in the browser's own engine on{' '}
              <code>instruction =&gt; tool(args) = result</code> lines (single- and two-step). See the{' '}
              <a className="text-sky-400 hover:underline" href="./learn.html">how-it-works</a> page for the
              model itself, or the <a className="text-sky-400 hover:underline" href="./">playground</a> to
              train one.
            </footer>
          </Section>
        </>
      )}
    </div>
  )
}
