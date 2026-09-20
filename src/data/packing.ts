/**
 * A grocery-order message classifier — the task behind the capstone's "embedded intelligence"
 * section.
 *
 * A packing operation receives a stream of short customer messages. Each has to be routed: to the
 * picking team, to refunds, to the delivery desk, or to a person. That is exactly the shape of
 * decision a typed-decision model is sold for — a fixed set of answers, a probability on each, one
 * forward pass, and no prose for anybody to read.
 *
 * ── Why the corpus is generated rather than hand-written ─────────────────────────────────────
 * The first attempt hand-wrote 64 messages, eight per category. The model reached 100% on them
 * and 12-25% on held-out messages, while reporting 98-100% confidence on answers that were wrong.
 * It had memorised the strings; there was not enough variety for a character model to find the
 * words that actually carry the category.
 *
 * So messages are composed from per-category TEMPLATES and a shared ITEMS list. That produces
 * hundreds of distinct messages per route and forces the model onto the signal that generalises.
 *
 * There are TWO held-out splits, and keeping them apart is the whole result. `heldOutMessages`
 * varies the NOUN (trained phrasings, never-seen products) and the model scores 97.9%.
 * `unseenPhrasingMessages` varies the WORDING (trained products, never-seen phrasings) and it
 * scores 39.6%. The first version conflated them and hid a near-perfect result behind a
 * near-useless one.
 *
 * ── What it is built to demonstrate ──────────────────────────────────────────────────────────
 *  1. Routing most messages correctly, so the economics are plausible rather than hypothetical.
 *  2. A handful of messages are **genuinely ambiguous** — they belong to two categories and a
 *     person could argue either. The design intent was that the model would split its belief and
 *     the threshold would escalate them.
 *
 *     MEASURED, AND IT LARGELY DOES NOT. Three of the five come back at 77% or more on one of the
 *     two readings and are routed automatically. The confidence reports how familiar the WORDING
 *     is, not how ambiguous the meaning is — "the milk was warm when it arrived" carries
 *     "arrived", which saturates the delivery templates, so it answers delivery at 98%. That is
 *     now what the demo and the capstone copy say, because it is what the weights do, and it is a
 *     sharper lesson than the one originally planned. Asserted in `classifier-model.test.ts`.
 *
 * The high-stakes route is included on purpose: ALLERGY. Getting that wrong is not a refund, it
 * is a safety incident, which is the argument for a per-category threshold rather than one number.
 *
 * Pure — no React, no Tensor — so the corpus and the splits are unit-testable.
 */

import { RNG } from '../engine/random'

/** The eight routes, in a fixed order. The single-character code is what the model emits. */
export const CATEGORIES = [
  { code: '0', key: 'missing', label: 'item missing', desk: 'picking' },
  { code: '1', key: 'damaged', label: 'arrived damaged', desk: 'refunds' },
  { code: '2', key: 'wrong', label: 'wrong item sent', desk: 'picking' },
  { code: '3', key: 'expired', label: 'past its date', desk: 'quality' },
  { code: '4', key: 'delivery', label: 'delivery time', desk: 'transport' },
  { code: '5', key: 'payment', label: 'payment or refund', desk: 'finance' },
  { code: '6', key: 'allergy', label: 'allergy or dietary', desk: 'safety' },
  { code: '7', key: 'amend', label: 'change or cancel', desk: 'orders' },
] as const

export type CategoryKey = (typeof CATEGORIES)[number]['key']
export const catIndex = (k: CategoryKey) => CATEGORIES.findIndex((c) => c.key === k)

export interface Message {
  text: string
  label: CategoryKey
  /** True when a person could reasonably file this under `also` instead. */
  ambiguous?: boolean
  also?: CategoryKey
  /** True when the phrasing itself was held out — the case the model cannot do. */
  novelPhrasing?: boolean
}

/** Items that appear in training messages. */
const ITEMS_TRAIN = [
  'bread', 'milk', 'eggs', 'cheese', 'rice', 'apples', 'coffee', 'butter',
  'pasta', 'yoghurt', 'chicken', 'bananas', 'juice', 'cereal', 'soup', 'ham',
]
/** Items held back entirely, so a held-out message names something never seen in training. */
const ITEMS_HELD = ['melon', 'crackers', 'salmon', 'lentils']

