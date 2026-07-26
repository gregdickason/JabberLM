// Tic-tac-toe: the capstone's playable closed-loop agent task. A tiny char model learns to
// play from expert (minimax) games — given a board it emits the cell to play. The point of the
// capstone is the AGENT LOOP: the human moves, the harness feeds the new board back, the agent
// reads it and responds, until the game ends — and a deterministic harness CHECK LAYER catches
// the model's occasional illegal (hallucinated) move.
//
// Pure module (no engine import): board rules + minimax + the training corpus + the verifier,
// the single source of truth. Deterministic (fixed-seed mulberry32) for a reproducible split.

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

export type Mark = 'X' | 'O'
export type Board = string // 9 chars, index 0-8 row-major, each 'X' | 'O' | '.'
export const EMPTY: Board = '.........'

const LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6], // diagonals
]

export function legalMoves(b: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < 9; i++) if (b[i] === '.') out.push(i)
  return out
}

export function applyMove(b: Board, cell: number, mark: Mark): Board {
  return b.slice(0, cell) + mark + b.slice(cell + 1)
}

/** Whose turn it is: X moves first, so X is to move whenever counts are equal. */
export function toMove(b: Board): Mark {
  let x = 0, o = 0
  for (const c of b) { if (c === 'X') x++; else if (c === 'O') o++ }
  return x === o ? 'X' : 'O'
}

export function winner(b: Board): Mark | null {
  for (const [a, c, d] of LINES) {
    if (b[a] !== '.' && b[a] === b[c] && b[c] === b[d]) return b[a] as Mark
  }
  return null
}

export function isDraw(b: Board): boolean {
  return winner(b) === null && legalMoves(b).length === 0
}
export function isTerminal(b: Board): boolean {
  return winner(b) !== null || legalMoves(b).length === 0
}

// ---- minimax (negamax with memoisation) -------------------------------------

const memo = new Map<Board, { value: number; best: number[] }>()

/** Best value (+1 win / 0 draw / −1 loss, from the side-to-move's view) and ALL cells that
 *  achieve it, under optimal play. Assumes `b` is non-terminal. */
export function negamax(b: Board): { value: number; best: number[] } {
  const cached = memo.get(b)
  if (cached) return cached
  const mark = toMove(b)
  let bestVal = -Infinity
  const best: number[] = []
  for (const m of legalMoves(b)) {
    const nb = applyMove(b, m, mark)
    let v: number
    if (winner(nb) === mark) v = 1
    else if (legalMoves(nb).length === 0) v = 0 // draw
    else v = -negamax(nb).value
    if (v > bestVal) { bestVal = v; best.length = 0; best.push(m) }
    else if (v === bestVal) best.push(m)
  }
  const res = { value: bestVal, best }
  memo.set(b, res)
  return res
}

/** All minimax-optimal moves for the side to move (a model move is "optimal" if it's in here). */
export function optimalMoves(b: Board): number[] {
  return negamax(b).best
}

/** Minimax value of playing cell `c` now (from the mover's view: +1 win, 0 draw, −1 loss). */
export function moveValue(b: Board, c: number, mark: Mark): number {
  const nb = applyMove(b, c, mark)
  if (winner(nb) === mark) return 1
  if (legalMoves(nb).length === 0) return 0
  return -negamax(nb).value
}

/** A SOFT training target over the 9 cells (the oracle's policy, for logit distillation):
 *  illegal cells → 0; legal cells weighted by softmax(minimax value / T), so wins dominate,
 *  blocks (draw-vs-loss) are strongly preferred, and losing moves are ~0. Far denser than a
 *  one-hot "copy this move", and it directly teaches "never an occupied cell". */
export function moveTarget(b: Board, T = 0.4): number[] {
  const t = new Array(9).fill(0)
  const legal = legalMoves(b)
  const mark = toMove(b)
  const vals = legal.map((c) => moveValue(b, c, mark))
  const mx = Math.max(...vals)
  const exps = vals.map((v) => Math.exp((v - mx) / T))
  const sum = exps.reduce((a, x) => a + x, 0) || 1
  legal.forEach((c, i) => { t[c] = exps[i] / sum })
  return t
}

// ---- move reasoning (deterministic — the harness surfaces WHY a move is good/bad) ----

/** Cells where placing `mark` immediately completes a line (a winning move). */
export function winningCells(b: Board, mark: Mark): number[] {
  return legalMoves(b).filter((c) => winner(applyMove(b, c, mark)) === mark)
}

export interface MoveAnalysis {
  tookWin: boolean // the move completed a line (the agent won)
  madeBlock: boolean // the move blocked the opponent's immediate winning threat
  missedWin: number | null // the agent had a winning cell but didn't take it
  missedBlock: number | null // the opponent threatened to win and the agent didn't block (and didn't win)
}

/** What the harness can say about a move, computed deterministically (minimax-free, just
 *  one-ply threats): did it take an available win? block an opponent's threat? or miss one? */
export function analyzeMove(before: Board, move: number, mark: Mark): MoveAnalysis {
  const opp: Mark = mark === 'X' ? 'O' : 'X'
  const wins = winningCells(before, mark) // the agent's own immediate wins
  const threats = winningCells(before, opp) // cells where the opponent would win next → must block
  const tookWin = wins.includes(move)
  const madeBlock = threats.includes(move)
  return {
    tookWin,
    madeBlock,
    missedWin: !tookWin && wins.length ? wins[0] : null,
    missedBlock: !tookWin && !madeBlock && threats.length ? threats[0] : null,
  }
}

// ---- state space + encoding -------------------------------------------------

