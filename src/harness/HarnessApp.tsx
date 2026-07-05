import { useEffect, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { runHarness, harnessDispatch, runAgent, type HarnessTrace, type AgentTrace } from './runHarness'
import { TOOL_EXAMPLES, TWO_STEP_EXAMPLES } from '../data/harnessTasks'
import { Section, Callout, card } from '../explain/ui'

async function loadHarnessModel(): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'harness-model.json')
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

const btn = 'rounded border px-3 py-1.5 text-xs'
const chip = 'rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700'

// Garbled outputs a flaky tiny model might produce — what the harness must cope
// with. Each shows a different failure mode (and one that still parses despite junk).
const FLAKY_SAMPLES: { raw: string; note: string }[] = [
  { raw: 'max(4 1 7 = 7', note: 'dropped the closing bracket' },
  { raw: 'mxa(4 1 7) = 7', note: 'mistyped the tool name' },
  { raw: 'sum() = ', note: 'forgot the arguments' },
  { raw: 'hmm, i think max(4 1 7)?', note: 'a valid call buried in chatter — the harness still finds it' },
]

// A visual "stage" in the harness pipeline.
function Stage({ n, label, who, children }: { n: number; label: string; who: 'model' | 'harness'; children: React.ReactNode }) {
  const color = who === 'model' ? 'text-fuchsia-300' : 'text-sky-300'
  return (
    <div className="flex gap-3">
      <div className={'mt-0.5 shrink-0 font-mono text-[11px] ' + color}>{n}</div>
      <div className="min-w-0 flex-1">
        <div className={'text-[11px] font-semibold ' + color}>
          {who === 'model' ? '🧠 the model' : '⚙️ the harness'} · {label}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  )
}