/**
 * A second slot, for the routes that are not about an item at all. Every template must carry one
 * slot or the other — a template with no slot expands to a single string, which is how the first
 * version ended up with eight delivery examples and a model that memorised them.
 */
const DAYS_TRAIN = ['monday', 'tuesday', 'wednesday', 'friday', 'saturday', 'today', 'this morning', 'last night']
const DAYS_HELD = ['thursday', 'sunday']

/**
 * Per-category templates. `{item}` is the slot. The last two of each list are held back, so a
 * held-out message uses a phrasing the model never trained on.
 *
 * Each category has a lexical signature that survives the slot — "missing", "cracked", "instead
 * of", "out of date", "driver", "charged", "allergic", "cancel" — which is the thing a character
 * model can actually learn.
 */
const TEMPLATES: Record<CategoryKey, string[]> = {
  missing: [
    'the {item} never turned up',
    'my {item} is not in the bag',
    'there is no {item} in my order',
    'i paid for {item} but did not get any',
    'no sign of the {item} anywhere',
    'the {item} was left out of the delivery',
    'you forgot to send my {item}',
    'the {item} is missing from the box',
    // held out
    'i cannot find the {item} at all',
    'my {item} simply is not here',
  ],
  damaged: [
    'the {item} arrived crushed',
    'my {item} is completely squashed',
    'the {item} was broken in the bag',
    'the packet of {item} is split open',
    'my {item} came dented and leaking',
    'the {item} container is cracked',
    'the {item} was smashed in transit',
    'everything with the {item} is crushed',
    // held out
    'the {item} turned up in pieces',
    'my {item} has been badly damaged',
  ],
  wrong: [
    'you sent the wrong {item}',
    'this is not the {item} i ordered',
    'i got the wrong brand of {item}',
    'you substituted my {item} without asking',
    'i asked for large {item} and got small',
    'the {item} you sent is not what i chose',
    'someone else {item} is in my bag',
    'you swapped my {item} for another one',
    // held out
    'the {item} is not the one on my list',
    'i ordered different {item} to this',
  ],
  expired: [
    'the {item} is two days out of date',
    'this {item} expires today',
    'the {item} is past its use by',
    'my {item} has gone mouldy already',
    'the date on the {item} has passed',
    'the {item} smells sour and off',
    'short dated {item} again',
    'the {item} had already gone bad',
    // held out
    'the {item} is well past its date',
    'this {item} went off before i opened it',
  ],
  delivery: [
    'the driver never arrived on {day}',
    'my delivery on {day} was three hours late',
    'nobody came with my order on {day}',
    'can i move my delivery to {day}',
    'the van turned up far too early on {day}',
    'still waiting since {day} and no driver',
    'what time is the driver coming on {day}',
    'my slot was {day} but nothing arrived',
    // held out
    'the driver has not shown up since {day}',
    'my delivery window on {day} came and went',
  ],
  payment: [
    'i have been charged twice for the {item}',
    'where is my refund for the {item}',
    'the total for my {item} is wrong',
    'you took the money for {item} but cancelled it',
    'my voucher was not applied to the {item}',
    'i was billed for {item} i never got',
    'the {item} receipt does not match my bank',
    'please refund me for the {item}',
    // held out
    'my card was charged the wrong amount for {item}',
    'i am still owed money for the {item}',
  ],
  allergy: [
    'this {item} contains nuts and i am allergic',
    'you sent gluten {item} when i asked for free from',
    'my child is allergic to the dairy in this {item}',
    'the {item} label does not list allergens',
    'i cannot eat {item} with sesame in it',
    'this is not the dairy free {item}',
    'severe peanut allergy so no {item} with nuts',
    'never substitute my gluten free {item}',
    // held out
    'i am allergic to what is in this {item}',
    'this {item} is unsafe for my allergy',
  ],
  amend: [
    'please cancel my whole {item} order',
    'can i add {item} to this order',
    'i want to remove the {item}',
    'change my address before the {item} ships',
    'stop the {item} order i made this morning',
    'can i still edit the {item} i bought',
    'take the {item} off my basket',
    'i need to change my {item} order please',
    // held out
    'cancel the {item} order i placed today',
    'can i swap the {item} before it goes',
  ],
}

const HELD_TEMPLATES = 2

function expand(templates: string[], items: string[], days: string[]): string[] {
  const out: string[] = []
  for (const tpl of templates) {
    if (tpl.includes('{item}')) for (const v of items) out.push(tpl.replace('{item}', v))
    else if (tpl.includes('{day}')) for (const v of days) out.push(tpl.replace('{day}', v))
    else out.push(tpl) // a template with no slot yields one message; the tests forbid it
  }
  return out
}

