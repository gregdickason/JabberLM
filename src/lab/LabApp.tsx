import { useEffect, useRef, useState } from 'react'
import { autoLoadModel, loadModelFromText, loadUserModel, type LoadedModel } from './loadModel'
import NeuronsSection from './NeuronsSection'
import HeadsSection from './HeadsSection'
import SaeSection from './SaeSection'
import SteeringSection from './SteeringSection'
import AblationSection from './AblationSection'
import MoeSection from './MoeSection'
import GrokSection from './GrokSection'
import RecoverySection from './RecoverySection'
import DistillSection from './DistillSection'
import LoraSection from './LoraSection'
import ForgettingSection from './ForgettingSection'
import SpeculativeSection from './SpeculativeSection'
import RlvrSection from './RlvrSection'
import SiteNav from '../components/SiteNav'
import type { SAE } from '../interp/sae'

const TABS = ['neurons', 'attention heads', 'head ablation', 'injury & recovery', 'dictionary (SAE)', 'steering', 'mixture of experts', 'advanced grokking', 'distillation', 'LoRA fine-tuning', 'forgetting', 'reward learning (RLVR)', 'speculative decoding'] as const
type Tab = (typeof TABS)[number]

// The tabs grouped into a small curriculum so the lab reads as four themes,
// not a flat feature shelf. (Ordering/hash routing below are unchanged.)
const GROUPS: { label: string; blurb: string; tabs: Tab[] }[] = [
  { label: 'Observe', blurb: 'see what the trained model represents inside', tabs: ['neurons', 'attention heads', 'dictionary (SAE)'] },
  { label: 'Intervene', blurb: 'poke the circuit and watch what breaks or moves', tabs: ['head ablation', 'injury & recovery', 'steering'] },
  { label: 'Adapt', blurb: 'change what it does — cheaply, or destructively', tabs: ['distillation', 'LoRA fine-tuning', 'forgetting', 'reward learning (RLVR)'] },
  { label: 'Scale & serve', blurb: 'structure, emergence, and faster inference', tabs: ['mixture of experts', 'advanced grokking', 'speculative decoding'] },
]

const btn =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-40'

// URL-addressable tabs: e.g. lab.html#injury-recovery opens the recovery tab.
const slug = (t: string) => t.replace(/[()]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
const tabFromHash = (): Tab => {
  const h = typeof location !== 'undefined' ? location.hash.replace(/^#/, '').toLowerCase() : ''
  return TABS.find((t) => slug(t) === h) ?? 'neurons'
}

export default function LabApp() {
  const [loaded, setLoaded] = useState<LoadedModel | null>(null)
  const [status, setStatus] = useState('looking for a model…')
  const [tab, setTabState] = useState<Tab>(tabFromHash)
  const setTab = (t: Tab) => {
    setTabState(t)
    if (typeof history !== 'undefined') history.replaceState(null, '', `#${slug(t)}`)
  }
  const [trainedSae, setTrainedSae] = useState<{ sae: SAE; layer: number; topFeature: number } | null>(
    null,
  )
  const fileRef = useRef<HTMLInputElement>(null)

  // follow the URL hash (deep links, back/forward)
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const m = await autoLoadModel()
      if (cancelled) return
      if (m) {
        setLoaded(m)
        setStatus(`loaded from ${m.source}`)
      } else {
        setStatus('no saved model found — train one in the main app, or upload a JSON model')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const m = loadModelFromText(String(reader.result))
        setLoaded(m)
        setStatus(`loaded from ${m.source} (${file.name})`)
      } catch (err) {
        setStatus('upload failed: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
  }

  const cfg = loaded?.trainer.cfg

  return (
    <div className="min-h-screen font-mono text-sm text-slate-200">
      <SiteNav current="lab">
        <span className="hidden text-xs text-slate-400 sm:inline">Interpretability lab</span>
      </SiteNav>

      {/* model loader */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/30 px-4 py-2 text-xs">
        <span className="text-slate-400">model:</span>
        <span className="text-slate-200">{status}</span>
        {cfg && (
          <span className="text-slate-500">
            · d_model {cfg.dModel} · {cfg.nHeads}×{cfg.nLayers} heads/layers · d_ff {cfg.dFF} · vocab{' '}
            {cfg.vocabSize}
          </span>
        )}
        <button
          className={btn + ' ml-auto'}
          title="Inspect the model from your most recent training run instead of the built-in one"
          onClick={() => {
            void (async () => {
              const m = await loadUserModel()
              if (m) {
                setLoaded(m)
                setStatus(`loaded from ${m.source}`)
              } else {
                setStatus('no saved training run found — train a model in the main app first')
              }
            })()
          }}
        >
          Inspect my last training run
        </button>
        <button className={btn} onClick={() => fileRef.current?.click()}>
          ⭱ Upload JSON model
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onUpload} />
      </div>

      {!loaded ? (
        <div className="p-8 text-center text-xs text-slate-500">
          <p className="mx-auto max-w-xl leading-relaxed">
            This lab demonstrates <span className="text-slate-300">mechanistic interpretability</span> —
            techniques for reverse-engineering what a trained transformer has actually learned, rather
            than judging it only by its outputs. Load a model to begin: it uses your last training run
            automatically, or upload a saved JSON model.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1 border-b border-slate-800 px-4 py-2">
            {GROUPS.map((g) => (
              <div key={g.label} className="flex flex-wrap items-center gap-1">
                <span
                  className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                  title={g.blurb}
                >
                  {g.label}
                </span>
                {g.tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    aria-pressed={tab === t}
                    className={
                      'rounded px-2 py-0.5 text-[11px] ' +
                      (tab === t
                        ? 'bg-fuchsia-700 font-semibold text-white ring-1 ring-fuchsia-300'
                        : 'bg-slate-800 text-slate-300')
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="p-4">
            {tab === 'neurons' && <NeuronsSection trainer={loaded.trainer} />}
            {tab === 'attention heads' && <HeadsSection trainer={loaded.trainer} />}
            {tab === 'head ablation' && <AblationSection trainer={loaded.trainer} />}
            {tab === 'injury & recovery' && <RecoverySection />}
            {tab === 'dictionary (SAE)' && (
              <SaeSection
                trainer={loaded.trainer}
                onTrained={(sae, layer, topFeature) => setTrainedSae({ sae, layer, topFeature })}
              />
            )}
            {tab === 'steering' && <SteeringSection trainer={loaded.trainer} sae={trainedSae} />}
            {tab === 'mixture of experts' && <MoeSection />}
            {tab === 'advanced grokking' && <GrokSection />}
            {tab === 'distillation' && <DistillSection />}
            {tab === 'LoRA fine-tuning' && <LoraSection />}
            {tab === 'forgetting' && <ForgettingSection />}
            {tab === 'reward learning (RLVR)' && <RlvrSection />}
            {tab === 'speculative decoding' && <SpeculativeSection />}
          </div>
        </>
      )}
    </div>
  )
}
