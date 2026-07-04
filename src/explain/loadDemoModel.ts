import { deserialize, type SavedModel } from '../engine/persist'
import { idbGet, restoreCheckpoint } from '../engine/checkpoint'
import { Trainer } from '../engine/trainer'
import { fetchBundledModel } from '../state/pretrained'

// The explainer/learn pages need a KNOWN-GOOD model to drive their teaching demos.
// They default to the bundled "three-skill" model so the demos are always robust —
// a visitor's half-trained model must never shadow it. Only if the bundled fetch
// fails (e.g. offline) do we fall back to the visitor's own saved model.

const LS_KEY = 'jabberllm-model'

export interface LoadedModel {
  trainer: Trainer
  source: string
}

export async function loadDemoModel(): Promise<LoadedModel | null> {
  // 1. the bundled pre-trained model (a tiny "three-skill" model: poems + sorting + algebra)
  try {
    const saved = await fetchBundledModel()
    if (saved) return { trainer: deserialize(saved), source: 'a tiny three-skill model (poems, sorting, arithmetic)' }
  } catch {
    /* ignore */
  }
  // 2. offline fallback: the visitor's last training run
  try {
    const cp = await idbGet()
    if (cp) return { trainer: restoreCheckpoint(cp).trainer, source: 'your last training run' }
  } catch {
    /* ignore */
  }
  // 3. offline fallback: the visitor's saved model
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { trainer: deserialize(JSON.parse(raw) as SavedModel), source: 'your saved model' }
  } catch {
    /* ignore */
  }
  return null
}