export default function HarnessApp() {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the tool-calling model…')
  const [instruction, setInstruction] = useState('total of 6 9 2')
  const [trace, setTrace] = useState<HarnessTrace | null>(null)
  const [useHarness, setUseHarness] = useState(true)
  const [flakyIdx, setFlakyIdx] = useState(0)
  const [flaky, setFlaky] = useState<{ raw: string; note: string; res: ReturnType<typeof harnessDispatch> } | null>(null)
  const [agentInstruction, setAgentInstruction] = useState('sort 6 9 2 then reverse it')
  const [agentTrace, setAgentTrace] = useState<AgentTrace | null>(null)

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

  function run(text: string) {
    if (!trainer) return
    setInstruction(text)
    setTrace(runHarness(trainer.model, trainer.tok, text))
    setFlaky(null)
  }

  function runLoop(text: string) {
    if (!trainer) return
    setAgentInstruction(text)
    setAgentTrace(runAgent(trainer.model, trainer.tok, text))
  }

  // "flaky model" demo: feed the harness a garbled model output (cycling through
  // common failure modes) and show how it copes — self-contained, no prior run needed.
  function flakyStep() {
    const s = FLAKY_SAMPLES[flakyIdx % FLAKY_SAMPLES.length]
    setFlaky({ raw: s.raw, note: s.note, res: harnessDispatch(s.raw) })
    setFlakyIdx((i) => i + 1)
  }

  const t = trace
  const modelRight = t?.parsed && t.modelGuess != null && t.modelGuess === t.toolResult
  const answer = useHarness ? t?.toolResult : t?.modelGuess

  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 bg-slate-900/60 px-4 py-2 font-mono">
        <h1 className="text-base font-bold text-sky-300">JabberLM · Tool use &amp; a tiny harness</h1>
        <a className="text-xs text-emerald-300 hover:underline sm:ml-auto" href="./explain.html">New to AI? →</a>
        <a className="text-xs text-sky-300 hover:underline" href="./learn.html">How it works →</a>
        <a className="text-xs text-sky-400 hover:underline" href="./">Playground →</a>
        <a className="text-xs text-fuchsia-300 hover:underline" href="./lab.html">Lab ↗</a>
      </header>

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
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[13px] text-slate-100"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && run(instruction)}
                placeholder="e.g. add up 6 9 2"
              />
              <button className={btn + ' border-sky-600 bg-sky-900/40 text-sky-200'} onClick={() => run(instruction)}>
                Run
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">try:</span>
              {TOOL_EXAMPLES.map((ex) => (
                <button key={ex} className={chip} onClick={() => run(ex)}>
                  {ex}
                </button>
              ))}
            </div>

            {t && (
              <div className={card + ' mt-4 space-y-3'}>
                <Stage n={1} label="turns your words into a tool call" who="model">
                  <code className="font-mono text-[13px] text-fuchsia-200">{t.modelRaw || '—'}</code>
                </Stage>
                <Stage n={2} label="parses the call" who="harness">
                  {t.parsed ? (
                    <code className="font-mono text-[13px] text-emerald-200">
                      {t.parsed.tool}([{t.parsed.args.join(', ')}])
                    </code>
                  ) : (
                    <span className="text-[13px] text-red-300">✗ {t.error} — a real harness would re-prompt or fall back</span>
                  )}
                </Stage>
                {t.parsed && (
                  <Stage n={3} label="runs the real JavaScript tool (always correct)" who="harness">
                    <code className="font-mono text-[13px] text-emerald-200">
                      {t.parsed.tool}([{t.parsed.args.join(', ')}]) = {t.toolResult}
                    </code>
                  </Stage>
                )}

                {/* the answer + the harness on/off contrast */}
                <div className="border-t border-slate-800 pt-3">
                  <label className="mb-2 flex items-center gap-2 text-[12px] text-slate-300">
                    <input type="checkbox" checked={useHarness} onChange={(e) => setUseHarness(e.target.checked)} />
                    use the harness (run the tool) — untick to let the model answer alone
                  </label>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[12px] text-slate-400">answer:</span>
                    <span
                      className={
                        'font-mono text-lg font-bold ' +
                        (useHarness ? 'text-emerald-300' : modelRight ? 'text-emerald-300' : 'text-red-300')
                      }
                    >
                      {answer ?? '—'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {useHarness
                        ? '✓ computed by JavaScript — guaranteed correct'
                        : modelRight
                          ? '(the model happened to get this one right)'
                          : "✗ the model did it itself — and got it wrong (it can't reliably do maths)"}
                    </span>
                  </div>
                  {t.parsed && t.modelGuess != null && t.modelGuess !== t.toolResult && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      model's own guess <code className="text-red-300">{t.modelGuess}</code> vs harness{' '}
                      <code className="text-emerald-300">{t.toolResult}</code> — same model, but the tool makes it reliable.
                    </div>
                  )}
                </div>
              </div>
            )}

            <Callout>
              A fluent answer from a model is a <em>guess</em>. Wrapping it in a harness — parse the intent,
              call a real tool, use the tool's result — turns "probably right" into "provably right" for
              anything a tool can do (maths, lookups, code, search). That's why every serious AI product is
              mostly harness.
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[13px] text-slate-100"
                value={agentInstruction}
                onChange={(e) => setAgentInstruction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runLoop(agentInstruction)}
              />
              <button className={btn + ' border-teal-600 bg-teal-900/40 text-teal-200'} onClick={() => runLoop(agentInstruction)}>
                Run the loop
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">try:</span>
              {TWO_STEP_EXAMPLES.map((ex) => (
                <button key={ex} className={chip} onClick={() => runLoop(ex)}>
                  {ex}
                </button>
              ))}
            </div>

            {agentTrace && (
              <div className={card + ' mt-4 space-y-2'}>
                <div className="text-[11px] text-slate-400">
                  you asked: <span className="font-mono text-slate-200">{agentTrace.instruction}</span>
                </div>
                {agentTrace.steps.map((s, i) => (
                  <div key={i}>
                    {i > 0 && (
                      <div className="my-1 pl-6 text-[10px] text-sky-400/80">
                        ↳ the harness feeds that result back; the model reads it and calls again
                      </div>
                    )}
                    <div className="flex items-center gap-2 font-mono text-[13px]">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">step {i + 1}</span>
                      {s.call ? (
                        <>
                          <span className="text-fuchsia-300">🧠 {s.call.tool}([{s.call.args.join(', ')}])</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-emerald-300">⚙️ {s.result}</span>
                        </>
                      ) : (
                        <span className="text-red-300">✗ {s.error}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-800 pt-2 text-[13px]">
                  {agentTrace.done ? '🏁 the model said done. ' : '(stopped) '}
                  <span className="text-slate-400">final answer: </span>
                  <span className="font-mono text-lg font-bold text-emerald-300">{agentTrace.finalAnswer ?? '—'}</span>
                </div>
              </div>
            )}

            <Callout>
              That's an agent: observe → act → observe → act → finish. Nothing here is special to a big
              model — it's the same loop whether the "brain" is 88 thousand parameters (this one) or a
              trillion. The scaffolding is what turns a next-token predictor into something that gets work
              done.
            </Callout>

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
