import { deserialize, type SavedModel } from '../engine/persist'
import { idbGet, restoreCheckpoint } from '../engine/checkpoint'
import { Trainer } from '../engine/trainer'
import { fetchBundledModel } from '../state/pretrained'

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
  // 3. the bundled pre-trained model (a tiny "three-skill" model: poems + sorting + algebra)
  try {
    const saved = await fetchBundledModel()
    if (saved) return { trainer: deserialize(saved), source: 'a tiny three-skill model (poems, sorting, arithmetic)' }
  } catch {
    /* ignore */
  }
  return null
}
