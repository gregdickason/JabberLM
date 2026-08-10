// Page glue for the tic-tac-toe agent — an agent TURN through the harness. We deliberately
// DON'T mask illegal moves out of the model: we want it to sometimes hallucinate an illegal
// move so the harness CHECK LAYER can catch it. With the check on, the harness rejects the
// illegal move and asks the model to choose again (re-sampling) — the correction "sent back";
// after a few tries it takes the model's best legal cell. With the check off, the illegal
// move stands and the game is stuck — showing why the deterministic guard matters.
import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'
import { generate } from '../engine/generate'
import type { RNG } from '../engine/random'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, type ModelConfig } from '../engine/config'
import { ticPrompt, legalMoves, toMove, analyzeMove, parseMove, allDecisionStates, optimalMoves, winningCells, winner, applyMove, plyOf, type Board, type Mark, type MoveAnalysis } from '../data/tictactoe'

export const TTT_CFG: ModelConfig = {
  vocabSize: 0, dModel: 64, nHeads: 4, nLayers: 3, contextLen: 32, dFF: 192, activation: 'gelu', weightTying: true,
}

export interface Attempt { move: number; legal: boolean; kind: 'greedy' | 'resample' | 'fallback' }
export interface AgentTurn {
  attempts: Attempt[] // the model's tries — attempt 0 is its top pick; more appear when the harness re-asks
  move: number | null // the legal move finally played (null ⇒ fumbled: illegal, check off)
  caught: boolean // the harness caught ≥1 illegal move and intervened
  fumbled: boolean // check off + illegal ⇒ the game is stuck
  analysis: MoveAnalysis | null // did it take a win / block a threat / miss one?
  cellProbs: number[] // the model's confidence over the 9 cells (its top pick)
}

/** The model's confidence over the 9 cells for the current board, plus its greedy top pick. */
function readCells(model: Model, tok: CharTokenizer, board: Board): { probs: number[]; top: number } {
  const ids = tok.encode(ticPrompt(board))
  const { logits } = model.forward(ids.slice(Math.max(0, ids.length - model.cfg.contextLen)), DEFAULT_FEATURE_FLAGS)
  const V = logits.cols
  const base = (logits.rows - 1) * V
  const cellLogits = Array.from({ length: 9 }, (_, c) => {
    const id = tok.stoi.get(String(c))
    return id != null ? logits.data[base + id] : -Infinity
  })
  const mx = Math.max(...cellLogits)
  const exps = cellLogits.map((l) => (l === -Infinity ? 0 : Math.exp(l - mx)))
  const sum = exps.reduce((a, b) => a + b, 0) || 1
  const probs = exps.map((e) => e / sum)
  let top = 0
  for (let c = 1; c < 9; c++) if (probs[c] > probs[top]) top = c
  return { probs, top }
}

/** Sample one move stochastically (for the harness re-ask), 0-8 or null if it emits garbage. */
function sampleMove(model: Model, tok: CharTokenizer, board: Board, rng: RNG): number | null {
  const out = generate(model, DEFAULT_FEATURE_FLAGS, tok, ticPrompt(board), { ...DEFAULT_SAMPLE_CONFIG, temperature: 0.9, maxNewTokens: 2 }, rng)
  return parseMove(out.split('\n')[0])
}

/** Run one agent turn through the harness (see file header). */
export function agentTurn(model: Model, tok: CharTokenizer, board: Board, opts: { validate: boolean }, rng: RNG): AgentTurn {
  const mark = toMove(board)
  const legal = legalMoves(board)
  const { probs, top } = readCells(model, tok, board)
  const attempts: Attempt[] = [{ move: top, legal: legal.includes(top), kind: 'greedy' }]

  if (legal.includes(top)) {
    return { attempts, move: top, caught: false, fumbled: false, analysis: analyzeMove(board, top, mark), cellProbs: probs }
  }
  // the model hallucinated an illegal move
  if (!opts.validate) {
    return { attempts, move: null, caught: false, fumbled: true, analysis: null, cellProbs: probs }
  }
  // harness rejects it and asks the model to choose again (re-sample), up to a few tries
  for (let k = 0; k < 4; k++) {
    const mv = sampleMove(model, tok, board, rng)
    if (mv == null) continue
    const isLegal = legal.includes(mv)
    attempts.push({ move: mv, legal: isLegal, kind: 'resample' })
    if (isLegal) return { attempts, move: mv, caught: true, fumbled: false, analysis: analyzeMove(board, mv, mark), cellProbs: probs }
  }
  // still illegal → the harness enforces the model's best LEGAL cell
  const best = legal.reduce((a, c) => (probs[c] > probs[a] ? c : a), legal[0])
  attempts.push({ move: best, legal: true, kind: 'fallback' })
  return { attempts, move: best, caught: true, fumbled: false, analysis: analyzeMove(board, best, mark), cellProbs: probs }
}

