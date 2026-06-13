import type { ModelConfig } from './config'
import { Trainer } from './trainer'

// Save/load a trained model so users don't have to retrain. We serialise the
// training text (which defines the vocabulary), the structural config, and every
// parameter's flat values. Loading rebuilds an identically-shaped Trainer and
// copies the saved values into its parameters by label.

const VERSION = 1

export interface SavedModel {
  version: number
  text: string
  config: ModelConfig
  params: { label: string; rows: number; cols: number; data: number[] }[]
}

export function serialize(trainer: Trainer, text: string): SavedModel {
  return {
    version: VERSION,
    text,
    config: trainer.cfg,
    params: trainer.model.params.map((p) => ({
      label: p.label,
      rows: p.rows,
      cols: p.cols,
      data: Array.from(p.data),
    })),
  }
}

/** Rebuild a Trainer from a saved model and load its weights. Throws on mismatch. */
export function deserialize(saved: SavedModel): Trainer {
  if (saved.version !== VERSION) throw new Error(`unsupported save version ${saved.version}`)
  const trainer = new Trainer(saved.text, saved.config)
  const byLabel = new Map(saved.params.map((p) => [p.label, p]))
  for (const param of trainer.model.params) {
    const s = byLabel.get(param.label)
    if (!s || s.rows !== param.rows || s.cols !== param.cols) {
      throw new Error(`saved model does not match: ${param.label}`)
    }
    param.data.set(s.data)
  }
  return trainer
}
