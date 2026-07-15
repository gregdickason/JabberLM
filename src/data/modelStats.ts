// Facts about the bundled pre-trained model (public/multitask-model.json), shown
// in the UI and the Explain page. Single source of truth — update here (and the
// numbers in GUIDE.md / README.md) whenever the model is regenerated.
//
// It's a "three-skill" model: one tiny network (the `default` preset, ~0.09M
// params) trained by `npm run gen:multitask` on Jabber poems + single-variable
// algebra + sorting. The same model shows three things:
//   - poems        -> text generation (memorisation of a style)
//   - algebra      -> fluent but WRONG working (the hallucination lesson; the model
//                     can't actually learn the arithmetic at this size)
//   - sorting      -> a genuinely-learned procedure that generalises to unseen
//                     inputs ("real" reasoning), emerging with a visible grokking jump
// Training ran in plain single-threaded JavaScript (no GPU) — the same engine that
// runs in the browser, so the wall-clock is a fair "tiny model on a laptop" number.

export const MODEL_STATS = {
  params: 90_336,
  paramsLabel: '~0.09M',
  steps: 6_000,
  sortAccuracy: 89, // % held-out sort exact-match (generalises to unseen vectors)
  sortHeldOut: 145, // # unseen 3-number lists the accuracy is measured on (20% of 729, disjoint from training)
  seed: 1337, // training seed (a single run — figures are representative, not averaged)
  model: 'multitask-model.json', // the exact bundled artifact these numbers describe
  minutes: 30, // wall-clock
  chars: 226_442,
  vocab: 77,
  machine: 'MacBook Air (M4, 10-core CPU, 16 GB)',
  runtime: 'single-threaded JavaScript (no GPU)',
} as const

// How the headline accuracy was measured — surfaced next to the number so the claim
// is reproducible rather than asserted. (Regenerate with `npm run gen:multitask`.)
export const MODEL_METHOD =
  `Measured: exact-match on ${MODEL_STATS.sortHeldOut} unseen sort lists (a deterministic held-out ` +
  `split, none seen in training), one run, seed ${MODEL_STATS.seed}, ${MODEL_STATS.model}. ` +
  `A single run — representative, not averaged.`

// Example prompts for the three skills, surfaced as one-click chips when the
// bundled model is loaded.
export const MODEL_EXAMPLES: { label: string; prompt: string; note: string }[] = [
  { label: 'Poem', prompt: "'Twas brillig, and the ", note: 'generates Jabberwocky-style verse' },
  { label: 'Sort', prompt: 'sort 6 9 2 => ', note: 'really sorts — a learned procedure' },
  { label: 'Solve', prompt: '7x + 2 = 16 => ', note: 'looks like working, but the maths is invented' },
]

// One-line summary for banners/captions.
export const MODEL_STATS_LINE =
  `${MODEL_STATS.paramsLabel} params · poems + algebra + sorting · sorts unseen inputs at ` +
  `~${MODEL_STATS.sortAccuracy}% · ~${MODEL_STATS.minutes} min of ${MODEL_STATS.runtime} on a ${MODEL_STATS.machine}`
