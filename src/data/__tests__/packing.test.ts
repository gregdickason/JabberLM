import { describe, it, expect } from 'vitest'
import {
  AMBIGUOUS,
  CATEGORIES,
  askLine,
  askPrompt,
  buildPackingCorpus,
  catIndex,
  demoMessages,
  heldOutMessages,
  trainMessages,
  unseenPhrasingMessages,
} from '../packing'

const TRAIN = trainMessages()
const HELD_OUT = [...heldOutMessages(), ...AMBIGUOUS]

describe('the packing categories', () => {
  it('has eight routes with distinct single-character codes', () => {
    expect(CATEGORIES).toHaveLength(8)
    const codes = CATEGORIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(8)
    for (const c of codes) expect(c).toHaveLength(1)
  })

  it('indexes a key back to its position', () => {
    CATEGORIES.forEach((c, i) => expect(catIndex(c.key)).toBe(i))
  })
})

describe('the message sets', () => {
  it('covers every category in training, with enough examples to learn from', () => {
    for (const c of CATEGORIES) {
      const n = TRAIN.filter((m) => m.label === c.key).length
      expect(n, `${c.key} training examples`).toBeGreaterThanOrEqual(50)
    }
  })

  it('covers every category in the held-out set', () => {
    for (const c of CATEGORIES) {
      expect(HELD_OUT.some((m) => m.label === c.key), `${c.key} held out`).toBe(true)
    }
  })

  it('never reuses a training message as a held-out one', () => {
    const seen = new Set(TRAIN.map((m) => m.text))
    for (const m of HELD_OUT) expect(seen.has(m.text), m.text).toBe(false)
  })

  it('marks the ambiguous messages with a second plausible category', () => {
    const amb = AMBIGUOUS
    expect(amb.length).toBeGreaterThanOrEqual(4)
    for (const m of amb) {
      expect(m.also, m.text).toBeTruthy()
      expect(m.also).not.toBe(m.label)
      expect(CATEGORIES.some((c) => c.key === m.also)).toBe(true)
    }
  })

  it('keeps messages inside the model context window', () => {
    // The generator trains with contextLen 64; a prompt longer than that would be truncated
    // from the left, silently removing the beginning of the message.
    for (const m of [...TRAIN, ...HELD_OUT]) {
      expect(askLine(m).length, m.text).toBeLessThanOrEqual(64)
    }
  })

  it('separates the two kinds of generalisation, because the model does very differently on them', () => {
    // Measured on the shipped weights: 97.9% on an unseen PRODUCT, 39.6% on an unseen PHRASING.
    // Conflating them (the first version held out both at once) hid a near-perfect result behind
    // a near-useless one and made the demo look broken.
    const trainTexts = new Set(TRAIN.map((m) => m.text))
    for (const m of [...heldOutMessages(), ...unseenPhrasingMessages()]) {
      expect(trainTexts.has(m.text), m.text).toBe(false)
    }
    const trainWords = new Set(TRAIN.flatMap((m) => m.text.split(' ')))
    // held-out PRODUCT messages name a noun never seen in training
    for (const item of ['melon', 'crackers', 'salmon', 'lentils']) {
      expect(trainWords.has(item), item).toBe(false)
    }
    // Held-out PHRASING messages name only items that WERE seen, so the noun is held constant and
    // the wording is the variable. They do contain unseen WORDS — "i cannot find the bread at all"
    // introduces "find", "at", "all" — and that is the whole difficulty: recognising a complaint
    // with no lexical overlap with anything trained on is paraphrase, which this model cannot do.
    for (const m of unseenPhrasingMessages()) {
      for (const held of ['melon', 'crackers', 'salmon', 'lentils']) {
        expect(m.text.includes(held), `${m.text} should not name a held-out item`).toBe(false)
      }
    }
  })

  it('gives the demo one clear example per route, the ambiguous ones, and the honest failures', () => {
    const d = demoMessages()
    expect(d).toHaveLength(CATEGORIES.length + AMBIGUOUS.length + 2)
    for (const c of CATEGORIES) {
      expect(d.some((m) => m.label === c.key && !m.ambiguous && !m.novelPhrasing)).toBe(true)
    }
    // the two rows the model gets wrong are shown rather than hidden
    expect(d.filter((m) => m.novelPhrasing)).toHaveLength(2)
  })

  it('uses a narrow alphabet, so a character model has a fair chance', () => {
    const alphabet = new Set([...TRAIN, ...HELD_OUT].flatMap((m) => [...m.text]))
    for (const ch of alphabet) expect(ch, `unexpected character ${JSON.stringify(ch)}`).toMatch(/[a-z ]/)
  })
})

describe('the corpus', () => {
  it('is deterministic for a seed and shuffled between them', () => {
    expect(buildPackingCorpus(3, 7)).toBe(buildPackingCorpus(3, 7))
    expect(buildPackingCorpus(3, 7)).not.toBe(buildPackingCorpus(3, 8))
  })

  it('contains every training message the expected number of times', () => {
    const corpus = buildPackingCorpus(3)
    for (const m of TRAIN.slice(0, 40)) {
      const n = corpus.split(askLine(m) + '\n').length - 1
      expect(n, m.text).toBe(3)
    }
  })

  it('ends each line with the category code the message is labelled with', () => {
    for (const m of TRAIN) {
      expect(askLine(m)).toBe(askPrompt(m.text) + CATEGORIES[catIndex(m.label)].code)
    }
  })
})

describe('every template expands', () => {
  it('leaves no template without a slot', () => {
    // A slotless template yields exactly one message, which is how the first corpus ended up with
    // eight delivery examples and a model that memorised them at 98% confidence.
    const byCat = new Map<string, number>()
    for (const m of trainMessages()) byCat.set(m.label, (byCat.get(m.label) ?? 0) + 1)
    for (const c of CATEGORIES) {
      // 8 training templates × at least 8 slot values
      expect(byCat.get(c.key) ?? 0, `${c.key}`).toBeGreaterThanOrEqual(60)
    }
  })
})