/** Every training message: seen templates crossed with seen items. */
export function trainMessages(): Message[] {
  const out: Message[] = []
  for (const c of CATEGORIES) {
    const tpls = TEMPLATES[c.key].slice(0, -HELD_TEMPLATES)
    for (const text of expand(tpls, ITEMS_TRAIN, DAYS_TRAIN)) out.push({ text, label: c.key })
  }
  return out
}

/**
 * Held out on the PRODUCT: phrasings the model trained on, naming items it has never seen.
 * This is the realistic production case — the wording of complaints is stable, the catalogue
 * is not — and the shipped model gets 97.9% of these right.
 */
export function heldOutMessages(): Message[] {
  const out: Message[] = []
  for (const c of CATEGORIES) {
    const tpls = TEMPLATES[c.key].slice(0, -HELD_TEMPLATES)
    for (const text of expand(tpls, ITEMS_HELD, DAYS_HELD)) out.push({ text, label: c.key })
  }
  return out
}

/**
 * Held out on the PHRASING: ways of saying it the model has never seen, about items it has.
 * This is the harder case and the shipped model manages 39.6% — well above the 12.5% it would
 * get by guessing, and nowhere near usable.
 *
 * The reason is worth stating plainly: "i cannot find the bread at all" shares no words with any
 * training phrasing for a missing item. Recognising it as the same complaint is paraphrase, and
 * at this size the model is matching wording rather than meaning. A section arguing that typed
 * decisions are commercially useful has to carry that limit honestly, so the demo shows it.
 */
export function unseenPhrasingMessages(): Message[] {
  const out: Message[] = []
  for (const c of CATEGORIES) {
    const tpls = TEMPLATES[c.key].slice(-HELD_TEMPLATES)
    for (const text of expand(tpls, ITEMS_TRAIN, DAYS_TRAIN)) out.push({ text, label: c.key })
  }
  return out
}

/**
 * Written by hand to sit across two categories. These are the point of the demo: the model should
 * be unsure, and a confidence threshold should route them to a person.
 */
export const AMBIGUOUS: Message[] = [
  { text: 'the milk was warm when it arrived', label: 'expired', ambiguous: true, also: 'delivery' },
  { text: 'i did not get the item i paid for', label: 'missing', ambiguous: true, also: 'payment' },
  { text: 'you swapped my bread for one with nuts', label: 'allergy', ambiguous: true, also: 'wrong' },
  { text: 'the broken jar was out of date too', label: 'damaged', ambiguous: true, also: 'expired' },
  { text: 'cancel it the driver is already late', label: 'amend', ambiguous: true, also: 'delivery' },
]

/**
 * The rows the demo shows: one unseen-product message per route (which the model handles), the
 * ambiguous ones (where it is mostly NOT unsure, which is the demo's sharpest moment), and two
 * unseen-phrasing ones (where it is unsure, correctly).
 */
export function demoMessages(): Message[] {
  const held = heldOutMessages()
  const one = CATEGORIES.map((c) => held.find((m) => m.label === c.key)!).filter(Boolean)
  const novel = unseenPhrasingMessages()
  const hard = [
    novel.find((m) => m.label === 'missing' && m.text.includes('cannot find'))!,
    novel.find((m) => m.label === 'damaged' && m.text.includes('in pieces'))!,
  ].filter(Boolean)
  return [...one, ...AMBIGUOUS, ...hard.map((m) => ({ ...m, novelPhrasing: true }))]
}

/** The prompt the model conditions on. The answer is a single category character. */
export const askPrompt = (text: string): string => `note ${text} => `

/** One training line: the message, then the category code. */
export const askLine = (m: Message): string =>
  `${askPrompt(m.text)}${CATEGORIES[catIndex(m.label)].code}`

/** The corpus: every training message, shuffled so batches mix categories. */
export function buildPackingCorpus(repeats = 4, seed = 1337): string {
  const rng = new RNG(seed)
  const msgs = trainMessages()
  const lines: string[] = []
  for (let r = 0; r < repeats; r++) for (const m of msgs) lines.push(askLine(m))
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[lines[i], lines[j]] = [lines[j], lines[i]]
  }
  return lines.join('\n') + '\n'
}