/** Every reachable NON-terminal board (a state where someone must move), both sides' turns. */
export function allDecisionStates(): Board[] {
  const seen = new Set<Board>()
  const out: Board[] = []
  const dfs = (b: Board) => {
    if (isTerminal(b) || seen.has(b)) return
    seen.add(b)
    out.push(b)
    const mark = toMove(b)
    for (const m of legalMoves(b)) dfs(applyMove(b, m, mark))
  }
  dfs(EMPTY)
  return out
}

/** Encode a board with each cell's INDEX before its mark: "0X1O2.3.4X5.6.7.8.". This makes
 *  emitting a move a COPY of an empty cell's index (a selection the model can do) rather than
 *  a positional count (which a tiny char model does badly — the "which r in strawberry" trap). */
export const boardEncode = (b: Board): string => Array.from({ length: 9 }, (_, i) => `${i}${b[i]}`).join('')

/** The states that DECIDE games: a win is available now, or the opponent threatens to win and
 *  must be blocked. Training oversamples these so the tiny model reliably takes wins and blocks
 *  threats — vs a human, almost every loss is a missed block, so nailing these is what matters. */
export function tacticalStates(): Board[] {
  return allDecisionStates().filter((b) => {
    const mk = toMove(b)
    return winningCells(b, mk).length > 0 || winningCells(b, mk === 'X' ? 'O' : 'X').length > 0
  })
}

/** Pick a training board with tactical oversampling: with prob `pTactical` from the
 *  game-deciding states, else from all states. `r`/`r2` are two uniform randoms in [0,1). */
export function sampleTrainState(all: Board[], tactical: Board[], r: number, r2: number, pTactical = 0.55): Board {
  const pool = r < pTactical && tactical.length ? tactical : all
  return pool[Math.floor(r2 * pool.length)]
}

/** How many cells are filled (0 = empty board, the opening; 8 = last forced move). */
export function plyOf(b: Board): number {
  let n = 0
  for (const c of b) if (c !== '.') n++
  return n
}

/** True if this state DECIDES a game right now: a win is available, or the opponent threatens
 *  one that must be blocked. (Single-state form of `tacticalStates`.) */
export function isTactical(b: Board): boolean {
  const mk = toMove(b)
  return winningCells(b, mk).length > 0 || winningCells(b, mk === 'X' ? 'O' : 'X').length > 0
}

/** The COVERAGE-BALANCED training deck for the well-trained model. A weighted multiset of every
 *  reachable decision state:
 *   • base 1 each  → GUARANTEES every state is seen each pass (exhaustive coverage). Because all
 *     8 symmetric variants of a position are themselves distinct reachable states, this trains
 *     the symmetries for free — no separate D4 augmentation needed. This alone fixes any genuine
 *     undersampling (the with-replacement weak sampler could skip states entirely).
 *   • + kTac for win/block states → the REAL weakness is tactical (mid/late-game blocks & wins),
 *     so decisive states carry extra weight.
 *   • + a SMALL ~kOpen/count(ply) opening nudge → just enough to not neglect early plies.
 *  NB: we deliberately do NOT flood openings. Tic-tac-toe openings have near-*uniform* optimal
 *  targets (every early move draws under perfect play → `moveTarget(EMPTY)` ≈ uniform, entropy
 *  ≈ ln 9 ≈ 2.2), so heavy opening oversampling drowns training in high-entropy, low-information
 *  targets and collapses the model to a flat output. Coverage + tactical emphasis is the win. */
export function trainingDeck(kTac = 5, kOpen = 20): Board[] {
  const all = allDecisionStates()
  const perPly: Record<number, number> = {}
  for (const b of all) { const p = plyOf(b); perPly[p] = (perPly[p] ?? 0) + 1 }
  const deck: Board[] = []
  for (const b of all) {
    const mult = 1 + (isTactical(b) ? kTac : 0) + Math.round(kOpen / perPly[plyOf(b)])
    for (let i = 0; i < mult; i++) deck.push(b)
  }
  return deck
}

/** One training line: board → a canonical optimal move (smallest-index optimal cell). */
export const ticLine = (b: Board): string => `move ${boardEncode(b)} => ${optimalMoves(b)[0]}`
/** The prompt the agent conditions on for a board. */
export const ticPrompt = (b: Board): string => `move ${boardEncode(b)} => `

// ---- corpus -----------------------------------------------------------------

const SPLIT_SEED = 20250726 // deterministic corpus-shuffle seed

/** A tic-tac-toe corpus (~targetChars) of board→optimal-move lines. A game agent should
 *  memorise the WHOLE optimal policy (not generalise to unseen boards — optimal play is a
 *  lookup, not a smooth rule), so we cycle through EVERY reachable decision state, shuffled,
 *  giving each roughly equal coverage. (Generalisation is the warehouse demo's lesson.) */
export function buildTicTacToeCorpus(targetChars = 150000): string {
  const rnd = mulberry32(SPLIT_SEED ^ 0x1234)
  const states = allDecisionStates()
  for (let i = states.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[states[i], states[j]] = [states[j], states[i]]
  }
  const lines: string[] = []
  let chars = 0, idx = 0
  while (chars < targetChars) {
    const l = ticLine(states[idx++ % states.length])
    lines.push(l)
    chars += l.length + 1
  }
  return lines.join('\n') + '\n'
}

// ---- verifier / parse -------------------------------------------------------

/** Parse the agent's move (the first digit 0-8) out of its generated completion, or null. */
export function parseMove(completion: string): number | null {
  const m = completion.match(/[0-8]/)
  return m ? Number(m[0]) : null
}
