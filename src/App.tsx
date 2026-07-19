import { useEffect, useRef, useState } from 'react'
import ConfigSidebar, { PRESETS } from './components/ConfigSidebar'
import TrainingPanel from './components/TrainingPanel'
import InferencePanel from './components/InferencePanel'
import Tour, { type TourStep } from './components/Tour'
import SiteNav from './components/SiteNav'
import { useStore } from './state/store'
import { TEXT_SAMPLES } from './data/jabberwocky'
import { openGuide } from './guide'

const MODE_KEY = 'jabberlm-mode-chosen'

// The "Train a model & watch it grok" walkthrough — points at each element in turn.
const TRAIN_TOUR: TourStep[] = [
  {
    anchor: 'dataset',
    title: 'The training data',
    body: (
      <>
        We've set this to <b className="text-fuchsia-200">Sorting</b> — examples like{' '}
        <code>sort 6 9 2 =&gt; 2 6 9</code>. The model will try to learn to sort. (Poems and Equations
        are here too — three very different things to learn.)
      </>
    ),
  },
  {
    anchor: 'architecture',
    title: 'Model size',
    body: (
      <>
        How big the model is. We've picked <b>tiny</b> — it converges fast and shows the grokking jump
        cleanly. <b>default</b> works too, just a touch slower.
      </>
    ),
  },
  {
    anchor: 'play',
    title: 'Start training',
    body: (
      <>
        Press <b className="text-emerald-300">▶ Play</b> to build a fresh model and start learning.
        Leave <b>auto speed</b> on so it stays smooth. (Do it now, then hit Next.)
      </>
    ),
  },
  {
    anchor: 'loss',
    title: 'Training loss',
    body: <>Loss drops quickly as the model fits the examples it's shown. Lower = better predictions.</>,
  },
  {
    anchor: 'grok',
    title: 'Does it really learn? (grokking)',
    body: (
      <>
        The key chart: accuracy on lists it has <b>never seen</b>.{' '}
        <b className="text-fuchsia-200">Predict first</b> — steady climb, or flat then a sudden jump?
        It <i>groks</i>: near-zero for a while, then leaps. And the digits 1–9 line up into a{' '}
        <b>number line</b> — it learned the <i>idea</i> of order, so it generalises.
      </>
    ),
  },
  {
    anchor: 'inference',
    title: 'Try it yourself',
    body: (
      <>
        Type a brand-new list, e.g. <code>sort 4 1 7 =&gt; </code> and press <b>Run</b> to watch it
        sort something it never trained on.
      </>
    ),
  },
  {
    anchor: 'tabs',
    title: 'Look inside',
    body: (
      <>
        Open these tabs to see the internals (attention, residuals, logits) — or visit the{' '}
        <a className="text-fuchsia-300 underline" href="./lab.html">
          Interpretability lab
        </a>{' '}
        to find <i>which heads</i> do the sorting.
      </>
    ),
  },
]