// ---- exhaustive evaluation --------------------------------------------------
// Trustworthy strength metrics computed over ALL ~4,520 reachable states (one forward each),
// replacing the noisy 50-game sample. This is how we tell the well-trained model actually beats
// the undertrained one — and where each is weak (by ply).

/** The model's greedy top pick (argmax over the 9 cell tokens), legal or not. */
export function greedyMove(model: Model, tok: CharTokenizer, board: Board): number {
  return readCells(model, tok, board).top
}

/** Greedy pick if legal, else the highest-probability LEGAL cell (mirrors the harness fallback) —
 *  used to actually play out games during evaluation. */
function playMoveLegal(model: Model, tok: CharTokenizer, board: Board): number {
  const { probs, top } = readCells(model, tok, board)
  const lm = legalMoves(board)
  return lm.includes(top) ? top : lm.reduce((a, c) => (probs[c] > probs[a] ? c : a), lm[0])
}

function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export interface NeverLosesProof {
  linesX: number // complete games explored with the model as X
  linesO: number // …and as O
  lossesX: number // losing lines as X
  lossesO: number
  states: number // distinct boards the model's own play can reach (its true exposure)
  passes: boolean // zero losing lines on either side
  summary: string
}

/** EXHAUSTIVE never-loses proof. The model's move is DETERMINISTIC (greedy, legal fallback — the
 *  same rule the harness plays), so the game tree branches only where the OPPONENT chooses. That
 *  makes it small enough to enumerate completely: every legal opponent sequence, as X and as O.
 *
 *  This is a much stronger claim than "notLost over N sampled games", and a much WEAKER one than
 *  it sounds: it only visits states the model's own play steers into — a fraction of the 4,520
 *  (tictactoeLM FINDINGS F-05). A model can be provably safe and demonstrably imperfect at once,
 *  so always read `passes` beside all-state `optimal`. */
export function neverLosesProof(model: Model, tok: CharTokenizer): NeverLosesProof {
  const memo = new Map<Board, number>()
  return proveNeverLoses((b) => {
    const hit = memo.get(b)
    if (hit != null) return hit
    const mv = playMoveLegal(model, tok, b)
    memo.set(b, mv)
    return mv
  })
}

/** The proof itself, over ANY deterministic policy `pick`. Split out from the model so the metric
 *  can be ANCHORED on a policy whose correct score is known in advance — a perfect (minimax) policy
 *  must score zero losing lines, and a deliberately bad one must score some. Three metrics in the
 *  sibling project were specified above what perfect play can even reach, and each was caught only
 *  by scoring perfect play first (tictactoeLM F-09, F-10, F-24). See `__tests__`. */
export function proveNeverLoses(pick: (b: Board) => number): NeverLosesProof {
  let lines = 0, losses = 0
  const visited = new Set<Board>()
  const walk = (b: Board, agentMark: Mark): void => {
    const w = winner(b)
    if (w) { lines++; if (w !== agentMark) losses++; return }
    if (legalMoves(b).length === 0) { lines++; return }
    const mk = toMove(b)
    if (mk === agentMark) {
      visited.add(b)
      walk(applyMove(b, pick(b), mk), agentMark) // one branch: the policy is deterministic
    } else {
      for (const m of legalMoves(b)) walk(applyMove(b, m, mk), agentMark) // every legal reply
    }
  }
  walk('.........', 'X')
  const linesX = lines, lossesX = losses
  lines = 0; losses = 0
  walk('.........', 'O')
  const passes = lossesX === 0 && losses === 0
  return {
    linesX, linesO: lines, lossesX, lossesO: losses, states: visited.size, passes,
    summary:
      `never-loses ${passes ? 'PASS' : 'FAIL'} · as X ${lossesX}/${linesX} losing lines · ` +
      `as O ${losses}/${lines} · covers ${visited.size} of 4520 states ` +
      `(${((100 * visited.size) / 4520).toFixed(1)}% — a necessary condition, not all-state competence)`,
  }
}

