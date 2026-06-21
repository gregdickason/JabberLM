import { deserialize, type SavedModel } from '../engine/persist'
import { setTrainer } from '../engine/trainer'
import { idbDelete } from '../engine/checkpoint'
import { useStore } from './store'

// The bundled pre-trained model (trained offline on the "Jabber Poems" set —
// Jabberwocky plus 49 more in the same invented style) ships with the site so the
// app works out of the box: inference and inspection run immediately without
// anyone having to train first. This module is the single source of truth for
// fetching and installing it — shared by the main app (auto-load at start +
// manual buttons) and the explainer's fallback.

// Fetch the canonical pre-trained model bundled with the site (one place owns the
// file name + parse). Returns null on a missing/failed response rather than throwing.
export async function fetchBundledModel(): Promise<SavedModel | null> {
  const res = await fetch(import.meta.env.BASE_URL + 'jabber-model.json')
  if (!res.ok) return null
  return (await res.json()) as SavedModel
}

// Install the bundled model as the live model: load its weights into the engine
// and point the store at it (ready to infer, status 'idle'). Drops any interrupted
// run so a reload re-offers/loads this model rather than a stale checkpoint.
// Returns false (does not throw) if the model can't be fetched, so callers can
// surface a message instead of dying.
export async function installBundledModel(): Promise<boolean> {
  let saved: SavedModel | null
  try {
    saved = await fetchBundledModel()
  } catch {
    return false
  }
  if (!saved) return false

  setTrainer(deserialize(saved))
  const s = useStore.getState()
  s.setTrainingText(saved.text)
  s.setModelConfig(saved.config) // clears modelBuilt
  s.resetRun()
  s.setModelBuilt(true)
  s.setPretrainedActive(true)
  s.bumpModelVersion()
  try {
    await idbDelete()
  } catch {
    /* best-effort: a leftover checkpoint must not break the install */
  }
  return true
}
