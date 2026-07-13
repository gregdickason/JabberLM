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
~2–3× faster than an identical hard-label student. `gen:jabber`/`gen:sonnets` build the older
single-skill poem models. Bundled-model facts in `src/data/modelStats.ts`.

The app is **five pages** (each its own `main.tsx`): the live playground (`index.html`), a no-maths
"New to AI" explainer (`explain.html` → `src/explain/`), a guided "how a transformer works" walk
(`learn.html` → `src/learn/`), an interpretability lab (`lab.html` → `src/lab/`), and a **tool use &
harness** demo (`harness.html` → `src/harness/`); plus a generated long-form guide (`GUIDE.md` →
`public/guide.html`).

The harness page ships a third bundled model, `public/harness-model.json` (`DATASET=harness`,
`gen:harness`, ~88K params), trained on `buildHarnessCorpusFull()` — single-step
`instruction => tool(args) = result` calls **and** two-step `… => op1(a b c) = r1 => op2(r1) = r2 => done`
chains. Its corpus + JS tool registry live in **`src/data/harnessTasks.ts`** (the single source of truth
for both the training format and the runtime parser). The framework-agnostic harness
(`src/harness/runHarness.ts`) has `runHarness` (one call: generate → `parseToolCall` → dispatch to the
real JS `TOOLS`, output authoritative so it fixes the model's hallucinated arithmetic; parse errors are
surfaced not thrown) and `runAgent` (the **loop**: run the tool, feed the `= result =>` back into the
context, let the model read it and emit the next call, until `done`).

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

## Commands

```bash
npm run dev          # vite dev server (also renders GUIDE.md -> public/guide.html)
npm run test         # vitest: gradient checks + model/trainer/persist
npm run build        # tsc -b && vite build (emits 6 pages: index/explain/learn/lab/harness/guide)
npm run gen:multitask # retrain the bundled three-skill model -> public/multitask-model.json
npm run gen:moe       # retrain the Mixture-of-Experts model  -> public/moe-model.json
npm run gen:harness   # retrain the tool-calling model        -> public/harness-model.json
npm run gen:sort      # retrain the sort-only model (recovery)-> public/sort-model.json
npm run gen:jabber   # older single-skill poem model -> public/jabber-model.json (gen:sonnets for the variant)
```
