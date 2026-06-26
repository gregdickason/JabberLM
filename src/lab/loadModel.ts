import { deserialize, type SavedModel } from '../engine/persist'
import { idbGet, restoreCheckpoint } from '../engine/checkpoint'
import { Trainer } from '../engine/trainer'
import { fetchBundledModel } from '../state/pretrained'

// The lab runs in its own browser tab (a fresh JS context), so it can't see the
// main app's in-memory model. It loads one from persistent storage instead — the
// IndexedDB auto-checkpoint or the localStorage save — and otherwise falls back to
// the bundled three-skill model, so the lab works out of the box.

const LS_KEY = 'jabberllm-model'

export interface LoadedModel {
  trainer: Trainer
  source: string
}

/** Try the most recent training run (IndexedDB), then the browser save, then the
 *  bundled model. */
export async function autoLoadModel(): Promise<LoadedModel | null> {
  try {
    const cp = await idbGet()
    if (cp) {
      return { trainer: restoreCheckpoint(cp).trainer, source: `last training run (step ${cp.run.step})` }
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { trainer: deserialize(JSON.parse(raw) as SavedModel), source: 'browser save' }
  } catch {
    /* ignore */
  }
  try {
    const saved = await fetchBundledModel()
    if (saved) return { trainer: deserialize(saved), source: 'the built-in three-skill model' }
  } catch {
    /* ignore */
  }
  return null
}

/** Load from an uploaded JSON model file's text. */
export function loadModelFromText(text: string): LoadedModel {
  return { trainer: deserialize(JSON.parse(text) as SavedModel), source: 'uploaded JSON' }
}
