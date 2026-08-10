// Strength report for one or more bundled tic-tac-toe models.
//
//   node node_modules/vitest/node_modules/vite-node/vite-node.mjs scripts/eval-tictactoe.ts \
//     public/tictactoe-model.json public/tictactoe-strong-model.json
//
// Prints, per model: the exhaustive all-state report (legal / optimal / win / block / by-ply,
// plus games vs a random and a perfect opponent) AND the exhaustive never-loses proof.
//
// Read the two together. All-state accuracy counts HOW MANY states are wrong; the proof depends
// on WHICH — a model can be wrong in 0.4% of positions that never matter or 0.7% that do, and the
// aggregate cannot tell them apart (tictactoeLM FINDINGS F-18/F-22). Neither number alone is a
// claim about behaviour.

import { readFileSync } from 'node:fs'
import { deserialize, type SavedModel } from '../src/engine/persist'
import { evalExhaustive, neverLosesProof } from '../src/capstone/tictactoe-agent'

const files = process.argv.slice(2).filter((a) => a.endsWith('.json'))
if (!files.length) {
  console.error('usage: eval-tictactoe.ts <model.json> [model.json …]')
  process.exit(1)
}
const GAMES = Number(process.env.GAMES ?? 150)

for (const f of files) {
  const saved = JSON.parse(readFileSync(f, 'utf8')) as SavedModel
  const trainer = deserialize(saved)
  const nParams = trainer.model.params.reduce((n, p) => n + p.rows * p.cols, 0)
  const t0 = Date.now()
  const e = evalExhaustive(trainer.model, trainer.tok, GAMES)
  const p = neverLosesProof(trainer.model, trainer.tok)
  console.log(
    `\n${f}  (${nParams.toLocaleString()} params)\n` +
      `  ${e.summary}\n` +
      `  ${p.summary}\n` +
      `  optimal ${e.optimal.toFixed(2)}% → ${Math.round((e.n * (100 - e.optimal)) / 100)} of ${e.n} states wrong` +
      `   [${((Date.now() - t0) / 1000).toFixed(0)}s]`,
  )
}
