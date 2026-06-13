// Central configuration types for the model and its toggleable features.
// These are the knobs surfaced in the ConfigSidebar.

export type PositionalMode = 'learned' | 'rope' | 'none'
export type Activation = 'gelu' | 'relu'
export type OptimizerKind = 'sgd' | 'adamw'

/** Structural hyperparameters. Changing any of these requires rebuilding the
 *  model (and therefore retraining), since the parameter shapes change. */
export interface ModelConfig {
  vocabSize: number // derived from the training text's unique characters
  dModel: number // residual stream / embedding width
  nHeads: number // attention heads (dModel must be divisible by nHeads)
  nLayers: number // number of decoder blocks
  contextLen: number // maximum sequence length the model can attend over
  dFF: number // MLP hidden width (typically 4 * dModel)
  activation: Activation
  weightTying: boolean // tie the unembedding to the token embedding matrix
}

/** Feature flags that can be toggled live (most do NOT require a rebuild). */
export interface FeatureFlags {
  positional: PositionalMode
  causalMask: boolean // lower-triangular masking (decoder-only default: true)
  slidingWindow: number | null // null = full causal; otherwise window width W
  kvCache: boolean // inference-only: reuse cached K/V across generation steps
  ropeBase: number // RoPE theta base (only used when positional === 'rope')
}

/** Training hyperparameters — editable live while the loop runs. */
export interface TrainConfig {
  optimizer: OptimizerKind
  learningRate: number
  batchSize: number
  gradClip: number | null // max global grad norm, or null to disable
  weightDecay: number // AdamW decoupled weight decay
  sampleEverySteps: number // regenerate the live preview sample every N steps
  validationFraction: number // tail fraction held out for validation; 0 = off
  validationEverySteps: number // measure validation loss every N steps
}

/** Inference / sampling hyperparameters — editable live. */
export interface SampleConfig {
  temperature: number
  topK: number | null
  topP: number | null
  maxNewTokens: number
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  vocabSize: 0, // filled in once a tokenizer is built from the text
  dModel: 48,
  nHeads: 3,
  nLayers: 3,
  contextLen: 48,
  dFF: 192,
  activation: 'gelu',
  weightTying: true,
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  positional: 'learned',
  causalMask: true,
  slidingWindow: null,
  kvCache: false,
  ropeBase: 10000,
}

export const DEFAULT_TRAIN_CONFIG: TrainConfig = {
  optimizer: 'adamw',
  learningRate: 0.01,
  batchSize: 16,
  gradClip: 1.0,
  weightDecay: 0.001,
  sampleEverySteps: 25,
  validationFraction: 0,
  validationEverySteps: 25,
}

export const DEFAULT_SAMPLE_CONFIG: SampleConfig = {
  temperature: 0.8,
  topK: null,
  topP: null,
  maxNewTokens: 200,
}

export const HEAD_DIM = (c: ModelConfig): number => Math.floor(c.dModel / c.nHeads)
