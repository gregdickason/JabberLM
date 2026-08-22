import { useEffect, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { harnessDispatch } from './runHarness'
import { Section, Callout, card } from '../explain/ui'
import { AgentLoopDemo, InjectionDemo, ToolCallDemo, btn, loadHarnessModel } from './demos'
import AdderSection from './AdderSection'
import SiteNav from '../components/SiteNav'
import { useHashScroll } from '../components/useHashScroll'

// Garbled outputs a flaky tiny model might produce — what the harness must cope
// with. Each shows a different failure mode (and one that still parses despite junk).
const FLAKY_SAMPLES: { raw: string; note: string }[] = [
  { raw: 'max(4 1 7 = 7', note: 'dropped the closing bracket' },
  { raw: 'mxa(4 1 7) = 7', note: 'mistyped the tool name' },
  { raw: 'sum() = ', note: 'forgot the arguments' },
  { raw: 'hmm, i think max(4 1 7)?', note: 'a valid call buried in chatter — the harness still finds it' },
]

export default function HarnessApp() {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the tool-calling model…')
  const [flakyIdx, setFlakyIdx] = useState(0)
  const [flaky, setFlaky] = useState<{ raw: string; note: string; res: ReturnType<typeof harnessDispatch> } | null>(null)

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

  useHashScroll(trainer) // deep-link scroll once the model loads and sections render

  // "flaky model" demo: feed the harness a garbled model output (cycling through
  // common failure modes) and show how it copes — self-contained, no prior run needed.
  function flakyStep() {
    const s = FLAKY_SAMPLES[flakyIdx % FLAKY_SAMPLES.length]
    setFlaky({ raw: s.raw, note: s.note, res: harnessDispatch(s.raw) })
    setFlakyIdx((i) => i + 1)
  }

  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <SiteNav current="harness">
        <span className="hidden text-xs text-slate-400 sm:inline">Tool use &amp; a tiny harness</span>
      </SiteNav>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg leading-relaxed text-slate-200">
          The frontier of using AI is the <span className="text-sky-300">harness</span> — the code
          <em> around</em> the model that lets it use <b>tools</b>. Here a tiny model doesn't try to
          compute the answer; it learns to emit a <b>tool call</b>, and a little JavaScript harness parses
          it, runs a real function, and hands back the result.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          The punchline: the same tiny model that <b>hallucinates arithmetic</b> elsewhere on this site
          becomes <b>always right at maths here</b> — because it doesn't do the maths. It just says{' '}
          <code className="font-mono text-slate-300">sum(6&nbsp;9&nbsp;2)</code> and the harness computes{' '}
          <code className="font-mono text-slate-300">17</code> in plain JS.
        </p>
        <p className="mt-3 text-[11px] text-slate-500">{status || 'model loaded — try an instruction below'}</p>
      </div>

      {trainer && (
        <>
          <Section n={1} title="Ask it to do something — watch the harness work">
            <ToolCallDemo trainer={trainer} onRun={() => setFlaky(null)} />
            <Callout>
              A fluent answer from a model is a <em>guess</em>. Wrapping it in a harness — parse the intent,
              call a real tool, use the tool's result — makes the <em>execution</em> authoritative: for
              anything a tool actually does (maths, lookups, code, search), you get the tool's real answer
              instead of the model's guess. That removes the hallucination for that step — but not every risk:
              the model can still misread the intent, and the tool's data, permissions, and inputs can be
              wrong or hostile (see §4). Reliability comes from the harness engineering around the call, not
              from the wrapper alone. That's why every serious AI product is mostly harness.
            </Callout>
          </Section>

          <Section n={2} title="Why harnesses need to be robust">
            <p>
              The model is tiny and <b>flaky</b> — sometimes its output is a <b>malformed</b> call. The
              harness can't trust it blindly; it validates and recovers. Click to feed the harness some
              garbled model output and watch it cope — each click is a different failure:
            </p>
            <div className="mt-2">
              <button className={btn + ' border-amber-600 bg-amber-900/30 text-amber-200'} onClick={flakyStep}>
                Simulate a flaky model →
              </button>
            </div>
            {flaky && (
              <div className={card + ' mt-3 space-y-1.5 text-[12px]'}>
                <div>
                  <span className="text-fuchsia-300">🧠 the model emitted</span>{' '}
                  <span className="text-slate-500">({flaky.note}):</span>
                  <div className="mt-0.5 font-mono text-[13px] text-fuchsia-200">{flaky.raw}</div>
                </div>
                <div>
                  <span className="text-sky-300">⚙️ the harness:</span>{' '}
                  {flaky.res.error ? (
                    <span className="text-red-300">✗ caught it — {flaky.res.error} → it would re-prompt or fall back (no bad tool ran)</span>
                  ) : (
                    <span className="text-emerald-300">
                      ✓ found a valid call anyway: {flaky.res.parsed?.tool}([{flaky.res.parsed?.args.join(', ')}]) = {flaky.res.toolResult}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Callout>
              Parsing, validating, retrying, sandboxing tool calls, and managing what the model sees — that
              is <b>harness engineering</b>, and it's where most of the reliability of an "AI agent" actually
              comes from. An unreliable model + a robust harness = a reliable system.
            </Callout>
          </Section>

          <Section n={3} title="Loop it — and it's an agent">
            <p>
              A single call is <b>function calling</b> — the atom. An <b>agent</b> adds the <b>loop</b>: the
              harness runs the tool, <b>feeds the result back</b>, and the model reads it to decide the{' '}
              <em>next</em> call — until it says <code>done</code>. Give it a two-step job and watch the loop:
            </p>
            <AgentLoopDemo trainer={trainer} />
            <Callout>
              That's an agent: observe → act → observe → act → finish. Nothing here is special to a big
              model — it's the same loop whether the "brain" is 88 thousand parameters (this one) or a
              trillion. The scaffolding is what turns a next-token predictor into something that gets work
              done.
            </Callout>
          </Section>

          <Section n={4} title="The catch — prompt injection">
            <p>
              The loop has a dangerous blind spot: it feeds the tool's <b>output</b> straight back into the
              context, with <b>no line between "data" and "instructions"</b>. So whoever controls what a tool{' '}
              <em>returns</em> — a web page a search tool fetched, a document a lookup pulled — can plant text
              that the model reads as its <em>next command</em>. Here the first tool's result is
              attacker-controlled. Watch the agent obey it:
            </p>
            <InjectionDemo trainer={trainer} />
            <Callout>
              An agent can't tell <b>data</b> from <b>instructions</b> — so tool output is an attack surface,
              exactly like user input. Marking it as untrusted, typed data stops planted <em>instructions</em>{' '}
              (the tool-switch above), but it can't make a poisoned <em>value</em> trustworthy — so you still
              <b> validate and authorise consequential actions</b> (a payment, a delete, an email) rather than
              letting the model's tool output trigger them directly. Real models trained on natural language
              are <em>far</em> easier to hijack this way than this tiny one; the mechanism is identical.
            </Callout>

          </Section>

          <AdderSection n={5} />

          <Section n={6} title="Where this leaves you">
            <p>
              A harness is not one thing. On this page it has done three different jobs: it{' '}
              <b>checked</b> what the model produced, it <b>ran the tool</b> the model asked for, and — in
              the adder — it <b>remembered</b> where the model had got to. Those are separable, and a real
              system usually needs all three.
            </p>
            <footer className="mx-auto max-w-2xl border-t border-slate-800 px-0 py-6 text-[11px] text-slate-500">
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
