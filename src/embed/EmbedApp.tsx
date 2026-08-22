import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEMOS, demoFromUrl, rootFontPx, type Demo, type DemoId } from './demos'
import TicTacToe from '../capstone/TicTacToe'
import LoraSection from '../lab/LoraSection'
import { AgentLoopDemo, InjectionDemo, ToolCallDemo, loadHarnessModel } from '../harness/demos'
import type { Trainer } from '../engine/trainer'

// The embeddable shell: a JabberLM wordmark, then the demo. Nothing else — no nav, no
// teaching copy, no footer. Someone else's page supplies the context; we supply the thing
// that runs. Everything inside is rem-sized, so `?scale=` (applied to the root font size
// below) makes the whole demo bigger for a projector without any layout rewrite.

// The harness demos share one model; each frame loads it on its own.
function WithHarnessModel({ children }: { children: (t: Trainer) => React.ReactNode }) {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the tool-calling model…')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const t = await loadHarnessModel()
      if (cancelled) return
      if (t) setTrainer(t)
      else setStatus('could not load the tool-calling model (public/harness-model.json)')
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return trainer ? <>{children(trainer)}</> : <div className="text-slate-500">{status}</div>
}

// Every demo here renders WITHOUT its page's framing — no heading, no intro prose, no
// callout. Those live on the lesson pages; a host page brings its own words.
const RENDER: Record<DemoId, () => React.ReactNode> = {
  // No `onLookInside` — the inspector lives on the capstone page, not in the frame.
  tictactoe: () => <TicTacToe showBlurb={false} />,
  'harness-tools': () => <WithHarnessModel>{(t) => <ToolCallDemo trainer={t} autoRun />}</WithHarnessModel>,
  'agent-loop': () => <WithHarnessModel>{(t) => <AgentLoopDemo trainer={t} autoRun />}</WithHarnessModel>,
  'prompt-injection': () => <WithHarnessModel>{(t) => <InjectionDemo trainer={t} />}</WithHarnessModel>,
  lora: () => <LoraSection embed />,
}

// A demo with a declared frame gets a fixed box so the host page never reflows mid-demo.
function Frame({ demo }: { demo: Demo }) {
  const body = RENDER[demo.id]()
  const font = demo.font === 'sans' ? 'font-sans' : 'font-mono'
  if (!demo.frame) return <div className={font}>{body}</div>
  return (
    <div
      className={font + ' overflow-auto'}
      style={{ width: `${demo.frame.w}rem`, height: `${demo.frame.h}rem`, maxWidth: '100%' }}
    >
      {body}
    </div>
  )
}

export default function EmbedApp() {
  const demo = demoFromUrl(location.search)
  const ref = useRef<HTMLDivElement>(null)

  // before paint: nothing has rendered yet, so there is no flash of the wrong size
  useLayoutEffect(() => {
    document.documentElement.style.fontSize = rootFontPx(location.search)
  }, [])

  useEffect(() => {
    if (demo) document.title = `${demo.title} — JabberLM`
  }, [demo])

  // Tell a host page how tall we are, so it can size the iframe to the content instead of
  // guessing (README documents the listener). Height only — nothing else crosses the frame.
  useEffect(() => {
    const el = ref.current
    if (!el || window.parent === window || typeof ResizeObserver === 'undefined') return
    const post = () =>
      window.parent.postMessage(
        { type: 'jabberlm:height', demo: demo?.id ?? null, height: Math.ceil(el.getBoundingClientRect().height) },
        '*',
      )
    const ro = new ResizeObserver(post)
    ro.observe(el)
    post()
    return () => ro.disconnect()
  }, [demo])

  return (
    <div ref={ref} className="min-h-full p-4 font-mono text-sm text-slate-200">
      <header className="mb-3">
        {/* target=_blank matters: a plain link would navigate the host's iframe, not open the site */}
        <a
          className="text-sm font-bold text-sky-300 hover:text-sky-200"
          href={`./?ref=embed-${demo?.id ?? 'index'}`}
          target="_blank"
          rel="noopener"
        >
          JabberLM
        </a>
      </header>

      {demo ? (
        <Frame demo={demo} />
      ) : (
        <div className="space-y-3 text-base">
          <p className="text-slate-300">
            Embeddable demos. Add <code className="text-fuchsia-300">?demo=&lt;id&gt;</code> to this URL:
          </p>
          <ul className="space-y-1">
            {DEMOS.map((d) => (
              <li key={d.id}>
                <a className="text-sky-300 underline" href={`./embed.html?demo=${d.id}`}>
                  {d.id}
                </a>{' '}
                <span className="text-slate-400">— {d.title}</span>{' '}
                <a className="text-slate-500 underline" href={d.source.href} target="_blank" rel="noopener">
                  ({d.source.label})
                </a>
              </li>
            ))}
          </ul>
          <p className="text-slate-500">
            Optional: <code className="text-fuchsia-300">&amp;scale=1.6</code> to enlarge everything for a
            projector.
          </p>
        </div>
      )}
    </div>
  )
}
