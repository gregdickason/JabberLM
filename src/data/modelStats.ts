// Facts about every bundled pre-trained model in `public/`, shown in the UI, the
// teaching pages and the teachers' lessons. SINGLE SOURCE OF TRUTH: quote numbers
// from here rather than typing them into copy, so a retrain can't leave a stale
// figure behind in prose. `npm run stats` re-derives the structural half (params,
// dims, vocab) straight from the JSON files and rewrites the block below.
//
// Measured figures (accuracy, %) are NOT derivable from the file — they come from
// the eval scripts named in `measuredBy` and must be updated by hand after a
// retrain. Each one says what it was measured on, so a claim is reproducible.

export type BundleId =
  | 'multitask'
  | 'multitaskDraft'
  | 'moe'
  | 'sort'
  | 'harness'
  | 'adder'
  | 'warehouse'
  | 'tictactoe'
  | 'tictactoeStrong'
  | 'classifier'

export type Bundle = {
  id: BundleId
  file: string // public/<file>
  label: string // human name used in copy
  params: number
  paramsLabel: string // rounded, for prose ("~90K")
  dModel: number
  nHeads: number
  nLayers: number
  contextLen: number
  dFF: number
  vocab: number
  nExperts?: number
  genScript: string // npm script that regenerates it
  taughtOn: string // what it was ACTUALLY trained on — say this before saying what it does
  measuredBy?: string // the script that produces the measured numbers below
}

// --- BEGIN GENERATED (npm run stats) ---
const STRUCT: Record<BundleId, Pick<Bundle, 'params' | 'dModel' | 'nHeads' | 'nLayers' | 'contextLen' | 'dFF' | 'vocab'> & { nExperts?: number }> = {
  multitask: { params: 90_336, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192, vocab: 77 },
  multitaskDraft: { params: 17_304, dModel: 24, nHeads: 2, nLayers: 2, contextLen: 48, dFF: 96, vocab: 77 },
  moe: { params: 144_576, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 96, vocab: 22, nExperts: 4 },
  sort: { params: 87_456, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192, vocab: 17 },
  harness: { params: 88_464, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192, vocab: 38 },
  adder: { params: 90_000, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 96, dFF: 192, vocab: 22 },
  warehouse: { params: 24_896, dModel: 32, nHeads: 2, nLayers: 2, contextLen: 96, dFF: 96, vocab: 24 },
  tictactoe: { params: 127_872, dModel: 64, nHeads: 4, nLayers: 3, contextLen: 32, dFF: 192, vocab: 20 },
  tictactoeStrong: { params: 127_872, dModel: 64, nHeads: 4, nLayers: 3, contextLen: 32, dFF: 192, vocab: 20 },
  classifier: { params: 89_184, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 64, dFF: 192, vocab: 37 },
}
// --- END GENERATED ---

const round = (n: number) => (n >= 1000 ? `~${Math.round(n / 1000)}K` : `~${n}`)

