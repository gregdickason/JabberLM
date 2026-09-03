// Page-local glue between the engine and the pure warehouse task: run a model on a
// basket, parse its plan, score it. Kept out of src/data/warehouse.ts so that module
// stays engine-free (it's the training-corpus source of truth).
import { Model } from '../engine/model'
import { Trainer } from '../engine/trainer'
import { deserialize, type SavedModel } from '../engine/persist'
import { CharTokenizer } from '../engine/tokenizer'
import { generate } from '../engine/generate'
import { RNG } from '../engine/random'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, type ModelConfig } from '../engine/config'
import {
  warePrompt, parsePlan, warehouseReward, extraTiles, tourTiles, optimalTiles,
  type Basket, type PackAction,
} from '../data/warehouse'

// The from-scratch model the "train it yourself" panel builds — matches the bundled
// warehouse-model.json config. ctx 96: shorter contexts can't reliably copy the basket
// multiset into the plan; 96 is the proven config (held-out ~90%).
/** The bundled trained warehouse agent (public/warehouse-model.json), or null if absent. */
export async function loadWarehouseModel(): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'warehouse-model.json')
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

export const CAPSTONE_CFG: ModelConfig = {
  vocabSize: 0, dModel: 32, nHeads: 2, nLayers: 2, contextLen: 96, dFF: 96, activation: 'gelu', weightTying: true,
}

export interface AgentRun {
  basket: Basket
  prompt: string
  planText: string // the raw generated plan line
  actions: PackAction[] | null // parsed, or null if malformed
  correct: boolean // matches the relational rules AND fetches exactly the basket
  tiles: number | null // tiles the agent's tour travels
  optimal: number // shortest possible tour
  extra: number | null // wasted tiles vs optimal (null if the plan is wrong)
}

/** Run the model greedily on one basket and score the result. */
export function runBasket(model: Model, tok: CharTokenizer, basket: Basket): AgentRun {
  const prompt = warePrompt(basket)
  const out = generate(model, DEFAULT_FEATURE_FLAGS, tok, prompt, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: 64 }, new RNG(1))
  const planText = out.split('\n')[0]
  const actions = parsePlan(planText)
  return {
    basket,
    prompt,
    planText,
    actions,
    correct: warehouseReward(prompt, planText) === 1,
    tiles: actions ? tourTiles(actions.map((a) => a.sku)) : null,
    optimal: optimalTiles(basket),
    extra: extraTiles(prompt, planText),
  }
}

/** Held-out exact-match accuracy + mean wasted tiles (over correct plans). */
export function heldOutStats(model: Model, tok: CharTokenizer, baskets: Basket[]): { acc: number; avgExtra: number } {
  let ok = 0, extraSum = 0, extraN = 0
  for (const b of baskets) {
    const r = runBasket(model, tok, b)
    if (r.correct) { ok++; if (r.extra != null) { extraSum += r.extra; extraN++ } }
  }
  return { acc: baskets.length ? Math.round((100 * ok) / baskets.length) : 0, avgExtra: extraN ? extraSum / extraN : 0 }
}
