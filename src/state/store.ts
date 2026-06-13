import { create } from 'zustand'
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_SAMPLE_CONFIG,
  DEFAULT_TRAIN_CONFIG,
  type FeatureFlags,
  type ModelConfig,
  type SampleConfig,
  type TrainConfig,
} from '../engine/config'
import { JABBERWOCKY } from '../data/jabberwocky'

export type TrainStatus = 'idle' | 'running' | 'paused'

export interface LossPoint {
  step: number
  loss: number
}

/** Which layer/head the inspector is currently drilled into. */
export interface InspectSelection {
  layer: number
  head: number
}

interface AppState {
  // --- configuration (the knobs) ---
  trainingText: string
  modelConfig: ModelConfig
  featureFlags: FeatureFlags
  trainConfig: TrainConfig
  sampleConfig: SampleConfig

  // --- training run metadata (the model itself lives outside the store) ---
  status: TrainStatus
  step: number
  lossHistory: LossPoint[]
  valHistory: LossPoint[] // held-out validation loss (sparser than lossHistory)
  livePreview: string // sample regenerated periodically during training
  modelBuilt: boolean // has a model been constructed for the current config?

  // --- inspector UI state ---
  inspect: InspectSelection

  // bumped whenever a new model is installed (rebuild/load) so views can reset
  modelVersion: number

  // --- actions ---
  setTrainingText: (t: string) => void
  bumpModelVersion: () => void
  setModelConfig: (patch: Partial<ModelConfig>) => void
  setFeatureFlags: (patch: Partial<FeatureFlags>) => void
  setTrainConfig: (patch: Partial<TrainConfig>) => void
  setSampleConfig: (patch: Partial<SampleConfig>) => void
  setStatus: (s: TrainStatus) => void
  setInspect: (patch: Partial<InspectSelection>) => void
  pushLoss: (p: LossPoint) => void
  pushVal: (p: LossPoint) => void
  hydrateRun: (run: { step: number; lossHistory: LossPoint[]; valHistory: LossPoint[] }) => void
  setStep: (n: number) => void
  setLivePreview: (s: string) => void
  setModelBuilt: (b: boolean) => void
  resetRun: () => void
}

export const useStore = create<AppState>((set) => ({
  trainingText: JABBERWOCKY,
  modelConfig: { ...DEFAULT_MODEL_CONFIG },
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  trainConfig: { ...DEFAULT_TRAIN_CONFIG },
  sampleConfig: { ...DEFAULT_SAMPLE_CONFIG },

  status: 'idle',
  step: 0,
  lossHistory: [],
  valHistory: [],
  livePreview: '',
  modelBuilt: false,

  inspect: { layer: 0, head: 0 },
  modelVersion: 0,

  // changing the corpus changes the vocabulary, so the built model is now stale
  setTrainingText: (t) => set({ trainingText: t, modelBuilt: false }),
  bumpModelVersion: () => set((s) => ({ modelVersion: s.modelVersion + 1 })),
  setModelConfig: (patch) =>
    set((s) => ({ modelConfig: { ...s.modelConfig, ...patch }, modelBuilt: false })),
  setFeatureFlags: (patch) => set((s) => ({ featureFlags: { ...s.featureFlags, ...patch } })),
  setTrainConfig: (patch) => set((s) => ({ trainConfig: { ...s.trainConfig, ...patch } })),
  setSampleConfig: (patch) => set((s) => ({ sampleConfig: { ...s.sampleConfig, ...patch } })),
  setStatus: (status) => set({ status }),
  setInspect: (patch) => set((s) => ({ inspect: { ...s.inspect, ...patch } })),
  pushLoss: (p) => set((s) => ({ lossHistory: [...s.lossHistory, p] })),
  pushVal: (p) => set((s) => ({ valHistory: [...s.valHistory, p] })),
  hydrateRun: (run) =>
    set({ step: run.step, lossHistory: run.lossHistory, valHistory: run.valHistory }),
  setStep: (step) => set({ step }),
  setLivePreview: (livePreview) => set({ livePreview }),
  setModelBuilt: (modelBuilt) => set({ modelBuilt }),
  resetRun: () =>
    set({ status: 'idle', step: 0, lossHistory: [], valHistory: [], livePreview: '', modelBuilt: false }),
}))
