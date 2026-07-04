import { deserialize, type SavedModel } from '../engine/persist'
import { idbGet, restoreCheckpoint } from '../engine/checkpoint'
import { Trainer } from '../engine/trainer'
import { fetchBundledModel } from '../state/pretrained'

// The lab runs in its own browser tab (a fresh JS context). By default it loads the
// KNOWN-GOOD bundled model so every section is robust regardless of what the visitor
// has trained; inspecting your own model is an explicit opt-in (loadUserModel / the
// "Inspect my last training run" button, or Upload).

const LS_KEY = 'jabberllm-model'

export interface LoadedModel {
  trainer: Trainer
  source: string
}

/** The bundled three-skill model — the robust default for all lab sections. */
export async function loadBundled(): Promise<LoadedModel | null> {
  try {
    const saved = await fetchBundledModel()
    if (saved) return { trainer: deserialize(saved), source: 'the built-in three-skill model' }
  } catch {
    /* ignore */
  }
  return null
}

/** The visitor's own model, if any: most recent training run (IndexedDB) then the
 *  browser save. Returns null when the visitor has never trained/saved a model. */
export async function loadUserModel(): Promise<LoadedModel | null> {
  try {
    const cp = await idbGet()
    if (cp) return { trainer: restoreCheckpoint(cp).trainer, source: `your last training run (step ${cp.run.step})` }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { trainer: deserialize(JSON.parse(raw) as SavedModel), source: 'your browser save' }
  } catch {
    /* ignore */
  }
  return null
}

/** Default lab load: the bundled model, falling back to the visitor's own only if
 *  the bundled model is unavailable (e.g. offline). */
export async function autoLoadModel(): Promise<LoadedModel | null> {
  return (await loadBundled()) ?? (await loadUserModel())
}

/** Load from an uploaded JSON model file's text. */
export function loadModelFromText(text: string): LoadedModel {
  return { trainer: deserialize(JSON.parse(text) as SavedModel), source: 'uploaded JSON' }
}
