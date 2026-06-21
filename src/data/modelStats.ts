// Facts about the bundled pre-trained model (public/jabber-model.json), surfaced
// in the UI and the Explain page. Single source of truth — update here (and the
// number in GUIDE.md / README.md) whenever the model is regenerated.
//
// The model was trained offline by `npm run gen:jabber` on the "Jabber Poems" set
// (Jabberwocky + ~100 more original poems in the same invented style). Training
// ran in plain single-threaded JavaScript — the same engine that runs in the
// browser, no GPU — so the wall-clock figure is a fair "tiny model on a laptop"
// number. Memory was never the constraint (the model is ~3.5 MB); the limit is
// one CPU core's compute.

export const MODEL_STATS = {
  params: 464_448,
  paramsLabel: '~0.46M',
  steps: 2_400,
  loss: 1.31,
  minutes: 87,
  chars: 90_563,
  vocab: 64,
  poemsLabel: 'Jabberwocky + ~100 more poems',
  machine: 'MacBook Air (M4, 10-core CPU, 16 GB)',
  runtime: 'single-threaded JavaScript (no GPU)',
} as const

// One-line summary for banners/captions.
export const MODEL_STATS_LINE =
  `${MODEL_STATS.paramsLabel} params · trained on ${MODEL_STATS.poemsLabel} ` +
  `(~${Math.round(MODEL_STATS.chars / 1000)}K chars) · ${MODEL_STATS.steps.toLocaleString()} steps · ` +
  `~${MODEL_STATS.minutes} min of ${MODEL_STATS.runtime} on a ${MODEL_STATS.machine} · loss ${MODEL_STATS.loss}`