const META: Record<BundleId, Omit<Bundle, 'params' | 'paramsLabel' | 'dModel' | 'nHeads' | 'nLayers' | 'contextLen' | 'dFF' | 'vocab' | 'nExperts' | 'id'>> = {
  multitask: {
    file: 'multitask-model.json',
    label: 'the built-in three-skill model',
    genScript: 'npm run gen:multitask',
    taughtOn: '50 Jabberwocky-style poems, single-variable algebra with worked steps, and sorted 3-number lists — all three at once, as plain next-character prediction',
  },
  multitaskDraft: {
    file: 'multitask-draft.json',
    label: 'the draft model',
    genScript: 'npm run gen:multitask-draft',
    taughtOn: 'the same corpus as the three-skill model, so it shares its vocabulary exactly',
  },
  moe: {
    file: 'moe-model.json',
    label: 'the Mixture-of-Experts model',
    genScript: 'npm run gen:moe',
    taughtOn: 'sorting, maximum and reversal of 3-number lists, with four expert networks per layer and a gate that routes each character',
  },
  sort: {
    file: 'sort-model.json',
    label: 'the sort-only model',
    genScript: 'npm run gen:sort',
    taughtOn: 'ascending sorts of 3-number lists, and nothing else',
  },
  harness: {
    file: 'harness-model.json',
    label: 'the tool-calling model',
    genScript: 'npm run gen:harness',
    taughtOn: 'instructions paired with tool calls — `instruction => tool(args) = result` — and two-step chains ending in `done`. It was never taught arithmetic',
  },
  adder: {
    file: 'adder-model.json',
    label: 'the adder model',
    genScript: 'npm run gen:adder',
    taughtOn: 'all 200 single-column addition facts (digit + digit + carry), plus 6,000 whole sums of up to 4 digits and 6,000 worked traces of those sums',
  },
  warehouse: {
    file: 'warehouse-model.json',
    label: 'the warehouse agent',
    genScript: 'npm run gen:warehouse',
    taughtOn: "a scripted picker's plans for 3-SKU orders. No item's attribute (fragile, heavy, food, chemical) ever appears as a character",
  },
  tictactoe: {
    file: 'tictactoe-model.json',
    label: 'the undertrained agent',
    genScript: 'npm run gen:tictactoe',
    taughtOn: 'board positions paired with a soft move preference from a perfect minimax player — for 100 steps, about a third of one pass over the 4,520 reachable positions. It was never told the rules, and never told which cells are legal',
    measuredBy: 'npm run eval:tictactoe',
  },
  classifier: {
    file: 'classifier-model.json',
    label: 'the message classifier',
    genScript: 'npm run gen:classifier',
    taughtOn:
      '960 short customer messages about grocery orders, generated from per-route templates crossed with a product list, each paired with one of eight route codes. It was never taught to write anything — the only thing it produces is a single character naming a route',
  },
  tictactoeStrong: {
    file: 'tictactoe-strong-model.json',
    label: 'the well-trained agent',
    genScript: 'npm run gen:tictactoe-strong',
    taughtOn: 'the same positions and the same oracle as the undertrained agent, with the same architecture and the same parameter count — for 250 shuffled passes over every reachable position instead of a third of one. It was never told the rules either',
    measuredBy: 'npm run eval:tictactoe',
  },
}

export const BUNDLES = Object.fromEntries(
  (Object.keys(STRUCT) as BundleId[]).map((id) => [
    id,
    { id, ...STRUCT[id], ...META[id], paramsLabel: round(STRUCT[id].params) },
  ]),
) as Record<BundleId, Bundle>

/** Params of a bundle, rounded for prose: `paramsOf('adder')` -> "~90K". */
export const paramsOf = (id: BundleId) => BUNDLES[id].paramsLabel

// ---------------------------------------------------------------------------
// Measured results. Each says what it was measured on. Update after a retrain.
// ---------------------------------------------------------------------------

