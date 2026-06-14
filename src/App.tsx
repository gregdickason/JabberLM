import { useState } from 'react'
import ConfigSidebar from './components/ConfigSidebar'
import TrainingPanel from './components/TrainingPanel'
import InferencePanel from './components/InferencePanel'
import { openGuide } from './guide'

export default function App() {
  const [showConfig, setShowConfig] = useState(false)
  return (
    <div className="flex min-h-screen flex-col font-mono text-sm lg:h-full lg:min-h-0 lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 bg-slate-900/60 px-4 py-2">
        <h1 className="text-base font-bold text-sky-300">JabberLM</h1>
        <span className="text-xs text-slate-400">
          a decoder-only transformer you can see inside — trains in your browser ·{' '}
          <a
            href="https://www.linkedin.com/in/greg-dickason-633920/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline"
          >
            by Greg Dickason
          </a>
        </span>
        <button
          onClick={() => setShowConfig((v) => !v)}
          className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 lg:hidden"
        >
          ⚙ Config
        </button>
        <a
          href="./lab.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-fuchsia-300 hover:underline sm:ml-auto"
        >
          Interpretability lab ↗
        </a>
        <details className="relative text-xs text-slate-400">
          <summary className="cursor-pointer select-none rounded border border-slate-700 px-2 py-0.5 hover:bg-slate-800">
            how to use
          </summary>
          <div className="fixed inset-x-2 bottom-2 z-20 max-h-[75vh] overflow-y-auto rounded border border-slate-700 bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-300 shadow-xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:mt-1 lg:max-h-none lg:w-80 lg:overflow-visible">
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                In the left sidebar pick a text (default: Jabberwocky) and an architecture preset.
              </li>
              <li>
                Press <span className="text-emerald-300">▶ Play</span> in the Training panel and
                watch the loss curve fall and the live sample become Jabberwocky-like. Edit learning
                rate / batch size live.
              </li>
              <li>
                In the Inference panel type a prompt, press <span className="text-sky-300">Run</span>{' '}
                then <span className="text-sky-300">Step</span>, and open the tabs to inspect Q/K/V,
                attention, the residual stream, MLP, and logits.
              </li>
              <li>
                Toggle <span className="text-slate-100">RoPE</span>,{' '}
                <span className="text-slate-100">KV cache</span>, and{' '}
                <span className="text-slate-100">sliding window</span> in the sidebar and watch their
                dedicated tabs — the real numbers change with them.
              </li>
              <li>Save the trained model to your browser or download it as JSON to reload later.</li>
            </ol>
            <button
              onClick={openGuide}
              className="mt-3 w-full rounded border border-sky-700 bg-sky-900/40 px-2 py-1 text-center text-[11px] text-sky-200 hover:bg-sky-900/70"
            >
              Open the full guide ↗
            </button>
          </div>
        </details>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={
            (showConfig ? 'block' : 'hidden') +
            ' w-full shrink-0 border-b border-slate-800 bg-slate-900/40 lg:block lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto'
          }
        >
          <ConfigSidebar />
        </aside>

        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <section className="border-b border-slate-800 lg:min-h-0 lg:border-b-0 lg:border-r lg:overflow-y-auto">
            <TrainingPanel />
          </section>
          <section className="lg:min-h-0 lg:overflow-y-auto">
            <InferencePanel />
          </section>
        </main>
      </div>
    </div>
  )
}
