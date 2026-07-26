// The warehouse-agent capstone task. A tiny char model learns to be a tool-using
// packing agent: given a basket (a multiset of 1-3 SKUs), emit the sequence of tool
// calls to fetch and pack each item correctly. The SFT expert lists items in the SAME
// (sorted) order as the prompt, so the plan is a straight copy the tiny model can learn —
// a reordered "optimal tour" makes it drop/conflate items; efficiency is left to RL.
//
// The teaching point is that packing is a RELATIONAL decision — it depends on what
// ELSE is in the basket, not on an item alone — which is the honest reason to reach
// for a transformer (it has to attend across the whole order):
//   • a FRAGILE item needs `pad` iff a HEAVY item is also in the basket
//   • a CHEMICAL item goes in box 2 iff a FOOD item is also in the basket
//   • otherwise: no pad, box 1
// Each SKU (A-F) carries ONE hidden attribute the model never sees as a token — it
// must infer "fragile/heavy/food/chemical" purely from the packing decisions in its
// training traces (which later lets us show the learned SKU embeddings cluster by
// attribute: it discovered concepts nobody labelled).
//
// Pure module (no engine import) — the single source of truth for the training
// corpus AND the runtime verifier, mirroring src/data/tasks.ts and harnessTasks.ts.
// Deterministic (fixed-seed mulberry32) so a given split/corpus is reproducible.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Attr = 'fragile' | 'heavy' | 'food' | 'chemical'
export type Basket = string[] // 1-3 SKU letters (repeats allowed), kept sorted for the prompt

export const SKUS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

// The HIDDEN attribute table — never emitted as a token; the model infers it.
export const ATTR: Record<string, Attr> = {
  A: 'fragile',
  B: 'fragile',
  C: 'heavy',
  D: 'food',
  E: 'chemical',
  F: 'chemical',
}

// Grid layout (6×6, [col,row]): fixed pick site per SKU + one pack station. Only used
// for the visit-order tour (efficiency) and the page's animation; not for correctness.
export type Cell = [number, number]
export const SITE: Record<string, Cell> = {
  A: [0, 0], B: [5, 0], C: [0, 2], D: [5, 2], E: [0, 4], F: [5, 4],
}
export const PACK: Cell = [2, 5]
export const GRID = 6

const manhattan = (a: Cell, b: Cell): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])

// ---- the packing rules (relational — depend on the whole basket) ------------

/** Which attributes are present anywhere in the basket. */
export function presentAttrs(basket: Basket): Set<Attr> {
  const s = new Set<Attr>()
  for (const x of basket) s.add(ATTR[x])
  return s
}
/** Fragile items pad ONLY if something heavy shares the basket. */
export function padFor(sku: string, basket: Basket): boolean {
  return ATTR[sku] === 'fragile' && presentAttrs(basket).has('heavy')
}
/** Chemical items go in box 2 ONLY if food shares the basket, else box 1. */
export function boxFor(sku: string, basket: Basket): 1 | 2 {
  return ATTR[sku] === 'chemical' && presentAttrs(basket).has('food') ? 2 : 1
}

// ---- the expert planner (SFT teacher: always correct, greedy-short tour) -----

/** The order the SFT expert fetches items in: the SIMPLE prompt (sorted) order. This is a
 *  straight copy of the basket, which the tiny model learns reliably (unlike a reordered
 *  tour, which makes it drop/hallucinate items). It's a valid but usually SUB-OPTIMAL tour,
 *  so it deliberately leaves routing efficiency for the RL phase to discover — the model is
 *  free to emit items in any order (correctness is order-independent), and RL rewards the
 *  shorter tours. */
export function expertOrder(basket: Basket): string[] {
  return [...basket].sort()
}

/** Total tiles travelled for a given item order: pack → each new site in turn → pack.
 *  Consecutive picks at the same site cost nothing extra. */
export function tourTiles(items: string[]): number {
  let tiles = 0
  let cur: Cell = PACK
  for (const x of items) {
    const site = SITE[x]
    if (site[0] !== cur[0] || site[1] !== cur[1]) { tiles += manhattan(cur, site); cur = site }
  }
  return tiles + manhattan(cur, PACK)
}

/** Shortest possible tour for a basket (brute force over the ≤3 distinct sites). */
export function optimalTiles(basket: Basket): number {
  const distinct = [...new Set(basket)]
  const perms = permutations(distinct)
  let best = Infinity
  for (const p of perms) best = Math.min(best, tourTiles(p))
  return best === Infinity ? 0 : best
}
function permutations(a: string[]): string[][] {
  if (a.length <= 1) return [a]
  const out: string[][] = []
  for (let i = 0; i < a.length; i++) {
    const rest = [...a.slice(0, i), ...a.slice(i + 1)]
    for (const p of permutations(rest)) out.push([a[i], ...p])
  }
  return out
}

/** One packing action per item, e.g. "get A pad pack1". */
export function planActions(basket: Basket): string[] {
  return expertOrder(basket).map(
    (x) => `get ${x}${padFor(x, basket) ? ' pad' : ''} pack${boxFor(x, basket)}`,
  )
}

const sortedBasket = (basket: Basket): Basket => [...basket].sort()

/** The prompt stem the model conditions on: "order: A C F => ". */
export const warePrompt = (basket: Basket): string => `order: ${sortedBasket(basket).join(' ')} => `

/** A full training line: prompt + correct plan + done. */
export const wareLine = (basket: Basket): string =>
  `${warePrompt(basket)}${planActions(basket).join(' ')} done`

// ---- basket space + a rule-covering held-out split --------------------------

