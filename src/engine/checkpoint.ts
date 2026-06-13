import { Trainer } from './trainer'
import { serialize, deserialize, type SavedModel } from './persist'

// Auto-checkpointing so a training run survives the tab being frozen/discarded
// when the machine sleeps. We persist the model (weights + config + text, via the
// existing serialize/deserialize) PLUS the run progress (step + loss curves) to
// IndexedDB, and restore it on next load.
//
// Note: the optimizer's Adam moments are intentionally NOT checkpointed — a
// resumed run restarts the optimizer fresh, which causes only a small, transient
// loss bump. Fine for a teaching tool; checkpointing optimizer state would be an
// optional future enhancement.

export interface LossPoint {
  step: number
  loss: number
}

export interface RunState {
  step: number
  lossHistory: LossPoint[]
  valHistory: LossPoint[]
}

export interface Checkpoint {
  version: number
  model: SavedModel
  run: RunState
  savedAt: number
}

const VERSION = 1

// --- pure (unit-testable) ---------------------------------------------------

export function makeCheckpoint(trainer: Trainer, text: string, run: RunState, now: number): Checkpoint {
  return { version: VERSION, model: serialize(trainer, text), run, savedAt: now }
}

export function restoreCheckpoint(cp: Checkpoint): { trainer: Trainer; run: RunState } {
  if (cp.version !== VERSION) throw new Error(`unsupported checkpoint version ${cp.version}`)
  return { trainer: deserialize(cp.model), run: cp.run }
}

// --- IndexedDB IO (async, structured-clone; no JSON, no size cap) -----------

const DB_NAME = 'jabberlm'
const STORE = 'checkpoints'
const KEY = 'current'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPut(cp: Checkpoint): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(cp, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function idbGet(): Promise<Checkpoint | null> {
  const db = await openDB()
  try {
    return await new Promise<Checkpoint | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as Checkpoint) ?? null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function idbDelete(): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
