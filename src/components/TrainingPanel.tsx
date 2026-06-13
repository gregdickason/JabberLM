import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getTrainer, rebuildTrainer, setTrainer, type Trainer } from '../engine/trainer'
import type { GradNorm } from '../engine/optimizer'
import { deserialize, serialize, type SavedModel } from '../engine/persist'
import { idbDelete, idbGet, idbPut, makeCheckpoint, restoreCheckpoint } from '../engine/checkpoint'
import type { FeatureFlags, TrainConfig } from '../engine/config'
import { buildWalkSteps, type WalkStep } from '../engine/walkthrough'
import Walkthrough from './Walkthrough'
import LineChart from '../viz/LineChart'
import Heatmap from '../viz/Heatmap'
import type { Matrix } from '../engine/trace'

const LS_KEY = 'jabberllm-model'

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
  } = store

  const rafRef = useRef<number | null>(null)
  const loopRef = useRef<() => void>(() => {})
  const lastSaveRef = useRef(0)
  const [stepsPerFrame, setStepsPerFrame] = useState(3)
  const [gradNorms, setGradNorms] = useState<GradNorm[]>([])
  const [weightParam, setWeightParam] = useState('tokenEmbed')
  const [walk, setWalk] = useState<WalkStep[] | null>(null)
  const [restoredStep, setRestoredStep] = useState<number | null>(null)

  // Write the current run (model + step + loss curves) to IndexedDB so it
  // survives the tab being frozen/discarded when the machine sleeps. Reads
  // everything from the store so it's stable and cheap to call.
  async function checkpointNow() {
    const s = useStore.getState()
    const trainer = getTrainer()
    if (!trainer || !s.modelBuilt) return
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
    useStore.getState().bumpModelVersion()
    setGradNorms([])
    setRestoredStep(null) // a new run replaces any restored checkpoint
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
    for (let i = 0; i < stepsPerFrame; i++) {
      result = trainer.stepBatch(s.trainConfig, s.featureFlags)
      const nextStep = useStore.getState().step + 1
      useStore.getState().setStep(nextStep)
      useStore.getState().pushLoss({ step: nextStep, loss: result.loss })
      maybeValidate(trainer, nextStep, s.trainConfig, s.featureFlags)
      if (nextStep % s.trainConfig.sampleEverySteps === 0) {
        const seed = trainingText.slice(0, 1)
        useStore.getState().setLivePreview(trainer.sample(s.featureFlags, s.sampleConfig, seed, 120))
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
    s.bumpModelVersion()
    setGradNorms([])
    setSaveMsg('loaded ✓')
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

  // On load, restore an interrupted run (if a checkpoint exists) — paused, with a
  // Resume banner — so a sleep-induced tab discard no longer loses the run.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (getTrainer() || useStore.getState().modelBuilt) return
      let cp
      try {
        cp = await idbGet()
      } catch {
        return
      }
      if (!cp || cancelled || getTrainer() || useStore.getState().modelBuilt) return
      try {
        const { trainer, run } = restoreCheckpoint(cp)
        setTrainer(trainer)
        const s = useStore.getState()
        s.setTrainingText(cp.model.text)
        s.setModelConfig(cp.model.config)
        s.hydrateRun(run)
        s.setModelBuilt(true)
        s.setStatus('paused')
        s.bumpModelVersion()
        setRestoredStep(run.step)
      } catch {
        /* corrupt/incompatible checkpoint: ignore and start fresh */
      }
    })()
    return () => {
      cancelled = true
    }
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

      <div className="flex flex-wrap items-center gap-2">
        {status === 'running' ? (
          <button className={btn} onClick={pause}>
            ⏸ Pause
          </button>
        ) : (
          <button className={btn} onClick={play}>
            ▶ Play
          </button>
        )}
        <button className={btn} onClick={singleStep} disabled={status === 'running'}>
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
        <label className="flex items-center gap-1 text-[11px] text-slate-400">
          steps/frame
          <input
            type="number"
            min={1}
            max={50}
            value={stepsPerFrame}
            onChange={(e) => setStepsPerFrame(Number(e.target.value))}
            className="w-12 rounded border border-slate-700 bg-slate-800 px-1 text-right text-xs"
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
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={loadFromFile} />
        {saveMsg && <span className="text-slate-400">{saveMsg}</span>}
      </div>

      {!modelBuilt && (
        <div className="rounded border border-dashed border-slate-700 p-3 text-center text-[11px] text-slate-500">
          Press ▶ Play to build a fresh model for the current text &amp; architecture and start
          training.
        </div>
      )}

      <div>
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
