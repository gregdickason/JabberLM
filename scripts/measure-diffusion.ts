// What a DECODING PARADIGM costs and buys, measured on the one task this site can hold both
// paradigms on. Two models, same architecture (48/3/3/192, ctx 48), same task, same held-out
// lists, same step budget — differing only in the objective they were trained with:
//
//   public/sort-model.json           next-token prediction, causal, left to right
//   public/diffusion-sort-model.json masked denoising, bidirectional, iterative unmasking
//
// For the diffusion model we sweep the ROUNDS dial, because that is the thing autoregression
// does not have. At one round every answer position is decided in the same pass, so nothing
// conditions on anything else; at one round per character the passes are sequential again and
// the saving is gone. The curve between those is the trade.
//
// Three numbers per setting, and the third is the one that teaches:
//   accuracy        exact match against the sorted answer, on lists never trained on
//   forwards        sequential passes per answer (autoregression needs one per character)
//   non-permutation how often the answer is not a rearrangement of the input — the signature
//                   of positions being chosen independently
//
// Properties of the SHIPPED WEIGHTS, so re-run after any retrain:
//   node node_modules/vitest/node_modules/vite-node/vite-node.mjs scripts/measure-diffusion.ts
import { readFileSync, existsSync } from 'node:fs'
import { deserialize, type SavedModel } from '../src/engine/persist'
import { diffusionGenerate, generate } from '../src/engine/generate'
import { RNG } from '../src/engine/random'
import { ANSWER_LEN, MASK_CHAR, sortDiffusionPrompt, sortHeldOut, type SortVec } from '../src/data/tasks'
import { sortAccuracy } from '../src/interp/ablation'
import { DEFAULT_FEATURE_FLAGS } from '../src/engine/config'

const ROUNDS = [1, 2, 3, 5]
const held: SortVec[] = sortHeldOut()
const want = (v: SortVec) => [...v].sort((a, b) => a - b).join(' ')
/** Is the answer a rearrangement of the question? Sorting cannot change the multiset. */
const isPermutation = (v: SortVec, out: string) =>
  out.split(' ').filter((s) => s !== '').sort().join(' ') === [...v].map(String).sort().join(' ')

const load = (f: string) => deserialize(JSON.parse(readFileSync(f, 'utf8')) as SavedModel)
const pct = (n: number) => `${((100 * n) / held.length).toFixed(1)}%`

console.log(`\nheld-out: ${held.length} three-number lists, none of them trained on\n`)

// ---- the autoregressive baseline -------------------------------------------
if (existsSync('public/sort-model.json')) {
  const t = load('public/sort-model.json')
  const greedy = { temperature: 0, topK: null, topP: null, maxNewTokens: ANSWER_LEN }
  let ok = 0
  let perm = 0
  for (const v of held) {
    const out = generate(t.model, DEFAULT_FEATURE_FLAGS, t.tok, sortDiffusionPrompt(v), greedy, new RNG(1))
    if (out === want(v)) ok++
    if (isPermutation(v, out)) perm++
  }
  console.log('next-token prediction (causal, left to right)')
  console.log(
    `  accuracy ${pct(ok).padStart(6)} · forwards ${ANSWER_LEN} per answer · ` +
      `non-permutation ${pct(held.length - perm)}`,
  )
  // Also report the site's OWN helper, the one MEASURED.sortOnly was taken with (8 new tokens
  // and a regex, rather than exactly ANSWER_LEN characters). If the two disagree, the gap is a
  // decoding convention and not a difference in the model — better on screen than buried.
  console.log(`  the site's sortAccuracy() on the same 145: ${sortAccuracy(t.model, t.tok, held)}%\n`)
}

// ---- masked diffusion, swept over the rounds dial --------------------------
for (const file of ['public/diffusion-sort-model.json', 'public/diffusion-sort-seed2024.json']) {
  if (!existsSync(file)) continue
  const t = load(file)
  const flags = { ...DEFAULT_FEATURE_FLAGS, causalMask: false }
  const maskId = t.tok.encode(MASK_CHAR)[0]
  console.log(`masked diffusion (bidirectional, iterative unmasking) — ${file}`)
  for (const R of ROUNDS) {
    let ok = 0
    let perm = 0
    let forwards = 0
    const conf: number[] = []
    let minConf = 1
    const firstPos = new Map<number, number>() // which answer offset gets committed first
    for (const v of held) {
      const r = diffusionGenerate(t.model, flags, t.tok, sortDiffusionPrompt(v), ANSWER_LEN, maskId, R)
      forwards += r.forwards
      if (r.text === want(v)) ok++
      if (isPermutation(v, r.text)) perm++
      const f = r.rounds[0]?.unmasked[0]
      if (f) {
        const off = f.pos - sortDiffusionPrompt(v).length
        firstPos.set(off, (firstPos.get(off) ?? 0) + 1)
      }
      // How sure is it, at the moment it commits? If the answer's positions are each a simple
      // function of the PROMPT, a single pass should already be near-certain about all of them —
      // which would explain a rounds dial that changes nothing.
      for (const u of r.rounds.flatMap((x) => x.unmasked)) {
        conf.push(u.p)
        if (u.p < minConf) minConf = u.p
      }
    }
    const order = [...firstPos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([off, n]) => `${off}:${((100 * n) / held.length).toFixed(0)}%`)
      .join(' ')
    console.log(
      `  rounds ${String(R).padStart(2)} · accuracy ${pct(ok).padStart(6)} · ` +
        `forwards ${(forwards / held.length).toFixed(1)} per answer · ` +
        `non-permutation ${pct(held.length - perm).padStart(6)} · ` +
        `confidence mean ${(conf.reduce((a, b) => a + b, 0) / conf.length).toFixed(3)} ` +
        `min ${minConf.toFixed(3)} · committed first ${order}`,
    )
  }
  console.log()
}