export default function App() {
  const [showConfig, setShowConfig] = useState(false)
  const [tour, setTour] = useState(false)
  const setTrainingText = useStore((s) => s.setTrainingText)
  const setModelConfig = useStore((s) => s.setModelConfig)
  const pretrainedActive = useStore((s) => s.pretrainedActive)
  const [chooseMode, setChooseMode] = useState(() => {
    try {
      return localStorage.getItem(MODE_KEY) !== '1'
    } catch {
      return true // storage blocked (private mode) — still show the intro
    }
  })
  const dismissChooser = () => {
    try {
      localStorage.setItem(MODE_KEY, '1')
    } catch {
      /* ignore */
    }
    setChooseMode(false)
  }

  // Accessible modal: trap focus inside the welcome dialog, close on Escape, and
  // restore focus to wherever it was when the dialog opened.
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!chooseMode) return
    const node = dialogRef.current
    if (!node) return
    const prevFocused = document.activeElement as HTMLElement | null
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null)
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissChooser()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prevFocused?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chooseMode])

  const sortText = TEXT_SAMPLES.find((s) => s.id === 'sort')?.text
  const tinyCfg = PRESETS.find((p) => p.name === 'tiny')?.cfg
  const startTour = () => {
    if (sortText) setTrainingText(sortText) // set up the grokking scenario
    if (tinyCfg) setModelConfig(tinyCfg) // tiny converges fast and shows grokking cleanly
    setShowConfig(true) // open the sidebar so the dataset/architecture steps point correctly on mobile
    dismissChooser()
    setTour(true)
  }

  // Deep links for blog "Try it →" CTAs: ?tour=1 drops the reader straight into the
  // sorting dataset + guided grokking tour; ?dataset=sort|jabber|equations just loads a
  // dataset. Either arrival skips the welcome splash.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wantTour = params.get('tour') === '1'
    const ds = params.get('dataset')
    if (!wantTour && !ds) return
    if (wantTour) {
      startTour()
      return
    }
    const sample = TEXT_SAMPLES.find((s) => s.id === ds)
    if (sample) {
      setTrainingText(sample.text)
      setShowConfig(true)
    }
    dismissChooser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tile = 'rounded-lg border bg-slate-900 p-3 text-left'

  return (
    <div className="flex min-h-screen flex-col font-mono text-sm lg:h-full lg:min-h-0 lg:overflow-hidden">
      <SiteNav current="playground">
        <span
          className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-400"
          title={
            pretrainedActive
              ? 'Results come from the built-in three-skill model bundled with the site.'
              : 'Results come from the model you built, trained, or loaded in this session.'
          }
        >
          {pretrainedActive ? 'built-in model' : 'your model'}
        </span>
        <span className="hidden text-xs text-slate-400 md:inline">
          a transformer you can see inside ·{' '}
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
        <button
          onClick={startTour}
          className="rounded border border-fuchsia-700 bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-200 hover:bg-fuchsia-900/60"
        >
          ✨ Guide me
        </button>
        <button
          onClick={() => setChooseMode(true)}
          title="Show the welcome intro again"
          className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          Intro
        </button>
        <details className="relative text-xs text-slate-400">
          <summary className="cursor-pointer select-none rounded border border-slate-700 px-2 py-0.5 hover:bg-slate-800">
            how to use
          </summary>
          <div className="fixed inset-x-2 bottom-2 z-20 max-h-[75vh] overflow-y-auto rounded border border-slate-700 bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-300 shadow-xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:mt-1 lg:max-h-none lg:w-80 lg:overflow-visible">
            <ol className="list-decimal space-y-1 pl-4">
              <li>Pick a dataset (Poems / Sorting / Equations) and a small architecture preset.</li>
              <li>
                Press <span className="text-emerald-300">▶ Play</span> and watch it learn — on{' '}
                <b>Sorting</b>, watch the held-out accuracy suddenly jump (grokking).
              </li>
              <li>
                In Inference, type a prompt, press <span className="text-sky-300">Run</span> / Step, and
                open the tabs to inspect attention, residuals, and logits.
              </li>
              <li>Try LoRA fine-tuning, or the Interpretability lab to see which heads do what.</li>
            </ol>
            <button
              onClick={openGuide}
              className="mt-3 w-full rounded border border-sky-700 bg-sky-900/40 px-2 py-1 text-center text-[11px] text-sky-200 hover:bg-sky-900/70"
            >
              Open the full guide ↗
            </button>
          </div>
        </details>
      </SiteNav>

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
          {/* On mobile, show the ready-to-use Inference panel FIRST (order-1); on desktop
              reset to source order so Training is the left column, Inference the right. */}
          <section className="order-2 border-t border-slate-800 lg:order-none lg:min-h-0 lg:border-t-0 lg:border-r lg:overflow-y-auto">
            <TrainingPanel />
          </section>
          <section className="order-1 lg:order-none lg:min-h-0 lg:overflow-y-auto">
            <InferencePanel />
          </section>
        </main>
      </div>

      {tour && <Tour steps={TRAIN_TOUR} onClose={() => setTour(false)} />}

      {chooseMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <h2 id="welcome-title" className="text-base font-bold text-sky-300">
              Welcome to JabberLM
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              A real, tiny language model you can see inside — running entirely in your browser. Where
              would you like to start?
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              New here? A good path: <span className="text-emerald-300">New to AI</span> →{' '}
              <span className="text-sky-300">How it works</span> →{' '}
              <span className="text-fuchsia-300">Experiment</span>.
            </p>

            {/* 1 — recommended: use AI more intelligently */}
            <a
              href="./explain.html"
              onClick={dismissChooser}
              className={tile + ' mt-4 block border-emerald-700 bg-emerald-900/25 hover:bg-emerald-900/45'}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-emerald-200">New to AI — use it more wisely ★</span>
                <span className="shrink-0 text-[10px] text-slate-500">~10 min</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Plain language, no maths: how it answers, why it varies, what it costs, and where it goes
                wrong.
              </div>
            </a>

            {/* 2 — understand a transformer */}
            <a
              href="./learn.html"
              onClick={dismissChooser}
              className={tile + ' mt-2 block border-sky-700 bg-sky-900/25 hover:bg-sky-900/45'}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-sky-200">Understand a transformer</span>
                <span className="shrink-0 text-[10px] text-slate-500">~15 min</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Follow one prediction through a real model: tokens → vectors → attention → next-character
                guess.
              </div>
            </a>

            {/* 3 — experiment (stay in the playground) */}
            <div className={tile + ' mt-2 border-fuchsia-700/60 bg-fuchsia-950/15'}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-fuchsia-200">Experiment with the model</span>
                <span className="shrink-0 text-[10px] text-slate-500">~5 min</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Generate text and sort numbers here, then train one from scratch and watch it "grok".
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={dismissChooser}
                  className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                >
                  Open the playground →
                </button>
                <button
                  onClick={startTour}
                  className="flex-1 rounded border border-fuchsia-600 bg-fuchsia-900/50 px-2 py-1 text-[11px] text-fuchsia-100 hover:bg-fuchsia-900/80"
                >
                  Guided training tour
                </button>
              </div>
            </div>

            {/* secondary destinations */}
            <div className="mt-3 text-center text-[11px] text-slate-500">
              Also:{' '}
              <a href="./harness.html" onClick={dismissChooser} className="text-sky-400 hover:underline">
                Tools &amp; agents
              </a>{' '}
              ·{' '}
              <a href="./lab.html" onClick={dismissChooser} className="text-sky-400 hover:underline">
                Interpretability lab
              </a>
            </div>

            <button
              onClick={dismissChooser}
              className="mt-4 rounded border border-slate-500 px-4 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Skip — just let me explore →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