export interface ExhaustiveEval {
  n: number // states scored
  legal: number // % of raw greedy moves that are legal
  optimal: number // % of raw greedy moves that are minimax-optimal
  win: number // % of win-available states where it takes the win
  block: number // % of must-block states where it blocks
  byPly: number[] // optimal% per ply (0..8), NaN where no states
  notLostVsRandom: number // % of games not lost vs a random opponent (both sides)
  notLostVsPerfect: number // % of games not lost vs a perfect (minimax) opponent (both sides)
  summary: string // one-line log string
}

/** Play one game: `agentMark` is the model; the opponent uses `oppPick`. Returns the game result
 *  from the MODEL's view: 'win' | 'draw' | 'loss'. */
function playGame(model: Model, tok: CharTokenizer, agentMark: Mark, oppPick: (b: Board) => number): 'win' | 'draw' | 'loss' {
  let b: Board = '.........'
  for (let ply = 0; ply < 9; ply++) {
    const mk = toMove(b)
    const mv = mk === agentMark ? playMoveLegal(model, tok, b) : oppPick(b)
    b = applyMove(b, mv, mk)
    const w = winner(b)
    if (w) return w === agentMark ? 'win' : 'loss'
    if (legalMoves(b).length === 0) return 'draw'
  }
  return 'draw'
}

/** Exhaustive strength report — see file section header. `games` games per side for each opponent. */
export function evalExhaustive(model: Model, tok: CharTokenizer, games = 150): ExhaustiveEval {
  const all = allDecisionStates()
  let legal = 0, optimal = 0, winTot = 0, winHit = 0, blockTot = 0, blockHit = 0
  const plyOK = new Array(9).fill(0), plyN = new Array(9).fill(0)
  for (const b of all) {
    const mk = toMove(b)
    const mv = greedyMove(model, tok, b)
    const lm = legalMoves(b), p = plyOf(b)
    plyN[p]++
    if (lm.includes(mv)) legal++
    if (optimalMoves(b).includes(mv)) { optimal++; plyOK[p]++ }
    const wins = winningCells(b, mk)
    if (wins.length) { winTot++; if (wins.includes(mv)) winHit++ }
    else {
      const threats = winningCells(b, mk === 'X' ? 'O' : 'X')
      if (threats.length) { blockTot++; if (threats.includes(mv)) blockHit++ }
    }
  }
  // opponents: random legal, and perfect (a random minimax-optimal move)
  const rr = prng(0xa11ce), pr = prng(0xbeef)
  const randPick = (b: Board) => { const lm = legalMoves(b); return lm[Math.floor(rr() * lm.length)] }
  const perfPick = (b: Board) => { const om = optimalMoves(b); return om[Math.floor(pr() * om.length)] }
  const notLost = (oppPick: (b: Board) => number) => {
    let ok = 0, tot = 0
    for (const mark of ['X', 'O'] as Mark[]) for (let g = 0; g < games; g++) { tot++; if (playGame(model, tok, mark, oppPick) !== 'loss') ok++ }
    return (100 * ok) / tot
  }
  const pct = (a: number, b: number) => (b ? (100 * a) / b : NaN)
  const byPly = plyOK.map((ok, i) => pct(ok, plyN[i]))
  const e: Omit<ExhaustiveEval, 'summary'> = {
    n: all.length,
    legal: pct(legal, all.length),
    optimal: pct(optimal, all.length),
    win: pct(winHit, winTot),
    block: pct(blockHit, blockTot),
    byPly,
    notLostVsRandom: notLost(randPick),
    notLostVsPerfect: notLost(perfPick),
  }
  const f = (x: number) => (Number.isNaN(x) ? ' — ' : x.toFixed(0) + '%')
  const summary =
    `legal ${f(e.legal)} · optimal ${f(e.optimal)} · win ${f(e.win)} · block ${f(e.block)} · ` +
    `notLost vs random ${f(e.notLostVsRandom)} · vs perfect ${f(e.notLostVsPerfect)} · ` +
    `optimal-by-ply [${e.byPly.map(f).join(' ')}]`
  return { ...e, summary }
}