export const MEASURED = {
  /** Three-skill model: exact-match on unseen 3-number sort lists. */
  multitaskSort: { pct: 89, n: 145, of: 'unseen 3-number sort lists', seed: 1337 },
  /** Sort-only model, ascending, held-out. */
  sortOnly: { pct: 97, n: 145, of: 'unseen 3-number sort lists' },
  /** Adder: single columns, and whole sums through the harness loop. */
  adderColumns: { pct: 100, n: 200, of: 'single-column addition facts' },
  adderLoop: { pct: 100, n: 0, of: 'whole sums at 4, 6, 10, 15 and 25 digits, through the loop' },
  adderSinglePass: { pct: 0, n: 0, of: 'whole sums in one pass, at every width tested' },
  adderSelfTrace: { pct: 10, n: 0, of: 'its own written working at 4 digits' },
  /**
   * The three-skill model's own confidence on held-out sorts — mean top-character probability
   * across the answer — split by whether the answer was right. The gap is real and far too
   * small to act on: it is 94% confident on the ones it gets wrong.
   */
  multitaskSortConfidence: { whenRight: 98.0, whenWrong: 93.9, nRight: 132, nWrong: 13 },
  /**
   * What a MASKED READ throws away, measured with `scripts/measure-escaped-mass.ts`.
   *
   * Neither the classifier nor the game agent has a classification head. Both keep the full
   * language-modelling head over the whole vocabulary, take the final position's logits, pick out
   * the answer characters and renormalise a softmax over just those. Everything the model wanted
   * to say outside the answer set is discarded without appearing anywhere, so the displayed
   * confidence could in principle be manufactured from a remainder.
   *
   * IT IS NOT, and that is the finding. On all 1,440 in-format classifier prompts the escaped mass
   * is at most half a percentage point, and the single highest-scoring character over the whole
   * 37-character vocabulary is one of the eight answers every single time. The model learned the
   * format so completely that the constraint in the reading code has nothing left to do.
   *
   * The exception needs a degenerate input, and a visitor can type one: forty identical letters
   * escapes 98% and the demo still reports a confident route. That is the honest difference from a
   * real classification head — there the guarantee is structural and free, here it is a learned
   * habit that cost training capacity and holds only while the input looks like training data.
   */
  maskedRead: {
    /** Mean mass outside the eight answer characters, by split. */
    escapedTrain: 0.01,
    escapedUnseenProduct: 0.01,
    escapedUnseenPhrasing: 0.02,
    /** Worst single in-format prompt, over all 1,440. */
    escapedWorst: 0.47,
    /** Largest gap between the confidence shown and the raw probability, in percentage points. */
    inflationWorst: 0.39,
    nInFormat: 1440,
    /** How often the best character in the WHOLE vocabulary was not one of the eight. */
    outsideWins: 0,
    /** A visitor typing forty identical letters: mass escaped, and what the demo still shows. */
    degenerateEscaped: 98.1,
    degenerateShown: 58.2,
    /**
     * "hello" — an ordinary word that is not a complaint at all. Escaped mass 0.00%, so this is
     * the model's genuine belief and not an artefact of the renormalisation. The masked read is
     * innocent here; the model is not.
     */
    helloShown: 97.9,
    helloRoute: 'wrong item sent',
    /** The same read on the game agent, over all 4,520 states. The weak agent's is constant. */
    tttWeakEscaped: 0.65,
    tttStrongEscaped: 0.02,
  },
  /**
   * The grocery message classifier, measured on the shipped weights. The split matters more than
   * the headline: it generalises over the PRODUCT almost perfectly and over the PHRASING barely
   * at all, because at this size it is matching wording rather than meaning.
   */
  classifier: {
    train: 99.8,
    unseenProduct: 97.9,
    unseenPhrasing: 39.6,
    chance: 12.5,
    /**
     * Mean stated confidence when right and when wrong, on the unseen-PRODUCT split — the one
     * the model can do. Thirty points of separation, which is what a threshold needs.
     */
    saidWhenRight: 98,
    saidWhenWrong: 68,
    /**
     * The same two on the unseen-PHRASING split, where it cannot. The gap collapses to eleven
     * points: the confidence tracks how familiar the WORDING is, not whether the answer is
     * right, so it separates well exactly where the model was already doing well. That is the
     * limit of a confidence threshold as a safety net, and it is the reason the demo shows both.
     */
    saidWhenRightNovel: 91,
    saidWhenWrongNovel: 80,
    nTrain: 960,
    nUnseenProduct: 240,
    nUnseenPhrasing: 240,
  },
  /** Warehouse: unseen baskets (a rule-covering held-out split). */
  warehouseHeldOut: { pct: 90, n: 16, of: 'unseen baskets' },
  warehouseTrain: { pct: 98, n: 0, of: 'baskets it trained on' },
  /** Tic-tac-toe, over ALL 4,520 reachable decision states (`npm run eval:tictactoe`). */
  ttt: {
    states: 4_520,
    weak: { legal: 40, optimal: 24, win: 15, block: 18, vsRandom: 64, vsPerfect: 0, losingLines: 455 },
    strong: { legal: 100, optimal: 98, win: 89, block: 92, vsRandom: 100, vsPerfect: 94, losingLines: 9 },
    /** Mean attention on the opponent's threat cell, over the must-block boards. */
    threatFocus: { weak: 0.2, strong: 0.79, boards: 1_484 },
    /**
     * Calibration of the confidence number the agent shows for its chosen cell, swept over all
     * 4,520 states (scripts/… equivalent run offline; see docs/BUILD-DECISIONS.md entry 22).
     *
     * The weak model's confidence is a CONSTANT: 17.4158% to 17.4225% across every board, a
     * spread of 0.007 percentage points. It does not vary with the position at all, so it
     * cannot carry information about it — while being displayed as though it did.
     *
     * The strong model's varies, and ranks correctly (higher when it is about to be right), but
     * is badly under-confident as a probability: at a stated 30% it is optimal ~96% of the time.
     */
    confidence: {
      weak: { min: 17.42, max: 17.42, spreadPp: 0.007, mean: 17.4, saidWhenOptimal: 17.4, saidWhenNot: 17.4 },
      strong: { min: 20.4, max: 100, spreadPp: 79.6, mean: 71.1, saidWhenOptimal: 71.5, saidWhenNot: 48.1 },
      /**
       * WHY THERE IS NO SINGLE "IS IT CALIBRATED" NUMBER HERE, and why an earlier draft was wrong.
       *
       * 46.8% of the 4,520 states have MORE THAN ONE optimal move (mean 1.96, up to 9). So a model
       * that correctly splits its probability across three equally-good moves shows a top-1
       * confidence near 0.33 and is scored "right" — which reads as wild under-confidence and is
       * nothing of the sort. Measured both ways on the strong model:
       *
       *   top-1 probability      stated 27% -> optimal 92%   (looks badly under-confident)
       *   mass on the optimal set  mass 26% -> optimal 12%   (roughly honest, slightly over)
       *
       * Which measure is right depends on which claim is being tested. For "higher confidence
       * means higher accuracy" (a RANKING claim) top-1 is fine. For "0.9 means nine times in ten"
       * (a PROBABILITY claim) only the set mass is meaningful. The tab shows both for that reason.
       */
      ties: { multiOptimalPct: 46.8, meanOptimalMoves: 1.96 },
    },
  },
} as const