/** All multisets of size 1-3 over the 6 SKUs (6 + 21 + 56 = 83 baskets). More baskets =
 *  more data to disambiguate same-attribute SKUs (A/B both fragile), which the model needs
 *  to copy them faithfully rather than conflate them. */
export function allBaskets(): Basket[] {
  const out: Basket[] = []
  const combos = (size: number, start: number, acc: string[]) => {
    if (acc.length === size) { out.push([...acc]); return }
    for (let i = start; i < SKUS.length; i++) combos(size, i, [...acc, SKUS[i]])
  }
  for (let size = 1; size <= 3; size++) combos(size, 0, [])
  return out
}

const isPadTrigger = (b: Basket): boolean => presentAttrs(b).has('fragile') && presentAttrs(b).has('heavy')
const isBox2Trigger = (b: Basket): boolean => presentAttrs(b).has('chemical') && presentAttrs(b).has('food')

const SPLIT_SEED = 20250724
const HOLD_FRACTION = 0.25

/** Deterministic held-out / train split, GUARANTEED to leave at least two of each
 *  relational-trigger basket (fragile+heavy, chemical+food) in BOTH sides — so the
 *  held-out set genuinely tests the RULE on baskets never trained on. */
function split(): { train: Basket[]; held: Basket[] } {
  const all = allBaskets()
  const rnd = mulberry32(SPLIT_SEED)
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  const nHold = Math.floor(all.length * HOLD_FRACTION)
  const held = all.slice(0, nHold)
  const train = all.slice(nHold)

  // Guarantee each side keeps ≥2 pad-triggers and ≥2 box2-triggers by swapping if needed.
  const ensure = (pred: (b: Basket) => boolean) => {
    const need = 2
    const heldHits = () => held.filter(pred).length
    const trainHits = () => train.filter(pred).length
    // pull triggers into held from train
    while (heldHits() < need) {
      const ti = train.findIndex(pred)
      const hi = held.findIndex((b) => !pred(b))
      if (ti < 0 || hi < 0) break
      ;[held[hi], train[ti]] = [train[ti], held[hi]]
    }
    // keep enough triggers in train too
    while (trainHits() < need) {
      const hi = held.findIndex(pred)
      const ti = train.findIndex((b) => !pred(b))
      if (hi < 0 || ti < 0) break
      ;[train[ti], held[hi]] = [held[hi], train[ti]]
    }
  }
  ensure(isPadTrigger)
  ensure(isBox2Trigger)
  return { train, held }
}

export const trainBaskets = (): Basket[] => split().train
export const heldOutBaskets = (): Basket[] => split().held

/** A warehouse corpus (~targetChars) built only from the training baskets. */
export function buildWarehouseCorpus(targetChars = 60000): string {
  const rnd = mulberry32(SPLIT_SEED ^ 0x1234)
  const train = trainBaskets()
  const lines: string[] = []
  let chars = 0
  while (chars < targetChars) {
    const l = wareLine(train[Math.floor(rnd() * train.length)])
    lines.push(l)
    chars += l.length + 1
  }
  return lines.join('\n') + '\n'
}

// ---- verifier (RL reward + eval) --------------------------------------------

export interface PackAction { sku: string; pad: boolean; box: 1 | 2 }

/** Parse a basket out of a "order: A C F => ..." prompt (sorted letters). */
export function parseBasket(prompt: string): Basket {
  const m = prompt.match(/order:\s*([A-F](?:\s+[A-F])*)/)
  if (!m) return []
  return m[1].trim().split(/\s+/).sort()
}

/** Parse a plan (the generated continuation) into structured actions, or null if malformed.
 *  Expected shape: `get <SKU> [pad] pack<1|2>` repeated, terminated by `done`. */
export function parsePlan(completion: string): PackAction[] | null {
  const toks = completion.trim().split(/\s+/)
  const actions: PackAction[] = []
  let i = 0
  while (i < toks.length) {
    if (toks[i] === 'done') return actions
    if (toks[i] !== 'get') return null
    const sku = toks[i + 1]
    if (!sku || !SKUS.includes(sku as (typeof SKUS)[number])) return null
    let j = i + 2
    let pad = false
    if (toks[j] === 'pad') { pad = true; j++ }
    const pk = toks[j]
    if (pk !== 'pack1' && pk !== 'pack2') return null
    actions.push({ sku, pad, box: pk === 'pack1' ? 1 : 2 })
    i = j + 1
  }
  return null // never saw `done`
}

/** Verifiable reward: 1 iff the plan fetches exactly the basket AND every pad/box
 *  decision matches the relational rules AND it terminates with `done`, else 0. */
export function warehouseReward(prompt: string, completion: string): number {
  const basket = parseBasket(prompt)
  if (basket.length === 0) return 0
  const plan = parsePlan(completion)
  if (!plan) return 0
  // fetched multiset must equal the basket
  const got = plan.map((p) => p.sku).sort().join('')
  if (got !== basket.join('')) return 0
  // every packing decision must be rule-correct
  for (const p of plan) {
    if (p.pad !== padFor(p.sku, basket)) return 0
    if (p.box !== boxFor(p.sku, basket)) return 0
  }
  return 1
}

/** Extra tiles travelled vs the optimal tour for a correct plan (efficiency metric;
 *  0 = optimal). Returns null if the plan is incorrect. */
export function extraTiles(prompt: string, completion: string): number | null {
  if (warehouseReward(prompt, completion) !== 1) return null
  const basket = parseBasket(prompt)
  const items = parsePlan(completion)!.map((p) => p.sku)
  return tourTiles(items) - optimalTiles(basket)
}
