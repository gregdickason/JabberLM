# CLAUDE.md

Guidance for working in this repo.

## What this is

JabberLM — a browser-only, educational decoder-only transformer. It trains in-browser with a
char-level tokenizer and exposes every internal (Q/K/V, attention, gradients, logits) for inspection.
The point is **inspectability**: prefer clear, traceable math over cleverness or speed. The model is
tiny, so plain-JS forward/backward is fine.

It also **ships a pre-trained "three-skill" model** (`public/multitask-model.json`, ~90K params,
trained offline by `scripts/gen-model.ts` `DATASET=multitask` on poems + algebra + sorting; corpus
builder in `scripts/multitask-corpus.ts`) that auto-loads on first visit so inference/inspection works
with no training. The teaching arc is **memorisation vs hallucination vs generalisation** in one
model: poems (memorised style), algebra (fluent but wrong — it can't learn the arithmetic), sorting
(genuinely learned, generalises to unseen inputs, with a grokking jump). A second bundled model,
`public/moe-model.json` (`DATASET=moe`, `gen:moe`, ~145K params, 4-expert token-level MoE on
sort+max+reverse), drives the lab's Mixture-of-Experts tab. A third, `public/sort-model.json`
(`DATASET=sort`, `gen:sort`, default preset, sort-only), drives the lab's **Injury & recovery** tab:
ablate the critical head → retrain with it locked off (`stepBatch(trainCfg, flags, ablate?)`, keys
"layer.head") → the skill recovers as other heads take over → re-scan shows the critical head moved.
The ablation zeroing (`attention.ts`, `scale(headOut, 0)`) is differentiable, so the ablated head gets
~zero gradient and the rest reroutes. The lab's **Distillation** tab reuses `sort-model.json` as a
**teacher** and trains a live tiny **student** via `Trainer.distillStep(cfg, flags, teacher, T)` — student
loss = `T²·softCrossEntropy(studentLogits/T, softmax(teacherLogits/T))` (new `softCrossEntropy` op in
`ops.ts`, grad `(studentProbs − teacherProbs)/seq`); teacher & student must share a vocab (build the
student on the teacher's corpus). Offline: the ~6× smaller student reaches the teacher's ~95% and groks
~2–3× faster than an identical hard-label student. The lab's **LoRA fine-tuning** tab (`LoraSection.tsx`)
also reuses `sort-model.json`: freeze the ascending base, attach a tiny LoRA adapter (rank 8, attn+mlp,
~12% of base) via `Trainer.startFineTune`, and train ONLY the adapter on **descending** sort
(`descendingSortLine`/`buildDescendingSortCorpus` in `tasks.ts`, same `sort a b c => ` prompt) — toggling
the overlay (`flags.lora`) flips the output `2 6 9 ↔ 9 6 2` while ascending (overlay off) stays ~97%
(base frozen). Measured with `sortAccuracyDir`/`genSortLine` (`interp/ablation.ts`, flags-aware). **LoRA UI
was removed from the playground** (kept to simple training); the lab is the only LoRA surface.
The lab's **Forgetting** tab (`ForgettingSection.tsx`) reuses `sort-model.json` to show **catastrophic
forgetting** and the **self-distillation / replay** fix: teach the model a new verb **`tros`** ("sort"
backwards → descending, in-vocab so one model can hold both — `trosLine`/`buildTrosCorpus` in `tasks.ts`) two
ways. `Trainer.sftStep(cfg, flags, ids)` (full-param CE on a supplied corpus) forgets — `sort` collapses
~96%→~4% as `tros` is learned. `Trainer.replayStep(cfg, flags, {newIds, oldIds, teacher, lambda, temperature})`
adds a `softCrossEntropy` self-distillation loss against a **frozen snapshot** (`deserialize` copy) on the OLD
task, so both survive (λ=0.5, T=2; `tros`→~100%, `sort`→~95%). This is the in-browser core of relevance-masked
self-distillation (minus the paper's LLM judge — we replay whole old-task windows). The **same-prompt**
asc/desc pair only works for LoRA (the overlay disambiguates); a single weight set needs the distinct `tros`
verb.
The lab's **Speculative decoding** tab (`SpeculativeSection.tsx`) pairs the bundled `multitask-model.json`
(**target**, ~90K) with `public/multitask-draft.json` (**draft**, ~17K tiny, `gen:multitask-draft`, trained
on the SAME corpus → identical vocab). `speculativeGenerate(draft, target, tok, prompt, flags, maxNew, K)`
(`engine/generate.ts`): the draft proposes K tokens, the target verifies all K in ONE forward (its logits at
every position — `Model.forward` returns seq×vocab), accept the longest matching prefix, correct the first
miss, and a free "bonus" token if all K match. Greedy ⇒ output is **bit-for-bit identical** to
`generate(target)` (capped so prompt+gen+K ≤ contextLen, no cropping — that identity is the unit test).
Measured: ~2.3× fewer TARGET forwards at K=4, ~34% draft acceptance; honest caveat — wall-clock barely moves
at this tiny single-thread/no-KV-cache scale (the win is fewer sequential big-model steps, which is latency at
real scale). The lab's **reward learning (RLVR)** tab (`RlvrSection.tsx`) trains a fresh tiny sort model live
in two phases: a brief **SFT warm-up** (stepBatch) to ~55–60%, then **RLVR** (GRPO-lite policy gradient) that
climbs to ~90%+ **from a verifier reward alone** — no labelled answers. Engine: `Trainer.rlvrStep(cfg, flags,
{prompts, groupSize, temperature, maxNew, reward, promptsPerStep})` samples a group of completions per prompt,
scores each with `sortReward` (`interp/ablation.ts` — 1 if correctly sorted), advantage = reward − group mean,
and updates via the new **`weightedNLL(logits, tokens, weights)`** op (`ops.ts`, grad-checked) — per-position
NLL scaled by a per-row weight (0 masks the prompt; the advantage, which can be **negative**, reinforces or
discourages the generated tokens). Defaults from an offline sweep (lr 5e-4, temp 0.5, group 6, 4 prompts/step —
higher lr/temp *collapses* it). Honest caveats in copy: needs a verifiable task + a competent-enough base
(cold-start) + many samples; we skip the KL penalty / value model. `sortTrainVecs()` (`tasks.ts`) supplies RL
prompts disjoint from `sortHeldOut`. `gen:jabber`/`gen:sonnets` build the older single-skill poem models.
Bundled-model facts in `src/data/modelStats.ts`.

The app is **eight pages** (each its own `main.tsx`): the live playground (`index.html`), a no-maths
"New to AI" explainer (`explain.html` → `src/explain/`), a guided "how a transformer works" walk
(`learn.html` → `src/learn/`), an interpretability lab (`lab.html` → `src/lab/`), a **tool use &
harness** demo (`harness.html` → `src/harness/`), and the **capstone** warehouse-agent
(`capstone.html` → `src/capstone/`), a **For teachers** reference (`teachers.html` →
`src/teachers/`), and the **embeddable demo shell** (`embed.html` → `src/embed/`); plus a generated
long-form guide (`GUIDE.md` → `public/guide.html`). All but `embed` share one nav component,
`src/components/SiteNav.tsx` (same destinations/order/labels, current page
marked; each page passes its `current` key + a subtitle child).

**`teachers.html` is the one page aimed at whoever is RUNNING the session** rather than the learner:
three session plans (15 min / 50 min / 2-3 hr), a per-page "the moment to point at" table, the embed
reference, live-delivery notes (preload models; a loaded page survives a dropped connection), an
"is this a real one?" section that answers both halves honestly, and MIT/credit. Its embed table is
**generated from `src/embed/demos.ts`**, so adding a demo updates the teacher docs automatically —
keep it that way. It is in `SiteNav`'s `LINKS` but deliberately **not** in its `ORDER`, so it never
becomes a learner's "Next →" step (a `MINUTES` entry is still required — the type demands one).

**`embed.html` is for lecturers/trainers/presenters** putting one demo into *their* site: `?demo=<id>`
selects it (`src/embed/demos.ts` — the pure, unit-tested registry; `EmbedApp.tsx` maps id → component),
and the frame carries **nothing but a JabberLM wordmark and the demo** — no nav, no teaching copy, no
footer, since the host page brings its own framing. `?scale=` (default 1.25, clamped 0.75–2.5) sets the
root font size for a projector, which works because the embedded demos are **rem-sized throughout** —
hence `TicTacToe`'s `showBlurb` prop (the embed drops the budget-lesson paragraph, keeps every control)
and its px→rem conversion, and why any demo added to the registry must avoid px literals (a canvas
`LineChart` gets its size from the computed root font size). The frame posts
`{type:'jabberlm:height'}` to the parent for auto-sizing — height only. `noindex`, and the `?demo=`
query makes each embed countable in analytics.

Five demos ship: `tictactoe`, `harness-tools` (harness §1), `agent-loop` (§3), `prompt-injection` (§4)
and `lora`. The last four declare a **fixed box** (`frame: {w,h}` in rem — content that appears as you
use them would otherwise reflow the host page mid-demo; the box scrolls if a narrow host squeezes it)
and a `font` (the harness page is sans, lab/capstone mono). Getting them out of their pages meant a
refactor worth knowing about: **`src/harness/demos.tsx`** now owns the three interactive harness demos
(`ToolCallDemo`/`AgentLoopDemo`/`InjectionDemo`, each with its own state, plus `Stage`, `InjTraceView`,
`INJ_*`, `loadHarnessModel`), and `HarnessApp` renders them inside its `Section` headings, intro prose
and `Callout`s — **the prose stays on the page, the demo is the shared part**. Same split via a flag in
`LoraSection({ embed })`: the embed drops `SectionIntro`, the two explanatory paragraphs and the
"see inside the overlay" `LoRAView`, keeping the controls, chart, comparison rows and try-your-own. The
harness demos take `autoRun` (embeds only — a frame with no prose must show the thing working on load;
the lesson page still waits for the reader to press Run).

The **capstone page** opens with a **playable tic-tac-toe agent** (`src/capstone/TicTacToe.tsx`): a ~130K
char model (`public/tictactoe-model.json`, `DATASET=tictactoe`/`gen:tictactoe`) you play against — a real
closed **agent loop** (you move → the harness feeds it the new board → it reads it and responds). Game rules +
minimax + the corpus live in **`src/data/tictactoe.ts`** (pure); the model emits a **cell index** and the
board is **index-labelled** (`0X1O2.…`) so a move is a *copy* of an empty cell's index, not a positional count
(which a tiny char model does badly). Training is **soft-target distillation from the minimax oracle**:
`moveTarget(b)` (tictactoe.ts) turns minimax's per-cell value into a soft policy (illegal→0, win→high,
block-preferred), and `Trainer.distillMoveStep` matches the model's move-position distribution to it via the new
`weightedSoftCE` op (masked soft-CE, grad-checked). This beats one-hot masked SFT (`sftMaskedStep`, also kept):
plain next-char SFT wastes gradient on the un-guessable board (move-loss flat ~0.44); one-hot masked SFT leaves
a near-**uniform** output (it barely discriminates); distillation concentrates it and teaches "never an occupied
cell" (not-lost vs random 66%→84%). Honest ceiling: a ~130K char model tops out low-50s% tactical (spatial
line-detection it can't fully represent — capacity didn't help); it diverges at lr 0.01 / overfits past ~2000
steps, so `gen:tictactoe` is lr 0.003 / STEPS 2000.

The capstone ships **two** ~130K models — same architecture, same size, same parameter count — to teach that
**training BUDGET, not parameter count, was the lever**. The **undertrained** `public/tictactoe-model.json` is
trained for just **100 steps** (`gen:tictactoe`, 1,600 examples ≈ a third of one pass over the 4,520 states) —
deliberately, so it is **genuinely weak**: **legal 40%**, optimal 24%, win 15%, block 18%, not-lost vs random 64%,
vs perfect 0%. Legal-40% is the point: its top pick is an already-occupied cell in ~60% of positions, so the
**harness check layer visibly fires** — a retry chain (`cell 8 ✗ taken → re-ask 8 ✗ → re-ask 4 ✓ — caught it`) on
most turns, and with the check OFF the game jams within a move or two. The earlier 2,000-step bundle (64% optimal,
**98% legal**) almost never tripped the guard, which made the check-layer demo hard to show. It is also the
interpretability specimen; the **well-trained** `public/tictactoe-strong-model.json`
(`DATASET=tictactoe-strong`/`gen:tictactoe-strong`) uses **shuffled exhaustive epochs** — every one of the ~4,520
reachable decision states once per pass, reshuffled each pass (which also trains all 8 D4-symmetric variants for
free, since they're distinct reachable states) — with a **sharpened target (T=0.1)** and a budget measured in
**epochs, not steps**.

Measured here, and cross-checked against the sibling `tictactoeLM` project (same 64/4/3/192 architecture, same
index-labelled encoding — its "A′"):
 • **The 64–68% ceiling every earlier checkpoint hit was undertraining, and nothing else** (their F-21). The old
   recipe was `STEPS=4000 BATCH=16` = 64,000 examples = **14 epochs**. All the movement happens *after* ~3,000
   steps, past where every previous run stopped. Our arm's curve: 67 → 68 → 75 → 77 → 83 → 94 → **98%** optimal.
 • **Steps are the wrong unit** when dataset size is the variable — that confound is what hid the undertraining
   (their F-15). `EPOCHS` now sets the step count; `deckSize` is always the *state* count so arms stay
   budget-matched whatever the deck weighting.
 • **Target temperature is a real limiter** (their F-08). T=0.4 leaves a **tied argmax in ~47% of states** — in
   nearly half the board space the target doesn't single out a move, so argmax accuracy is decided by noise.
 • **The old `trainingDeck` story was wrong.** A controlled arm (same seed, same budget, same T=0.1, differing
   *only* in the deck) **stalled**: loss flat over 1,000 steps, 29% optimal vs 67% for the uniform arm at the same
   step. `trainingDeck` is kept only for that comparison (`DECK=balanced`); it is no longer the shipped recipe.
   Its coverage argument was sound; the 6× tactical reweighting on top of a peaked target is what collapses it.
 • **Seeds vary a lot.** A second seed (2024) was still at 70% when seed 1337 hit 98% at the same step — so ship
   the arm you can point at, never an average (their F-27).

Result over ALL 4,520 states, shipped undertrained → shipped well-trained: optimal **23.9% → 97.9%** (3,439 →
**95** states wrong), legal 40→**~100%**, win 15→89%, block 18→92%, not-lost vs random 64→**100%**, vs perfect
0→94%, and losing lines in the exhaustive proof **455 → 9** (**0 as X**). (The 2,000-step bundle this replaced sat
between them at 64.1% optimal / 98% legal — that arm's numbers are the ones the training-budget findings below
were measured on.) Strength is measured by **`evalExhaustive(model, tok)`** (`tictactoe-agent.ts`) over all
~4,520 states (legal/optimal/win/block %, optimal-by-ply, + games vs random & vs perfect) and by
**`proveNeverLoses(pick)` / `neverLosesProof(model, tok)`** — an *exhaustive* never-loses proof: the policy is
deterministic, so the tree branches only where the OPPONENT chooses, and every legal opponent sequence is
enumerated as X and as O. `npm run eval:tictactoe` prints both for any bundle.
**Read the two together, and read the caveats.** (a) The proof only visits states the policy's own play steers
into — **13.6%** of the space here — so it is a *necessary condition*, not all-state competence (their F-05).
(b) Accuracy counts *how many* states are wrong; the proof depends on *which*: this model is 97.9% correct and
still walks into 9 losing lines as O (their F-22). Both statements are true at once, and that dissociation is a
better teaching artifact than a clean pass. The proof is **anchored** in
`src/capstone/__tests__/tictactoe-agent.test.ts` — a perfect minimax policy must score 0 losing lines and a
threat-ignoring one must score some, or the metric is vacuous (their F-09/F-10/F-24: three metrics were specified
above what perfect play can reach, each caught only by scoring perfect play first). `TicTacToe.tsx`
has an **undertrained / well-trained / your live model** toggle (loads both bundles) with copy spelling out the
data-design lesson (and that the well-trained model rarely trips the harness — a better model needs the guard
less). **We do NOT put game intelligence in the harness** — it only
checks legality. `agentTurn(model, tok, board, {validate}, rng)` (`src/capstone/tictactoe-agent.ts`): the model
emits its raw (unmasked) move; if illegal and the check is ON, the harness rejects it and **re-asks** the model
(re-sample), shown as a retry chain, else best-legal fallback; OFF, the illegal move sticks (the game breaks) —
the check-layer lesson. An always-on **loop trace** narrates observe→act→check→apply every turn; `analyzeMove`
surfaces took-win/blocked/**missed-block** reasoning.

The capstone's payoff is **"play the agent, then look inside it"** — the Part-III interpretability tools on the
Part-IV agent, board-aware (`src/capstone/Inspector.tsx` + `AttentionBoard`/`AblationBoard`/`SaeBoard`). Reuses
`Model.forward(collect=true)` (attention per head), `ablate` (keys `"l.h"`), and `src/interp/sae.ts`. Key
mapping: cell `c`'s tokens sit at prompt positions `5+2c` (index) and `6+2c` (mark), so a head's attention at the
move-decision position projects onto the 3×3 board. The Inspector has a **weak/strong selector** (loads both
bundles) and a live **threat-focus comparison**: `threatFocus(model, tok, board, threat)` (AttentionBoard.tsx) =
the strongest head's attention on your threat cell — the **well-trained model scores far higher** (mean **0.199 →
0.785** over the 1,484 must-block boards: opponent threatens, we have no win of our own), the mechanistic reason
it blocks more (18% → 92%). Re-measure with **`scripts/measure-threat-focus.ts`** after any retrain of either
bundle — these are properties of the *shipped weights*, not of the recipe. That contrast is the payoff: same size, same
architecture, longer training → the heads learn to **attend to what's at risk**. AttentionBoard's copy is
data-driven (adapts to the selected model's measured focus). Other findings (real): heads are **specialised
per-cell readers**; ablating the **critical head** crashes tactical play — the injury demo on the game. SAE is a
graceful stretch (rough features at this size, links to the lab). Each panel deep-links its
lab counterpart. The page then continues with the warehouse demo and closes with an "output → input" callout and
a "whole book in one page" recap.

Below the game, the **warehouse agent** is the relational demo. An order is a multiset of 1-3
SKUs (`A`-`F`); the agent emits `get <sku> [pad] pack<1|2>` per item then `done` (**abstracted moves** — the
harness animates the walk). Packing is **relational**: a fragile item pads iff a heavy item shares the
basket; a chemical goes in box 2 iff food shares it — so correct action needs attending across the whole
basket (the honest motivation for a transformer). Each SKU's attribute (fragile/heavy/food/chemical) is
**hidden** — never a token — so the model must infer it; the `ConceptMap` then shows the learned SKU
embeddings **cluster by that hidden attribute** (reuses `pca2` + `model.tokenEmbed`, like the learn-page
number line). The pure task lives in **`src/data/warehouse.ts`** (single source of truth: SKUs/attrs, grid +
greedy-nearest planner `expertTrace`/`planActions`, `warehouseReward` verifier, `parsePlan`, the 83-basket
space with a **rule-covering held-out split** guaranteeing each relational trigger is tested unseen,
`buildWarehouseCorpus`, 83-basket space; SFT expert lists items in prompt/sorted order so the plan is a
straight copy — a reordered tour makes the tiny model drop/conflate items; efficiency is left to RL);
model-using glue (`runBasket`, `heldOutStats`, `CAPSTONE_CFG`) is in
`src/capstone/agent.ts`. The page (`CapstoneApp.tsx`, `WarehouseGrid.tsx`, `ConceptMap.tsx`) is
**bundled-first** (`public/warehouse-model.json`, `DATASET=warehouse`/`gen:warehouse`, ~24K params, ctx 72)
and also trains a live **two-phase** model from scratch: **SFT** (`stepBatch`) to held-out competence, then
**RL** (`rlvrStep` with a correctness+efficiency `rlReward`) polishing wasted-tiles — the `RlvrSection`
phase-switch + `ConvergenceGate` (plateau on efficiency) auto-pause. Offline Phase-0: 2500 SFT steps →
held-out 0%→~90% (train ~98%), proving it learned the **rule** (generalises to unseen baskets), with the
train-vs-held efficiency gap the RL polish target. Honest caveats in copy (verifiable task, cold-start, RL is
a modest polish, tuned offline).

The **explain page** is a sequence of no-maths sections, several driven by **real precomputed data**
(shipped as JSON, fetched at runtime — mirror the model-fetch pattern) rather than the live model:
a **tokenization** demo (real GPT-4/tiktoken subword splits vs char-level — `public/bpe-examples.json`
+ `TokenizationDemo.tsx`, the "why big models miss the r's in *strawberry*" lesson); a **word-embeddings**
demo (a curated GloVe subset — `public/word-vectors.json` + `src/explain/embeddings.ts`'s
`cosine`/`nearest`/`analogy`/`embedText`, unit-tested) with nearest-neighbour search, live analogies
(king−man+woman≈queen) and a 2-D PCA map (`pca2` + `Scatter`); a **RAG** demo (`RagDemo.tsx`) doing exact
lookup + semantic retrieval over a tiny doc store, reusing those vectors; and a **quantisation** demo
(`src/interp/quantization.ts` — `quantiseModel` quantise→dequantises a throwaway `deserialize` copy,
weight matrices only, LayerNorm/biases stay fp32; `modelBytes` for the size axis) that sweeps 32→2 bits
and re-measures `sortAccuracy` (the curve holds, then falls off a cliff).

The harness page ships a third bundled model, `public/harness-model.json` (`DATASET=harness`,
`gen:harness`, ~88K params), trained on `buildHarnessCorpusFull()` — single-step
`instruction => tool(args) = result` calls **and** two-step `… => op1(a b c) = r1 => op2(r1) = r2 => done`
chains. Its corpus + JS tool registry live in **`src/data/harnessTasks.ts`** (the single source of truth
for both the training format and the runtime parser). The framework-agnostic harness
(`src/harness/runHarness.ts`) has `runHarness` (one call: generate → `parseToolCall` → dispatch to the
real JS `TOOLS`, output authoritative so it fixes the model's hallucinated arithmetic; parse errors are
surfaced not thrown) and `runAgent` (the **loop**: run the tool, feed the `= result =>` back into the
context, let the model read it and emit the next call, until `done`). `runAgentInjected` +
`sanitizeObservation` drive the **prompt-injection** demo (harness §4): an attacker-controlled tool
result is fed back into the loop and hijacks the model's next call (the loop can't tell data from
instructions); the mitigation treats tool output as untrusted **typed data** (digits only), which defeats
the tool-switch but not value-poisoning — so consequential actions still need authorisation.

The harness page closes with a **REASONING LOOP** (§5, `src/harness/AdderSection.tsx`) driven by a
fourth bundled model, `public/adder-model.json` (`DATASET=adder`/`gen:adder`, 90K params, ctx 96).
Where §1–§4 hand the arithmetic to a **JS tool**, here the **model does every single sum** and the
harness only holds the place — the same loop shape with the opposite division of labour. The pure
task is **`src/data/addition.ts`**: the primitive `add 8 1 0 => 9 0` (digit+digit+carry ⇒ digit,carry
— exactly 10×10×2 = **200 facts**, all of them trained, i.e. we teach it the addition table and the
*reasoning* is the loop), plus `sumLine` (single pass) and `traceLine` (the model's own working),
`columnsOf` (right-to-left digit slicing — pure string ops), `parseColumn`, and a BigInt `addOracle`.
`src/harness/runAdder.ts` runs the loop: a **fresh, constant 13-char prompt per column**, right to
left, keeping the model's carry as state.

**INVARIANT: the harness may remember and route, but must never compute.** `runAdderWith(solve, …)`
takes the column solver as a parameter precisely so tests can prove this — a solver wrong on one
column yields an answer wrong in exactly that digit; a solver that always says `0 0` yields zeros.
If the harness were secretly adding, those tests would pass wrongly. Same rule as the tic-tac-toe
check layer.

Measured on the shipped file (`scripts/` has a `verify` pattern; see the eval line in `gen-model.ts`):
columns **200/200**; single-pass **0%** at every width; harness **100%** at 4, 6, 10, 15 and **25**
digits. A model that cannot add two 4-digit numbers in one pass adds two 25-digit numbers perfectly
through the loop. Two honest notes in the copy: (a) the **self-trace fails** (~10% at 4 digits) —
to write its own working the model must find "the 3rd digit from the right", and positional counting
is the thing this architecture is worst at, so the harness supplies **addressing** as well as memory;
(b) loop accuracy is columns^n, so 99% per column is only ~86% over 15 digits — a chain amplifies
per-step error, which is why steps must be individually checkable.
`gen-model.ts` gained an opt-in **`LR_DECAY=1`** (cosine to `LR_MIN_FRAC`, default 0.05): a fixed LR
reached ~90% columns and then oscillated in a band; the decay closed it to 200/200. Other recipes are
untouched. NB **`scripts/` is not in the tsc project** (`tsconfig.app.json` includes only `src`), so
errors there surface only at runtime — `npm run build` does catch `src/`.

Datasets: `src/data/jabberwocky.ts` `TEXT_SAMPLES` is trimmed to **Jabber Poems / Sorting / Equations**
plus a **Custom** option (seeds all three combined, editable). The deterministic, browser-shippable task
corpora live in **`src/data/tasks.ts`** (`buildSortCorpus`, `buildEquationCorpus`, `maxLine`,
`reverseLine`, `buildMoeCorpus`, the per-task held-outs, and `moeTrainVectors`). Poem/sonnet text is in
`jabberPoems.ts` / `shakespeare.ts` (sonnets are offline-only via `gen:sonnets`, not in the dropdown).

## Architecture

- `src/engine/` is the framework-agnostic core — **never import React here.** Everything is built on
  the custom `Tensor` (flat `Float32Array` + reverse-mode autograd tape in `tensor.ts`). Each op in
  `ops.ts` installs a `_backward` closure; `Tensor.backward()` is a topo-sorted reverse walk.
- `Model.forward(ids, flags, positions?, collect?, capture?, steer?, ablate?, moeAblate?)` returns
  `{ logits, trace? }`. When `collect` is true it snapshots every intermediate into a `Trace`
  (`trace.ts`) that the inspector renders. `ablate` (keys `"layer.head"`) zeroes attention heads;
  `moeAblate` (keys `"layer.expert"`) removes MoE experts; `steer` clamps a direction into the residual.
- Feature flags (positional mode, causal mask, sliding window, KV cache, RoPE base, `moeTopK`) are
  passed **per-forward**, so they can change live without rebuilding. Structural dims (d_model, heads,
  layers, context, d_ff, `nExperts`) require a rebuild.
- **Mixture of Experts:** when `cfg.nExperts > 1`, each layer's MLP becomes E expert FFNs + a softmax
  gate. Training is **dense** (all experts, gate-weighted — the `scaleRows` op weights each expert's
  output by its gate column, fully differentiable); inference can go **sparse** top-k via
  `flags.moeTopK`. The gate is snapshotted into the `Trace`. `serialize`/`deserialize` and LoRA are
  format-stable (the params list is generic — new labels round-trip automatically).
- **Held-out split (`trainer.ts`):** when `validationFraction > 0`, the corpus is cut into ~20 blocks
  and every M-th block is held out — a **representative** sample across all sections (not the tail),
  with training windows constrained to train blocks (no leakage); a single-tail fallback covers tiny
  corpora. `heldOutRegions()` exposes the split.
- Training runs on the main thread via a cooperative `requestAnimationFrame` loop in
  `TrainingPanel.tsx` (a few `trainer.stepBatch()` calls per frame) so the UI stays live. The
  `Trainer` singleton (`trainer.ts`, `getTrainer`/`setTrainer`) is shared by both panels — Tensors
  live here, **not** in the zustand store. The store (`state/store.ts`) holds config + UI state only.
- The bundled model loads via `state/pretrained.ts` (`fetchBundledModel`/`installBundledModel` — the
  one place that installs it into engine + store); `TrainingPanel`'s mount effect calls it once (a
  module-level latch makes that StrictMode-safe). State, not engine, owns this — it touches the store.
- **Teaching surfaces default to the bundled model.** `explain`/`learn` use `loadDemoModel`
  (`src/explain/loadDemoModel.ts`) and the lab uses `autoLoadModel` (`src/lab/loadModel.ts`) — both
  **bundled-first** so a visitor's half-trained run can't shadow the demos (the lab has an opt-in
  "Inspect my last training run"). Lab sections that train live (`MoeSection`, `GrokSection`) build
  their **own** `Trainer` instances and never touch the `getTrainer` singleton.

## Conventions

- Add a new differentiable op in `ops.ts` with a forward + a `_backward` closure that **accumulates**
  (`+=`) into inputs' `.grad`. Then add a numerical gradient check in
  `src/engine/__tests__/grad.test.ts` — this is the correctness gate; keep it green.
- Visualizations read plain `Matrix` snapshots from the `Trace`, never live Tensors.
- **Deep links into a tab go in the query string, not a hash** — the lab routes through
  `lab.html?tab=<slug>` (`src/lab/tabRoute.ts`, pure + unit-tested; legacy `#slug` still resolves).
  Cloudflare Web Analytics' beacon reports `pathname + search` and patches `pushState`, so a `?tab=`
  switch is a countable pageview while a fragment is invisible. Hence: **push** (not `replaceState`) on a
  real switch, and push an **absolute** path (the beacon resolves a relative URL to the bare origin and
  would dedupe all 13 tabs to one). In-page anchors elsewhere still use hashes (`useHashScroll`).
- **Live-training lab sections auto-pause on convergence** via the shared `ConvergenceGate`
  (`src/lab/converged.ts`, unit-tested). Each section holds one in a ref, feeds its held-out
  "did it learn" checkpoint(s) into it on every eval (`gate.record(key, y)`), and in the rAF loop
  stops (`runningRef=false; setRunning(false)` + a `converged`/`cap` status note) once
  `gate.converged()` — plus a generous hard step backstop. Gate off the **learned** curve only:
  never a train curve (grokking's train hits 100% pre-grok) or a deliberately-collapsing one
  (forgetting's `oSft`). `threshold` mode (last N ≥ bar, default 5 ≥ 90) for the sort-style tasks;
  `plateau` mode (last N within ε) for Recovery, whose skill settles below baseline. `play`/`reset`
  call `gate.reset()`. The playground (`TrainingPanel.tsx`) is intentionally excluded — open-ended,
  loss-based, no default held-out accuracy.

## Commands

```bash
npm run dev          # vite dev server (also renders GUIDE.md -> public/guide.html)
npm run test         # vitest: gradient checks + model/trainer/persist
npm run build        # tsc -b && vite build (9 pages: index/explain/learn/lab/harness/capstone/
                     #                          teachers/embed/guide)
npm run gen:multitask # retrain the bundled three-skill model -> public/multitask-model.json
npm run gen:moe       # retrain the Mixture-of-Experts model  -> public/moe-model.json
npm run gen:harness   # retrain the tool-calling model        -> public/harness-model.json
npm run gen:sort      # retrain the sort-only model (recovery)-> public/sort-model.json
npm run gen:warehouse # retrain the capstone warehouse agent  -> public/warehouse-model.json
npm run gen:tictactoe # UNDERTRAINED tic-tac-toe agent — only 100 steps, weak ON PURPOSE (legal 40%, so the
                      # harness check-layer demo actually fires) -> public/tictactoe-model.json
npm run gen:tictactoe-strong # WELL-TRAINED tic-tac-toe agent (250 epochs, T=0.1) -> public/tictactoe-strong-model.json
                             # knobs: EPOCHS (not STEPS) · DECK=uniform|balanced|sample · TARGET_T · SEED · WD · FILE
npm run eval:tictactoe       # exhaustive strength report + never-loses proof for both bundles
# scripts/measure-threat-focus.ts  # mean attention on your threat cell, both bundles (run after any retrain)
npm run gen:adder    # reasoning-loop adder (columns + whole sums + traces) -> public/adder-model.json
                     # knobs: COL_REPEATS · LR_DECAY=1 (cosine) · LR_MIN_FRAC
npm run gen:multitask-draft # tiny draft for speculative decoding -> public/multitask-draft.json
npm run gen:jabber   # older single-skill poem model -> public/jabber-model.json (gen:sonnets for the variant)
```
