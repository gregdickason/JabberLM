import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getTrainer, rebuildTrainer, setTrainer, type Trainer } from '../engine/trainer'
import type { GradNorm } from '../engine/optimizer'
import { deserialize, serialize, type SavedModel } from '../engine/persist'
import { idbDelete, idbGet, idbPut, makeCheckpoint, restoreCheckpoint } from '../engine/checkpoint'
import type { FeatureFlags, TrainConfig } from '../engine/config'
import { buildWalkSteps, type WalkStep } from '../engine/walkthrough'
import { installBundledModel } from '../state/pretrained'
import { FINETUNE_PACKS } from '../data/finetunePacks'
import { TEXT_SAMPLES } from '../data/jabberwocky'
import { sortHeldOut } from '../data/tasks'
import { sortAccuracy } from '../interp/ablation'
import { pca2 } from '../interp/pca'
import Scatter from '../viz/Scatter'
import type { LoraTarget } from '../engine/config'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const GROK_EVERY = 150 // recompute the grok view (held-out sort acc + digit PCA) every N steps
import Walkthrough from './Walkthrough'
import LineChart from '../viz/LineChart'
import Heatmap from '../viz/Heatmap'
import type { Matrix } from '../engine/trace'

const LS_KEY = 'jabberllm-model'

// Run the on-load bootstrap (restore a checkpoint, else install the bundled
// model) exactly once per page load. React StrictMode mounts effects twice in
// dev; a module-level latch makes the bootstrap deterministic regardless.
let bootstrapped = false

const btn =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-40'

const TRAIN_COLOR = '#34d399' // emerald
const VAL_COLOR = '#f59e0b' // amber

// Measure held-out validation loss on the right cadence (forward-only, no grad).
function maybeValidate(
  trainer: Trainer,
  step: number,
  trainCfg: TrainConfig,
  flags: FeatureFlags,
): void {
  if (trainCfg.validationFraction <= 0) return
  if (step % Math.max(1, trainCfg.validationEverySteps) !== 0) return
  const v = trainer.evalValidation(flags, trainCfg.validationFraction)
  if (v != null) useStore.getState().pushVal({ step, loss: v })
}

