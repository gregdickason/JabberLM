/**
 * Cached calibration sweeps for the two tic-tac-toe agents, so the lab tab opens with both
 * curves already drawn instead of an empty chart that fills in over several seconds.
 *
 * These are the FULL sweeps — every one of the 4,520 non-terminal positions, not a sample. The
 * tab can re-measure live in the browser to prove the numbers, and
 * `src/data/__tests__/calibration.test.ts` recomputes them against the shipped weights, so a
 * retrain turns drift into a failing test rather than a quietly stale chart.
 *
 * ── The two measures, and why both are here ──────────────────────────────────────────────────
 * 46.8% of positions have more than one optimal move. So there are two honest ways to ask how
 * confident a model was, and they answer different questions:
 *
 *   top   — the probability on its single top pick. Tests a RANKING claim: is the number higher
 *           when the answer is better? Understates confidence wherever several moves tie, since
 *           a model correctly splitting three ways can only ever show about a third.
 *   mass  — the probability summed over every optimal move. Tests a PROBABILITY claim: does 0.9
 *           mean right nine times in ten? This is the one to read against the diagonal.
 */

export interface CalBucket {
  /** Lower edge of the confidence band, in percent. */
  lo: number
  /** Positions that fell in it. */
  n: number
  /** Mean confidence stated within the band. */
  conf: number
  /** How often the chosen move was in fact optimal. */
  opt: number
}

export interface CalSweep {
  n: number
  min: number
  max: number
  mean: number
  /** Mean stated confidence when the move was optimal, and when it was not. */
  saidOpt: number
  saidNot: number
  pctOpt: number
  pctLegal: number
  /** Share of positions with more than one optimal move. */
  tiePct: number
  top: CalBucket[]
  mass: CalBucket[]
}

export type AgentKey = 'weak' | 'strong'

export const CALIBRATION: Record<AgentKey, CalSweep> = {
  weak: {
    n: 4520,
    min: 17.4158,
    max: 17.4225,
    mean: 17.42,
    saidOpt: 17.42,
    saidNot: 17.42,
    pctOpt: 23.92,
    pctLegal: 40.22,
    tiePct: 46.77,
    top: [{ lo: 10, n: 4520, conf: 17.42, opt: 23.92 }],
    mass: [
      { lo: 0, n: 636, conf: 7.73, opt: 0 },
      { lo: 10, n: 1969, conf: 14.08, opt: 16.15 },
      { lo: 20, n: 693, conf: 24.64, opt: 17.6 },
      { lo: 30, n: 539, conf: 34.43, opt: 40.26 },
      { lo: 40, n: 405, conf: 44.41, opt: 54.32 },
      { lo: 50, n: 175, conf: 53.85, opt: 67.43 },
      { lo: 60, n: 71, conf: 64.2, opt: 76.06 },
      { lo: 70, n: 27, conf: 72.85, opt: 100 },
      { lo: 80, n: 4, conf: 84.55, opt: 100 },
      { lo: 90, n: 1, conf: 100, opt: 100 },
    ],
  },
  strong: {
    n: 4520,
    min: 20.4415,
    max: 99.9971,
    mean: 71.05,
    saidOpt: 71.54,
    saidNot: 48.12,
    pctOpt: 97.9,
    pctLegal: 100,
    tiePct: 46.77,
    top: [
      { lo: 20, n: 71, conf: 27.26, opt: 91.55 },
      { lo: 30, n: 332, conf: 35.87, opt: 93.98 },
      { lo: 40, n: 508, conf: 45.49, opt: 93.9 },
      { lo: 50, n: 644, conf: 54.72, opt: 96.12 },
      { lo: 60, n: 575, conf: 65.07, opt: 98.78 },
      { lo: 70, n: 544, conf: 75.14, opt: 98.9 },
      { lo: 80, n: 642, conf: 85.23, opt: 100 },
      { lo: 90, n: 1204, conf: 96.3, opt: 100 },
    ],
    mass: [
      { lo: 10, n: 8, conf: 18.39, opt: 0 },
      { lo: 20, n: 17, conf: 25.65, opt: 11.76 },
      { lo: 30, n: 34, conf: 35.64, opt: 29.41 },
      { lo: 40, n: 71, conf: 45.33, opt: 60.56 },
      { lo: 50, n: 132, conf: 55.4, opt: 88.64 },
      { lo: 60, n: 233, conf: 65.69, opt: 97.85 },
      { lo: 70, n: 407, conf: 75.61, opt: 100 },
      { lo: 80, n: 801, conf: 85.63, opt: 100 },
      { lo: 90, n: 2817, conf: 97.32, opt: 100 },
    ],
  },
}

/**
 * Worked positions for the per-board view. Percentages per cell, from the shipped weights.
 *
 * Note what the `weak` vectors do across three completely different boards: they are identical,
 * to the decimal. That is the clearest statement of the finding — the agent is not reading the
 * position, and its confidence could not vary even in principle.
 */
export interface CalExample {
  board: string
  label: string
  toMove: 'X' | 'O'
  optimal: number[]
  strong: number[]
  weak: number[]
}

export const CAL_EXAMPLES: CalExample[] = [
  {
    board: 'OO.XOXX..',
    label: 'three moves are equally good',
    toMove: 'X',
    optimal: [2, 7, 8],
    strong: [0, 0.1, 32.6, 0, 0, 0.1, 0.1, 34.2, 32.9],
    weak: [13.7, 9.4, 14.3, 5.4, 12.8, 9.2, 10.8, 6.9, 17.4],
  },
  {
    board: '..X.O....',
    label: 'seven moves are equally good',
    toMove: 'X',
    optimal: [0, 1, 3, 5, 6, 7, 8],
    strong: [14.3, 21.1, 0, 19.4, 0, 20.4, 4.3, 8.4, 12.1],
    weak: [13.7, 9.4, 14.3, 5.4, 12.8, 9.2, 10.8, 6.9, 17.4],
  },
  {
    board: 'XOXOXO.XO',
    label: 'only one move is any good',
    toMove: 'X',
    optimal: [6],
    strong: [0, 0.3, 0.1, 0, 0, 0, 99.5, 0.1, 0],
    weak: [13.7, 9.4, 14.3, 5.4, 12.8, 9.2, 10.8, 6.9, 17.4],
  },
]

/** Top pick and the mass across every optimal move, for one example. */
export const readSpread = (probs: number[], optimal: number[]) => {
  let top = 0
  for (let c = 1; c < 9; c++) if (probs[c] > probs[top]) top = c
  return { top, topPct: probs[top], massPct: optimal.reduce((a, c) => a + probs[c], 0) }
}
