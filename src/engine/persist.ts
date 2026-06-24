import type { LoraTarget, ModelConfig } from './config'
import { Trainer } from './trainer'

// Save/load a trained model so users don't have to retrain. We serialise the
// training text (which defines the vocabulary), the structural config, and every
// parameter's flat values. Loading rebuilds an identically-shaped Trainer and
// copies the saved values into its parameters by label. LoRA adapters (if the
// model is fine-tuned) are saved in an optional `lora` block — older files
// without it still load as a plain base model.

const VERSION = 1

interface SavedParam {
  label: string
  rows: number
  cols: number
  data: number[]
}

export interface SavedModel {
  version: number
  text: string
  config: ModelConfig
  params: SavedParam[]
  lora?: {
    rank: number
    alpha: number
    targets: LoraTarget[]
    text: string // the fine-tune corpus (encoded with the base vocab)
    params: SavedParam[] // the adapter A/B matrices
  }
}

const dumpParam = (p: { label: string; rows: number; cols: number; data: Float32Array }): SavedParam => ({
  label: p.label,
  rows: p.rows,
  cols: p.cols,
  data: Array.from(p.data),
})

export function serialize(trainer: Trainer, text: string): SavedModel {
  const m = trainer.model
  const saved: SavedModel = {
    version: VERSION,
    text,
    config: trainer.cfg,
    params: m.params.map(dumpParam),
  }
  if (m.loraConfig) {
    saved.lora = {
      rank: m.loraConfig.rank,
      alpha: m.loraConfig.alpha,
      targets: m.loraConfig.targets,
      text: trainer.fineTuneText ?? '',
      params: m.loraParams.map(dumpParam),
    }
  }
  return saved
}

/** Rebuild a Trainer from a saved model and load its weights. Throws on mismatch. */
export function deserialize(saved: SavedModel): Trainer {
  if (saved.version !== VERSION) throw new Error(`unsupported save version ${saved.version}`)
  const trainer = new Trainer(saved.text, saved.config)
  const loadInto = (targets: { label: string; rows: number; cols: number; data: Float32Array }[], src: SavedParam[], kind: string) => {
    const byLabel = new Map(src.map((p) => [p.label, p]))
    for (const param of targets) {
      const s = byLabel.get(param.label)
      if (!s || s.rows !== param.rows || s.cols !== param.cols) {
        throw new Error(`saved ${kind} does not match: ${param.label}`)
      }
      param.data.set(s.data)
    }
  }
  loadInto(trainer.model.params, saved.params, 'model')

  if (saved.lora) {
    const { rank, alpha, targets, text } = saved.lora
    // Restore a resumable fine-tune when we still have the text; otherwise just
    // attach the adapters so the overlay can be inspected / generated with.
    if (text && trainer.tok.encode(text).length >= 2) {
      trainer.startFineTune({ rank, alpha, targets, text })
    } else {
      trainer.model.enableLora({ rank, alpha, targets })
    }
    loadInto(trainer.model.loraParams, saved.lora.params, 'adapter')
  }
  return trainer
}
