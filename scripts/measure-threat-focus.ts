// Re-measure the capstone's headline mechanistic claim: on boards where YOU threaten to win
// and the agent has no win of its own ("must-block" boards), how hard does the agent's
// strongest head look at the threatened cell? The well-trained model should score higher —
// that is the mechanistic reason it blocks more.
//
// These are properties of the SHIPPED WEIGHTS, not of the recipe, so re-run this after any
// retrain of either bundle (CLAUDE.md says so; this script is what it means):
//   node node_modules/vitest/node_modules/vite-node/vite-node.mjs scripts/measure-threat-focus.ts
import { readFileSync } from 'node:fs'
import { deserialize, type SavedModel } from '../src/engine/persist'
import { threatFocus } from '../src/capstone/AttentionBoard'
import { allDecisionStates, toMove, winningCells } from '../src/data/tictactoe'

const files = process.argv.slice(2)
const models = files.length ? files : ['public/tictactoe-model.json', 'public/tictactoe-strong-model.json']

// must-block: the opponent has an immediate winning cell and we have none of our own (so the
// only right move is the block — no "take the win instead" confound).
const boards = allDecisionStates()
  .map((b) => {
    const mk = toMove(b)
    return { b, threat: winningCells(b, mk === 'X' ? 'O' : 'X'), win: winningCells(b, mk) }
  })
  .filter((s) => s.threat.length > 0 && s.win.length === 0)

console.log(`\n${boards.length} must-block boards (of ${allDecisionStates().length} decision states)`)
for (const f of models) {
  const t = deserialize(JSON.parse(readFileSync(f, 'utf8')) as SavedModel)
  let sum = 0
  for (const s of boards) sum += threatFocus(t.model, t.tok, s.b, s.threat)
  console.log(`  ${f.padEnd(38)} mean threat focus ${(sum / boards.length).toFixed(3)}`)
}