export default function TrainingPanel() {
  const store = useStore()
  const {
    status,
    step,
    lossHistory,
    valHistory,
    livePreview,
    modelBuilt,
    trainingText,
    modelConfig,
    fineTuneActive,
  } = store

  const rafRef = useRef<number | null>(null)
  const loopRef = useRef<() => void>(() => {})
  const lastSaveRef = useRef(0)
  const [stepsPerFrame, setStepsPerFrame] = useState(3)
  // Adaptive throttle: the rAF loop reads `stepsRef` (avoids a stale closure) and,
  // when auto is on, tunes steps/frame to a ~20 ms compute budget so the UI stays
  // smooth on any device (fast on desktop, gentle on mobile).
  const stepsRef = useRef(3)
  const [autoThrottle, setAutoThrottle] = useState(true)
  const autoRef = useRef(true)
  useEffect(() => {
    autoRef.current = autoThrottle
  }, [autoThrottle])
  const [gradNorms, setGradNorms] = useState<GradNorm[]>([])
  const [weightParam, setWeightParam] = useState('tokenEmbed')
  const [walk, setWalk] = useState<WalkStep[] | null>(null)
  const [restoredStep, setRestoredStep] = useState<number | null>(null)

  // Grokking view (shown when training on the Sorting dataset): held-out sort
  // accuracy over time + a PCA of the digit embeddings ("number line").
  const sortText = useMemo(() => TEXT_SAMPLES.find((s) => s.id === 'sort')?.text ?? '', [])
  const isSorting = trainingText === sortText
  const heldOut = useMemo(() => sortHeldOut().slice(0, 24), [])
  const [grok, setGrok] = useState<{ accHist: { step: number; acc: number }[]; pca: [number, number][] }>({
    accHist: [],
    pca: [],
  })

  function computeGrok(step: number) {
    const trainer = getTrainer()
    if (!trainer) return
    const acc = sortAccuracy(trainer.model, trainer.tok, heldOut)
    const dM = trainer.model.cfg.dModel
    const emb = DIGITS.map((d) => trainer.tok.stoi.get(d))
      .filter((id): id is number => id != null)
      .map((id) => Array.from(trainer.model.tokenEmbed.data.subarray(id * dM, (id + 1) * dM)))
    const pca = emb.length >= 2 ? pca2(emb) : []
    setGrok((g) => ({ accHist: [...g.accHist, { step, acc }].slice(-300), pca }))
  }

  // Write the current run (model + step + loss curves) to IndexedDB so it
  // survives the tab being frozen/discarded when the machine sleeps. Reads
  // everything from the store so it's stable and cheap to call.
  async function checkpointNow() {
    const s = useStore.getState()
    const trainer = getTrainer()
    if (!trainer || !s.modelBuilt) return
    if (trainer.fineTuning) return // adapters persist via JSON Save, not auto-checkpoint
    try {
      await idbPut(
        makeCheckpoint(
          trainer,
          s.trainingText,
          { step: s.step, lossHistory: s.lossHistory, valHistory: s.valHistory },
          Date.now(),
        ),
      )
    } catch {
      /* best-effort: a failed checkpoint must never break training */
    }
  }

  // build a fresh model for the current text + architecture
  function build() {
    rebuildTrainer(trainingText, modelConfig)
    useStore.getState().resetRun()
    useStore.getState().setModelBuilt(true)
    useStore.getState().setPretrainedActive(false) // a freshly built model isn't the bundled one
    useStore.getState().setFineTuneActive(false) // a fresh base model has no adapters
    useStore.getState().setFeatureFlags({ lora: false })
    useStore.getState().bumpModelVersion()
    setGradNorms([])
    setRestoredStep(null) // a new run replaces any restored checkpoint
    setGrok({ accHist: [], pca: [] })
    void idbDelete()
    ensureBaselineVal()
  }

  // Record validation loss BEFORE any training (step 0) so the train and val
  // curves share the same ~ln(vocab) origin and you can watch them diverge.
  // Idempotent: only fires on a fresh, validation-enabled run.
  function ensureBaselineVal() {
    const s = useStore.getState()
    const trainer = getTrainer()
    if (!trainer) return
    if (s.trainConfig.validationFraction <= 0 || s.step !== 0 || s.valHistory.length > 0) return
    const v = trainer.evalValidation(s.featureFlags, s.trainConfig.validationFraction)
    if (v != null) s.pushVal({ step: 0, loss: v })
  }

  function loop() {
    const s = useStore.getState()
    const trainer = getTrainer()
    if (!trainer || s.status !== 'running') return
    let result
    const n = stepsRef.current
    let stepMs = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      result = trainer.stepBatch(s.trainConfig, s.featureFlags)
      stepMs += performance.now() - a
      const nextStep = useStore.getState().step + 1
      useStore.getState().setStep(nextStep)
      useStore.getState().pushLoss({ step: nextStep, loss: result.loss })
      maybeValidate(trainer, nextStep, s.trainConfig, s.featureFlags)
      if (nextStep % GROK_EVERY === 0 && useStore.getState().trainingText === sortText) {
        computeGrok(nextStep)
      }
      if (nextStep % s.trainConfig.sampleEverySteps === 0) {
        const seed = trainingText.slice(0, 1)
        useStore.getState().setLivePreview(trainer.sample(s.featureFlags, s.sampleConfig, seed, 120))
      }
    }
    // adapt steps/frame toward a ~20 ms compute budget (smoothed) when auto is on
    if (autoRef.current && n > 0) {
      const perStep = stepMs / n
      const want = Math.max(1, Math.min(50, Math.round(20 / Math.max(0.2, perStep))))
      const next = Math.max(1, Math.round(n * 0.6 + want * 0.4))
      if (next !== stepsRef.current) {
        stepsRef.current = next
        setStepsPerFrame(next)
      }
    }
    if (result) setGradNorms(result.gradNorms)
    // throttled auto-checkpoint (~every 4s of wall-clock)
    const now = Date.now()
    if (now - lastSaveRef.current > 4000) {
      lastSaveRef.current = now
      void checkpointNow()
    }
    rafRef.current = requestAnimationFrame(loop)
  }
  loopRef.current = loop

  function play() {
    setRestoredStep(null) // resuming clears the "restored" banner
    if (!getTrainer() || !modelBuilt) build()
    ensureBaselineVal()
    useStore.getState().setStatus('running')
    rafRef.current = requestAnimationFrame(loop)
  }

  function discardRestored() {
    void idbDelete()
    useStore.getState().resetRun()
    setRestoredStep(null)
    setGradNorms([])
  }

  function pause() {
    useStore.getState().setStatus('paused')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    void checkpointNow() // capture the latest state on pause
  }

  function singleStep() {
    if (!getTrainer() || !modelBuilt) build()
    ensureBaselineVal()
    const s = useStore.getState()
    const trainer = getTrainer()!
    const r = trainer.stepBatch(s.trainConfig, s.featureFlags)
    const nextStep = s.step + 1
    s.setStep(nextStep)
    s.pushLoss({ step: nextStep, loss: r.loss })
    maybeValidate(trainer, nextStep, s.trainConfig, s.featureFlags)
    setGradNorms(r.gradNorms)
  }

  // Pause and open the guided forward+backprop walkthrough on a short input.
  function stepThrough() {
    pause()
    const trainer = getTrainer()
    if (!trainer) return
    const ids = trainer.tok.encode(trainingText).slice(0, 8)
    if (ids.length < 2) return
    const input = ids.slice(0, -1)
    const target = ids.slice(1)
    const s = useStore.getState()
    setWalk(
      buildWalkSteps(
        trainer.model,
        trainer.tok,
        input,
        target,
        s.featureFlags,
        s.trainConfig.learningRate,
        s.trainConfig.optimizer,
      ),
    )
  }

  // --- persistence -----------------------------------------------------------
  const fileRef = useRef<HTMLInputElement>(null)
  const [saveMsg, setSaveMsg] = useState('')

  function installLoaded(saved: SavedModel) {
    const t = deserialize(saved)
    setTrainer(t)
    const s = useStore.getState()
    s.setTrainingText(saved.text)
    s.setModelConfig(saved.config) // clears modelBuilt
    s.resetRun()
    s.setModelBuilt(true)
    s.setPretrainedActive(false) // a user-loaded model isn't the bundled one
    // a loaded model may carry LoRA adapters — reflect that (and show the overlay)
    const ft = t.model.loraConfig != null
    s.setFineTuneActive(ft)
    s.setFeatureFlags({ lora: ft })
    if (ft) s.setFineTune({ rank: t.model.loraConfig!.rank, alpha: t.model.loraConfig!.alpha, targets: t.model.loraConfig!.targets })
    if (t.fineTuneText) s.setFineTuneText(t.fineTuneText)
    s.bumpModelVersion()
    setGradNorms([])
    setSaveMsg('loaded ✓')
  }

  // (Re)install the bundled pre-trained model, ready to infer. Used by the explicit
  // button to re-install it over whatever the visitor has since trained (the same
  // model is also installed at startup, see the mount effect).
  async function loadPretrained() {
    setSaveMsg('loading built-in model…')
    if (rafRef.current) cancelAnimationFrame(rafRef.current) // stop any running loop
    const ok = await installBundledModel() // sets the store + clears any interrupted run
    if (!ok) {
      setSaveMsg('built-in model unavailable')
      return
    }
    setRestoredStep(null)
    setGradNorms([])
    setSaveMsg('built-in model loaded ✓')
  }

  function saveToStorage() {
    const t = getTrainer()
    if (!t) return
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(serialize(t, trainingText)))
      setSaveMsg('saved to browser ✓')
    } catch (e) {
      setSaveMsg('save failed (too big for browser storage — use JSON Save): ' + (e as Error).name)
    }
  }

  function downloadJSON() {
    const t = getTrainer()
    if (!t) return
    const blob = new Blob([JSON.stringify(serialize(t, trainingText))], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jabberllm-model.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadFromStorage() {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) {
      setSaveMsg('nothing saved')
      return
    }
    try {
      pause()
      installLoaded(JSON.parse(raw))
    } catch (e) {
      setSaveMsg('load failed: ' + (e as Error).message)
    }
  }

  function loadFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // reset the input so re-selecting the same file fires onChange again
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        pause()
        installLoaded(JSON.parse(String(reader.result)))
      } catch (err) {
        setSaveMsg('load failed: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
  }

  // stop the loop on unmount
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  // Save right before the tab is hidden (about to freeze/discard on sleep), and
  // re-arm the loop if it was frozen mid-run and its rAF got dropped on resume.
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'hidden') {
        void checkpointNow()
      } else if (useStore.getState().status === 'running') {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(loopRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On load: restore an interrupted run if a checkpoint exists (paused, with a
  // Resume banner) so a sleep-induced tab discard no longer loses the run;
  // otherwise install the bundled pre-trained model so inference and inspection
  // work out of the box with zero clicks. The module-level `bootstrapped` latch
  // makes this run exactly once even though StrictMode mounts effects twice.
  useEffect(() => {
    if (bootstrapped) return
    bootstrapped = true
    void (async () => {
      if (getTrainer() || useStore.getState().modelBuilt) return
      let cp
      try {
        cp = await idbGet()
      } catch {
        cp = undefined
      }
      if (getTrainer() || useStore.getState().modelBuilt) return
      if (cp) {
        try {
          const { trainer, run } = restoreCheckpoint(cp)
          setTrainer(trainer)
          const s = useStore.getState()
          s.setTrainingText(cp.model.text)
          s.setModelConfig(cp.model.config)
          s.hydrateRun(run)
          s.setModelBuilt(true)
          s.setPretrainedActive(false)
          s.setStatus('paused')
          s.bumpModelVersion()
          setRestoredStep(run.step)
          return
        } catch {
          /* corrupt/incompatible checkpoint: fall through to the bundled model */
        }
      }
      // No (usable) checkpoint: install the bundled model (ready to infer, 'idle').
      const ok = await installBundledModel()
      if (ok) setSaveMsg('pretrained Shakespeare loaded ✓')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastLoss = lossHistory.at(-1)?.loss
  const trainer = getTrainer()

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-emerald-300">Training</h2>
        <div className="text-[11px] text-slate-400">
          step {step} · loss {lastLoss !== undefined ? lastLoss.toFixed(3) : '—'} · {status}
        </div>
      </div>

      {restoredStep !== null && (
        <div className="flex items-center justify-between gap-2 rounded border border-sky-700 bg-sky-900/40 px-3 py-2 text-[11px] text-sky-100">
          <span>↩ Restored an interrupted run at step {restoredStep}.</span>
          <span className="flex gap-2">
            <button className={btn} onClick={play}>
              ▶ Resume
            </button>
            <button className={btn} onClick={discardRestored}>
              Discard
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-tour="play">
        {status === 'running' ? (
          <button className={btn} onClick={pause} disabled={fineTuneActive}>
            ⏸ Pause
          </button>
        ) : (
          <button
            className={btn}
            onClick={play}
            disabled={fineTuneActive}
            title={fineTuneActive ? 'Fine-tuning — use the LoRA card to pause/resume' : undefined}
          >
            ▶ Play
          </button>
        )}
        <button className={btn} onClick={singleStep} disabled={status === 'running' || fineTuneActive}>
          ⏭ Step
        </button>
        <button
          className={btn}
          onClick={() => {
            pause()
            build()
          }}
        >
          ↺ Rebuild
        </button>
        <button className={btn} onClick={stepThrough} disabled={!modelBuilt}>
          ⇄ Step Through
        </button>
        <label
          className="flex items-center gap-1 text-[11px] text-slate-400"
          title="Auto-tune steps/frame to keep the UI smooth on this device"
        >
          <input
            type="checkbox"
            checked={autoThrottle}
            onChange={(e) => setAutoThrottle(e.target.checked)}
          />
          auto speed
        </label>
        <label className="flex items-center gap-1 text-[11px] text-slate-400">
          steps/frame
          <input
            type="number"
            min={1}
            max={50}
            value={stepsPerFrame}
            disabled={autoThrottle}
            onChange={(e) => {
              const v = Math.max(1, Math.min(50, Number(e.target.value)))
              setStepsPerFrame(v)
              stepsRef.current = v
            }}
            className="w-12 rounded border border-slate-700 bg-slate-800 px-1 text-right text-xs disabled:opacity-40"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-slate-500">model:</span>
        <button className={btn} onClick={saveToStorage} disabled={!modelBuilt}>
          Save
        </button>
        <button className={btn} onClick={loadFromStorage}>
          Load
        </button>
        <button className={btn} onClick={downloadJSON} disabled={!modelBuilt}>
          JSON Save
        </button>
        <button className={btn} onClick={() => fileRef.current?.click()}>
          JSON Load
        </button>
        <button className={btn} onClick={() => void loadPretrained()}>
          Load built-in model
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={loadFromFile} />
        {saveMsg && <span className="text-slate-400">{saveMsg}</span>}
      </div>

      {modelBuilt && <FineTuneCard playLoop={play} pauseLoop={pause} />}

      {!modelBuilt && (
        <div className="rounded border border-dashed border-slate-700 p-3 text-center text-[11px] text-slate-500">
          Press ▶ Play to build a fresh model for the current text &amp; architecture and start
          training.
        </div>
      )}

      <div data-tour="loss">
        <div className="mb-1 flex items-center gap-3 text-[11px] text-slate-400">
          <span>cross-entropy loss</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TRAIN_COLOR }} />
            train {lastLoss !== undefined ? lastLoss.toFixed(3) : '—'}
          </span>
          {valHistory.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: VAL_COLOR }} />
              val {valHistory.at(-1)!.loss.toFixed(3)}
            </span>
          )}
        </div>
        <LineChart
          yLabel="loss"
          series={[
            { label: 'train', color: TRAIN_COLOR, points: lossHistory.map((p) => ({ x: p.step, y: p.loss })) },
            { label: 'val', color: VAL_COLOR, points: valHistory.map((p) => ({ x: p.step, y: p.loss })) },
          ]}
        />
        {store.trainConfig.validationFraction > 0 &&
          (valHistory.length === 0 && step > store.trainConfig.validationEverySteps ? (
            <div className="mt-1 text-[10px] text-amber-400">
              held-out region is too small to validate at this context length — lower context len,
              raise held-out %, or use a longer text.
            </div>
          ) : (
            <div className="mt-1 text-[10px] text-slate-500">
              train falling while val flattens or rises ⇒ overfitting (memorising, not generalising).
            </div>
          ))}
      </div>

      {isSorting && modelBuilt && (
        <div data-tour="grok" className="rounded border border-fuchsia-800/50 bg-fuchsia-950/15 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-fuchsia-300">
              Grokking — will it sort lists it has never seen?
            </span>
            <span className="text-[11px] text-fuchsia-200">
              held-out: {grok.accHist.at(-1)?.acc ?? 0}%
            </span>
          </div>
          <div className="mb-1 text-[10px] text-slate-400">
            Prediction first: will held-out accuracy climb steadily, or sit flat then suddenly jump? Press
            ▶ Play and watch (~1–2 min on the tiny preset).
          </div>
          <LineChart
            yLabel="held-out sort %"
            series={[
              {
                label: 'held-out sort accuracy',
                color: '#e879f9',
                points: grok.accHist.map((p) => ({ x: p.step, y: p.acc })),
              },
            ]}
          />
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <div>
              <div className="mb-1 text-[10px] text-slate-400">digit embeddings → "number line" (PCA)</div>
              <Scatter points={grok.pca} labels={DIGITS} />
            </div>
            <p className="max-w-[15rem] text-[10px] leading-relaxed text-slate-500">
              Held-out accuracy sits near zero, then <span className="text-fuchsia-300">suddenly jumps</span>{' '}
              — the model <em>groks</em> the rule. Around the same time the digits 1–9 line up in order: it
              has learned the <em>concept</em> of order, which is why it now sorts lists it never trained on.
              (Then see <em>which heads</em> do it in the Interpretability lab.)
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-[11px] text-slate-400">
          live sample (regenerated every {store.trainConfig.sampleEverySteps} steps)
        </div>
        <pre className="h-24 overflow-y-auto whitespace-pre-wrap rounded bg-slate-800 p-2 text-[11px] text-slate-200">
          {livePreview || '…'}
        </pre>
      </div>

      {gradNorms.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] text-slate-400">per-parameter gradient norm</div>
          <div className="space-y-0.5">
            {[...gradNorms]
              .sort((a, b) => b.norm - a.norm)
              .slice(0, 12)
              .map((g) => {
                const max = Math.max(...gradNorms.map((x) => x.norm), 1e-9)
                return (
                  <div key={g.label} className="flex items-center gap-1 text-[10px]">
                    <span className="w-20 shrink-0 truncate text-slate-400">{g.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-slate-800">
                      <div
                        className="h-full bg-amber-400/80"
                        style={{ width: `${(g.norm / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-slate-500">{g.norm.toExponential(1)}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {trainer && (
        <WeightHeatmap trainer={trainer} selected={weightParam} onSelect={setWeightParam} />
      )}

      {walk && <Walkthrough steps={walk} onClose={() => setWalk(null)} />}
    </div>
  )
}

function WeightHeatmap({
  trainer,
  selected,
  onSelect,
}: {
  trainer: Trainer
  selected: string
  onSelect: (s: string) => void
}) {
  const params = trainer.model.params
  const param = params.find((p) => p.label === selected) ?? params[0]
  const matrix: Matrix = { rows: param.rows, cols: param.cols, data: param.data }
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
        <span>weights</span>
        <select
          className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[11px] text-slate-100"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          {params
            .filter((p) => p.rows > 1) // skip 1×n bias/gamma vectors here
            .map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} ({p.rows}×{p.cols})
              </option>
            ))}
        </select>
      </div>
      <Heatmap matrix={matrix} scale="diverging" maxCell={10} />
    </div>
  )
}

// LoRA fine-tuning card (collapsed "advanced" by default): adapt the *loaded*
// model by training a tiny low-rank overlay on top of frozen base weights.
// "Start fine-tuning" attaches the adapter AND starts training it (it's the Play
// for fine-tuning); Pause/Resume control that training; the adapter stays attached
// (and live in Inference) until you explicitly "Remove adapter". Compare base vs
// adapted with the "LoRA overlay" toggle in the Inference panel.
function FineTuneCard({ playLoop, pauseLoop }: { playLoop: () => void; pauseLoop: () => void }) {
  const { fineTune, fineTuneText, fineTuneActive, status, setFineTune, setFineTuneText } = useStore()
  const [packId, setPackId] = useState('refrain')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)
  const counts = getTrainer()?.paramCounts()
  // keep it open whenever a fine-tune is active (e.g. after loading an adapted model)
  const expanded = open || fineTuneActive

  function toggleTarget(t: LoraTarget) {
    const targets = fineTune.targets.includes(t)
      ? fineTune.targets.filter((x) => x !== t)
      : [...fineTune.targets, t]
    setFineTune({ targets })
  }

  // Start fine-tuning = attach the adapter and begin training it immediately.
  function start() {
    const trainer = getTrainer()
    if (!trainer) return
    if (fineTune.targets.length === 0) {
      setMsg('pick at least one target (attn / mlp)')
      return
    }
    pauseLoop()
    try {
      trainer.startFineTune({
        rank: fineTune.rank,
        alpha: fineTune.alpha,
        targets: fineTune.targets,
        text: fineTuneText,
      })
    } catch (e) {
      setMsg((e as Error).message)
      return
    }
    const s = useStore.getState()
    s.resetRun()
    s.setModelBuilt(true)
    s.setFineTuneActive(true)
    s.setFeatureFlags({ lora: true })
    s.bumpModelVersion()
    setMsg('')
    playLoop() // Start IS the play for fine-tuning
  }

  // Remove the adapter entirely and return to the plain base model.
  function removeAdapter() {
    const trainer = getTrainer()
    if (!trainer) return
    pauseLoop()
    trainer.stopFineTune()
    const s = useStore.getState()
    s.resetRun()
    s.setModelBuilt(true)
    s.setFineTuneActive(false)
    s.setFeatureFlags({ lora: false })
    s.bumpModelVersion()
    setMsg('')
  }

  const sel =
    'rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-100 disabled:opacity-40'
  const running = status === 'running'

  return (
    <div className="rounded border border-fuchsia-800/60 bg-fuchsia-950/20 p-2">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        disabled={fineTuneActive}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-300">
          {expanded ? '▾' : '▸'} Fine-tune with LoRA{' '}
          <span className="font-normal normal-case text-fuchsia-300/60">(advanced)</span>
        </span>
        {fineTuneActive && counts && (
          <span className="text-[10px] text-fuchsia-200/80">
            training {counts.trainable.toLocaleString()} of {counts.total.toLocaleString()} weights
          </span>
        )}
      </button>

      {expanded && !fineTuneActive && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[10px] text-slate-400">
            Adapt the loaded model by training a tiny low-rank overlay (ΔW = A·B) on top of its frozen
            weights. Pick a target, then Start.
          </p>
          <select
            className={sel + ' w-full'}
            value={packId}
            onChange={(e) => {
              setPackId(e.target.value)
              const p = FINETUNE_PACKS.find((x) => x.id === e.target.value)
              if (p) setFineTuneText(p.text)
            }}
          >
            {FINETUNE_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="custom">Custom text…</option>
          </select>
          {packId !== 'custom' && (
            <p className="text-[10px] text-slate-400">
              {FINETUNE_PACKS.find((p) => p.id === packId)?.description}
            </p>
          )}
          <textarea
            className="h-16 w-full resize-y rounded border border-slate-700 bg-slate-800 p-1.5 text-[11px] leading-tight text-slate-100"
            placeholder="paste a short text to fine-tune toward…"
            value={fineTuneText}
            onChange={(e) => {
              setFineTuneText(e.target.value)
              setPackId('custom')
            }}
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            <label className="flex items-center gap-1">
              rank
              <input
                type="number"
                min={1}
                max={32}
                className={sel + ' w-12 text-right'}
                value={fineTune.rank}
                onChange={(e) => setFineTune({ rank: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="flex items-center gap-1">
              alpha
              <input
                type="number"
                min={1}
                className={sel + ' w-12 text-right'}
                value={fineTune.alpha}
                onChange={(e) => setFineTune({ alpha: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={fineTune.targets.includes('attn')}
                onChange={() => toggleTarget('attn')}
              />
              attn
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={fineTune.targets.includes('mlp')}
                onChange={() => toggleTarget('mlp')}
              />
              mlp
            </label>
          </div>
          <button className={btn} onClick={start} disabled={!fineTuneText.trim()}>
            ✦ Start fine-tuning
          </button>
          {msg && <span className="ml-2 text-[10px] text-amber-400">{msg}</span>}
        </div>
      )}

      {fineTuneActive && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <button className={btn} onClick={pauseLoop}>
                ⏸ Pause fine-tuning
              </button>
            ) : (
              <button className={btn} onClick={playLoop}>
                ▶ Resume fine-tuning
              </button>
            )}
            <button className={btn} onClick={removeAdapter}>
              ✕ Remove adapter
            </button>
          </div>
          <p className="text-[10px] text-slate-300">
            {running ? 'Training the adapter…' : 'Paused.'} Only the overlay moves — the base is frozen
            (rank {fineTune.rank}, α {fineTune.alpha}, {fineTune.targets.join('+') || 'none'}).{' '}
            <span className="text-emerald-300">✓ Your fine-tuned model is live in Inference</span> right
            now — type a prompt there and toggle <span className="text-fuchsia-300">LoRA overlay</span>{' '}
            to compare with the base. <span className="text-slate-100">JSON Save</span> keeps it
            (auto-save is paused while fine-tuning); <span className="text-slate-100">Remove adapter</span>{' '}
            reverts to the plain base.
          </p>
        </div>
      )}
    </div>
  )
}
