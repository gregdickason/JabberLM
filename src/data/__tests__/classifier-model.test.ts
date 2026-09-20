import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { deserialize, type SavedModel } from '../../engine/persist'
import { DEFAULT_FEATURE_FLAGS } from '../../engine/config'
import {
  CATEGORIES,
  askPrompt,
  catIndex,
  demoMessages,
  heldOutMessages,
  trainMessages,
  unseenPhrasingMessages,
  type Message,
} from '../packing'
import { BUNDLES, MEASURED } from '../modelStats'
import type { Model } from '../../engine/model'
import type { CharTokenizer } from '../../engine/tokenizer'

// The classifier SHIPS TRAINED — the demo fetches public/classifier-model.json and never trains.
// Every number the capstone quotes is therefore a property of that file, not of the recipe, so
// this recomputes them from the shipped weights. It is also the guard on the two things that
// shrank the file from 1.99MB to 0.66MB: weights rounded to 4dp, and the tokenizer rebuilt from
// the 37-character alphabet instead of the 173,440-character corpus. Either could silently
// change a prediction; neither does, and this is what proves it.

const t = deserialize(
  JSON.parse(readFileSync('public/classifier-model.json', 'utf8')) as SavedModel,
)

function classify(model: Model, tok: CharTokenizer, text: string): number[] {
  const ids = tok.encode(askPrompt(text))
  const { logits } = model.forward(
    ids.slice(Math.max(0, ids.length - model.cfg.contextLen)),
    DEFAULT_FEATURE_FLAGS,
  )
  const V = logits.cols
  const base = (logits.rows - 1) * V
  const raw = CATEGORIES.map((c) => {
    const id = tok.stoi.get(c.code)
    return id != null ? logits.data[base + id] : -Infinity
  })
  const mx = Math.max(...raw)
  const ex = raw.map((l) => (l === -Infinity ? 0 : Math.exp(l - mx)))
  const s = ex.reduce((a, b) => a + b, 0) || 1
  return ex.map((e) => e / s)
}

const top = (p: number[]) => p.reduce((a, _, i) => (p[i] > p[a] ? i : a), 0)

function score(ms: Message[]) {
  let right = 0
  let confRight = 0
  let confWrong = 0
  for (const m of ms) {
    const p = classify(t.model, t.tok, m.text)
    const i = top(p)
    if (i === catIndex(m.label)) {
      right++
      confRight += p[i]
    } else confWrong += p[i]
  }
  const wrong = ms.length - right
  return {
    acc: (100 * right) / ms.length,
    saidWhenRight: right ? (100 * confRight) / right : 0,
    saidWhenWrong: wrong ? (100 * confWrong) / wrong : 0,
  }
}

describe('the shipped classifier bundle', () => {
  const M = MEASURED.classifier

  it('is the tiny typed-decision model the copy describes', () => {
    expect(t.model.cfg.contextLen).toBe(BUNDLES.classifier.contextLen)
    // the answer tokens must all be in the vocabulary or the softmax is over nothing
    for (const c of CATEGORIES) expect(t.tok.stoi.get(c.code), c.key).not.toBeUndefined()
  })

  it('has learnt its training set', () => {
    const s = score(trainMessages())
    expect(trainMessages()).toHaveLength(M.nTrain)
    expect(s.acc).toBeGreaterThan(M.train - 2)
  })

  it('generalises over UNSEEN PRODUCTS, which is the realistic production case', () => {
    const ms = heldOutMessages()
    expect(ms).toHaveLength(M.nUnseenProduct)
    const s = score(ms)
    expect(s.acc).toBeGreaterThan(M.unseenProduct - 2)
    expect(s.acc).toBeLessThan(M.unseenProduct + 2)
  })

  it('does NOT generalise over unseen PHRASINGS, and the copy says so', () => {
    const ms = unseenPhrasingMessages()
    expect(ms).toHaveLength(M.nUnseenPhrasing)
    const s = score(ms)
    expect(s.acc).toBeGreaterThan(M.unseenPhrasing - 3)
    expect(s.acc).toBeLessThan(M.unseenPhrasing + 3)
    // still well clear of guessing — the limit is real but it is not noise
    expect(s.acc).toBeGreaterThan(2 * M.chance)
  })

  it('separates right from wrong by confidence WHERE IT IS COMPETENT, and barely where it is not', () => {
    // This is the pair the capstone copy rests on, and the second half is the uncomfortable one.
    const able = score(heldOutMessages())
    expect(able.saidWhenRight).toBeCloseTo(M.saidWhenRight, -0.5)
    expect(able.saidWhenWrong).toBeCloseTo(M.saidWhenWrong, -0.5)
    expect(able.saidWhenRight - able.saidWhenWrong).toBeGreaterThan(20)

    const unable = score(unseenPhrasingMessages())
    expect(unable.saidWhenRight).toBeCloseTo(M.saidWhenRightNovel, -0.5)
    expect(unable.saidWhenWrong).toBeCloseTo(M.saidWhenWrongNovel, -0.5)
    // no threshold separates these two, which is the point the copy makes
    expect(unable.saidWhenRight - unable.saidWhenWrong).toBeLessThan(20)
  })

  it('routes the demo rows the way the page claims', () => {
    const rows = demoMessages().map((m) => {
      const p = classify(t.model, t.tok, m.text)
      const i = top(p)
      return { m, i, conf: 100 * p[i], right: i === catIndex(m.label) }
    })
    // the eight clear ones are routed, and routed correctly
    const clear = rows.filter((r) => !r.m.ambiguous && !r.m.novelPhrasing)
    expect(clear).toHaveLength(8)
    for (const r of clear) {
      expect(r.right, `${r.m.text} -> ${CATEGORIES[r.i].label}`).toBe(true)
      expect(r.conf, r.m.text).toBeGreaterThanOrEqual(70)
    }
    // Both unseen-PHRASING rows escalate — it is unsure, and being unsure is the safe outcome.
    for (const r of rows.filter((r) => r.m.novelPhrasing)) {
      expect(r.conf, `${r.m.text} should escalate at 70%`).toBeLessThan(70)
    }
    // The ambiguous ones do NOT, and the copy says so rather than hiding it. Three of five are
    // routed automatically on one of their two readings, one of them at 98%. If a retrain ever
    // makes the model genuinely unsure here, this fails and the copy on the capstone page —
    // which names that 98% — has to be rewritten to match.
    const amb = rows.filter((r) => r.m.ambiguous)
    expect(amb).toHaveLength(5)
    expect(amb.filter((r) => r.conf >= 70)).toHaveLength(3)
    expect(Math.max(...amb.map((r) => r.conf))).toBeGreaterThan(95)
  })
})
