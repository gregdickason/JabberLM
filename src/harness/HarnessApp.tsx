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
        <p className="mt-3 text-[11px] text-slate-400">{status || 'model loaded — try an instruction below'}</p>
      </div>

      {trainer && (
        <>
          <Section n={1} title="Ask it to do something — watch the harness work">
            <ToolCallDemo trainer={trainer} onRun={() => setFlaky(null)} />
            <Callout>
              A model's answer is a guess. A tool's output is a computation. Parsing the intent, calling
              a real tool and using the tool's result makes the execution authoritative for anything a
              tool does: maths, lookups, code, search. The hallucination is removed from that step only.
              The model can still misread the intent, and the tool's data, permissions and inputs can be
              wrong or hostile (§4). Reliability comes from the engineering around the call.
            </Callout>
          </Section>

          <Section n={2} title="Why harnesses need to be robust">
            <p>
              The model is small and its output is sometimes a <b>malformed</b> call. The harness
              validates before it dispatches. Each click feeds it a different failure:
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
                  <span className="text-slate-400">({flaky.note}):</span>
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
              Parsing, validating, retrying, sandboxing calls and managing what the model sees is{' '}
              <b>harness engineering</b>. Most of an agent's reliability comes from there rather than from
              the weights.
            </Callout>
          </Section>

          <Section n={3} title="Loop it — and it's an agent">
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

          <Section n={4} title="The catch — prompt injection">
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

          <Section n={6} title="Where this leaves you">
            <p>
              A harness does three separable jobs, all three on this page: it <b>checked</b> what the
              model produced, it <b>ran the tool</b> the model asked for, and in the adder it{' '}
              <b>held the state</b> the model could not. Most systems need all three.
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
