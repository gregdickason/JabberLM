// "Looks right, is wrong": over every equation the three-skill model was taught the FORM of
// (a in 2..9, x in 0..9, b in 0..9 -> 800 lines `ax + b = c => ax = c-b => x = x`), count how
// many greedy answers LOOK like valid working vs how many are actually right.
// Run: node node_modules/vitest/node_modules/vite-node/vite-node.mjs scripts/measure-confidently-wrong.ts
import { readFileSync } from 'node:fs'
import { deserialize, type SavedModel } from '../src/engine/persist'
import { DEFAULT_FEATURE_FLAGS } from '../src/engine/config'
import { generate } from '../src/engine/generate'
import { RNG } from '../src/engine/random'
import { buildEquationCorpus } from '../src/data/tasks'

const { model, tok } = deserialize(JSON.parse(readFileSync('public/multitask-model.json', 'utf8')) as SavedModel)
const corpus = new Set(buildEquationCorpus().split('\n'))
const SHAPE = /^(\d)x = (\d+) => x = (\d+)$/ // what a reader's eye (or a format check) accepts
let n = 0, looksRight = 0, sameCoef = 0, finalRight = 0, fullyRight = 0, inTraining = 0, inTrainingRight = 0
for (let a = 2; a <= 9; a++)
  for (let x = 0; x <= 9; x++)
    for (let b = 0; b <= 9; b++) {
      const c = a * x + b
      const prompt = `${a}x + ${b} = ${c} => `
      const truth = `${a}x = ${c - b} => x = ${x}`
      const out = generate(model, DEFAULT_FEATURE_FLAGS, tok, prompt, { temperature: 0, topK: null, topP: null, maxNewTokens: 20 }, new RNG(1)).split('\n')[0]
      n++
      const seen = corpus.has(prompt + truth)
      if (seen) inTraining++
      const m = out.match(SHAPE)
      if (m) looksRight++
      if (m && Number(m[1]) === a) sameCoef++
      if (m && Number(m[3]) === x) finalRight++
      if (out === truth) { fullyRight++; if (seen) inTrainingRight++ }
    }
const pct = (k: number, d = n) => `${k}/${d} (${((100 * k) / d).toFixed(1)}%)`
console.log({ n, looksRight: pct(looksRight), sameCoef: pct(sameCoef), finalRight: pct(finalRight), fullyRight: pct(fullyRight), inTraining: pct(inTraining), inTrainingRight: pct(inTrainingRight, inTraining) })
