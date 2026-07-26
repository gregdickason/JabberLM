import { describe, it, expect } from 'vitest'
import { Trainer } from '../../engine/trainer'
import { generate } from '../../engine/generate'
import { RNG } from '../../engine/random'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../../engine/config'
import {
  allBaskets, trainBaskets, heldOutBaskets, warePrompt, planActions,
  buildWarehouseCorpus, warehouseReward, extraTiles, padFor, boxFor,
  type Basket,
} from '../warehouse'

// ---- pure task: planner + verifier + split ---------------------------------

describe('warehouse task (pure)', () => {
  it('applies the relational packing rules', () => {
    // fragile pads ONLY when something heavy shares the basket
    expect(padFor('A', ['A'])).toBe(false)
    expect(padFor('A', ['A', 'C'])).toBe(true) // C is heavy
    expect(padFor('C', ['A', 'C'])).toBe(false) // heavy items never pad
    // chemical → box 2 ONLY when food shares the basket
    expect(boxFor('E', ['E'])).toBe(1)
    expect(boxFor('E', ['E', 'D'])).toBe(2) // D is food
    expect(boxFor('D', ['E', 'D'])).toBe(1) // food itself isn't chemical
  })

  it('the expert planner is verifier-correct for every basket', () => {
    for (const b of allBaskets()) {
      const plan = planActions(b).join(' ') + ' done'
      expect(warehouseReward(warePrompt(b), plan)).toBe(1)
    }
  })

  it('the verifier rejects wrong pad/box/quantity', () => {
    expect(warehouseReward('order: A C => ', 'get A pad pack1 get C pack1 done')).toBe(1)
    expect(warehouseReward('order: A C => ', 'get A pack1 get C pack1 done')).toBe(0) // missing pad
    expect(warehouseReward('order: D E => ', 'get D pack1 get E pack2 done')).toBe(1)
    expect(warehouseReward('order: D E => ', 'get D pack1 get E pack1 done')).toBe(0) // E should be box2
    expect(warehouseReward('order: A C => ', 'get A pad pack1 done')).toBe(0) // dropped an item
    expect(warehouseReward('order: A C => ', 'get A pad pack1 get C pack1 get B pack1 done')).toBe(0) // extra item
    expect(warehouseReward('order: A C => ', 'get A pad pack1 get C pack1')).toBe(0) // no `done`
  })

  it('splits the baskets disjointly and keeps each rule live in both sides', () => {
    const train = trainBaskets(), held = heldOutBaskets()
    const key = (b: Basket) => b.join('')
    const all = allBaskets()
    expect(train.length + held.length).toBe(all.length)
    expect(all.length).toBe(83) // multisets of size 1-3 over 6 SKUs: 6 + 21 + 56
    const inHeld = new Set(held.map(key))
    expect(train.some((b) => inHeld.has(key(b)))).toBe(false) // disjoint
    const padTrig = (b: Basket) => new Set(b.map((x) => (x === 'C' ? 'h' : ['A', 'B'].includes(x) ? 'f' : ''))).size >= 2
    const box2Trig = (b: Basket) => b.includes('D') && (b.includes('E') || b.includes('F'))
    expect(held.filter(padTrig).length).toBeGreaterThanOrEqual(2)
    expect(held.filter(box2Trig).length).toBeGreaterThanOrEqual(2)
    expect(train.filter(padTrig).length).toBeGreaterThanOrEqual(2)
    expect(train.filter(box2Trig).length).toBeGreaterThanOrEqual(2)
  })
})

// ---- SFT feasibility: does a tiny model learn the RULE and generalise? -------

const CFG: ModelConfig = { vocabSize: 0, dModel: 32, nHeads: 2, nLayers: 2, contextLen: 96, dFF: 96, activation: 'gelu', weightTying: true }

function evalBaskets(t: Trainer, baskets: Basket[]): { acc: number; avgExtra: number } {
  let ok = 0, extraSum = 0, extraN = 0
  for (const b of baskets) {
    const prompt = warePrompt(b)
    const out = generate(t.model, DEFAULT_FEATURE_FLAGS, t.tok, prompt, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: 64 }, new RNG(1))
    const plan = out.split('\n')[0]
    if (warehouseReward(prompt, plan) === 1) {
      ok++
      const ex = extraTiles(prompt, plan)
      if (ex != null) { extraSum += ex; extraN++ }
    }
  }
  return { acc: Math.round((100 * ok) / baskets.length), avgExtra: extraN ? extraSum / extraN : 0 }
}

// Heavy (~7 min single-threaded) — skipped in the normal suite; run on demand to re-verify
// the config. Measured result (dModel 32, 2 heads, 2 layers, ctx 96, dFF 96 → 24,896 params,
// vocab 24; SFT expert lists items in sorted/prompt order so the plan is a straight copy):
// 2500 SFT steps → held-out 0%→~85-90% (the bundled, 6dp-rounded model evals ~85%). Proof it
// learned the RULE not a lookup, since the held-out baskets were never trained on. (ctx 72
// underperformed — the short context can't copy the basket faithfully; and reordered "optimal
// tour" targets make the tiny model drop/conflate same-attribute items, so SFT uses sorted
// order and RL is left to improve accuracy on the hard cases from the verifier.)
describe('warehouse SFT feasibility', () => {
  it.skip('learns the packing rule and generalises to unseen baskets', { timeout: 600000 }, () => {
    const corpus = buildWarehouseCorpus(60000)
    const t = new Trainer(corpus, CFG, 1337)
    const cfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }

    const before = evalBaskets(t, heldOutBaskets()).acc
    const STEPS = 2500
    for (let i = 0; i < STEPS; i++) t.stepBatch(cfg, DEFAULT_FEATURE_FLAGS)
    const held = evalBaskets(t, heldOutBaskets())
    const train = evalBaskets(t, trainBaskets())

    // eslint-disable-next-line no-console
    console.log(`[warehouse] params=${t.model.params.reduce((n, p) => n + p.size, 0)} vocab=${t.cfg.vocabSize} ` +
      `steps=${STEPS} | held-out ${before}%→${held.acc}% (train ${train.acc}%) | avg extra tiles held=${held.avgExtra.toFixed(2)} train=${train.avgExtra.toFixed(2)}`)

    expect(held.acc).toBeGreaterThan(70) // generalises to baskets it never trained on → learned the RULE
  })
})