// ---------------------------------------------------------------------------
// Back-compat: the original single-model exports, now derived from BUNDLES.
// ---------------------------------------------------------------------------

export const MODEL_STATS = {
  params: BUNDLES.multitask.params,
  paramsLabel: '~0.09M',
  steps: 6_000,
  sortAccuracy: MEASURED.multitaskSort.pct,
  sortHeldOut: MEASURED.multitaskSort.n,
  seed: MEASURED.multitaskSort.seed,
  model: BUNDLES.multitask.file,
  minutes: 30,
  chars: 226_442,
  vocab: BUNDLES.multitask.vocab,
  machine: 'MacBook Air (M4, 10-core CPU, 16 GB)',
  runtime: 'single-threaded JavaScript (no GPU)',
} as const

export const MODEL_METHOD =
  `Measured: exact-match on ${MODEL_STATS.sortHeldOut} unseen sort lists (a deterministic held-out ` +
  `split, none seen in training), one run, seed ${MODEL_STATS.seed}, ${MODEL_STATS.model}. ` +
  `A single run — representative, not averaged.`

export const MODEL_EXAMPLES: { label: string; prompt: string; note: string }[] = [
  { label: 'Poem', prompt: "'Twas brillig, and the ", note: 'generates Jabberwocky-style verse' },
  { label: 'Sort', prompt: 'sort 6 9 2 => ', note: 'really sorts — a learned procedure' },
  { label: 'Solve', prompt: '7x + 2 = 16 => ', note: 'looks like working, but the maths is invented' },
]

export const MODEL_STATS_LINE =
  `${MODEL_STATS.paramsLabel} params · poems + algebra + sorting · sorts unseen inputs at ` +
  `~${MODEL_STATS.sortAccuracy}% · ~${MODEL_STATS.minutes} min of ${MODEL_STATS.runtime} on a ${MODEL_STATS.machine}`
