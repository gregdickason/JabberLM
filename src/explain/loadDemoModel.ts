import { deserialize, type SavedModel } from '../engine/persist'
import { idbGet, restoreCheckpoint } from '../engine/checkpoint'
import { Trainer } from '../engine/trainer'

// The explainer needs a trained model to drive its live demos. It prefers the
// visitor's own model (from the main app, via IndexedDB or the browser save) and
// otherwise falls back to a small pre-trained model bundled with the site, so the
// page works even for someone who has never trained anything.

const LS_KEY = 'jabberllm-model'

export interface LoadedModel {
  trainer: Trainer
  source: string
}

export async function loadDemoModel(): Promise<LoadedModel | null> {
  // 1. the visitor's last training run
  try {
    const cp = await idbGet()
    if (cp) return { trainer: restoreCheckpoint(cp).trainer, source: 'your last training run' }
  } catch {
    /* ignore */
  }
  // 2. the visitor's saved model
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { trainer: deserialize(JSON.parse(raw) as SavedModel), source: 'your saved model' }
  } catch {
    /* ignore */
  }
  // 3. the bundled pre-trained demo model
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'demo-model.json')
    if (res.ok) {
      const saved = (await res.json()) as SavedModel
      return { trainer: deserialize(saved), source: 'a small built-in demo model' }
    }
  } catch {
    /* ignore */
  }
  return null
}
