# CLAUDE.md

Guidance for working in this repo.

## What this is

JabberLM — a browser-only, educational decoder-only transformer. It trains in-browser on a short
text (default *Jabberwocky*) with a char-level tokenizer and exposes every internal (Q/K/V,
attention, gradients, logits) for inspection. The point is **inspectability**: prefer clear,
traceable math over cleverness or speed. The model is tiny, so plain-JS forward/backward is fine.

## Architecture

- `src/engine/` is the framework-agnostic core — **never import React here.** Everything is built on
  the custom `Tensor` (flat `Float32Array` + reverse-mode autograd tape in `tensor.ts`). Each op in
  `ops.ts` installs a `_backward` closure; `Tensor.backward()` is a topo-sorted reverse walk.
- `Model.forward(ids, flags, positions?, collect?)` returns `{ logits, trace? }`. When `collect` is
  true it snapshots every intermediate into a `Trace` (`trace.ts`) that the inspector renders.
- Feature flags (positional mode, causal mask, sliding window, KV cache, RoPE base) are passed
  **per-forward**, so they can change live without rebuilding. Structural dims (d_model, heads,
  layers, context, d_ff) require a rebuild.
- Training runs on the main thread via a cooperative `requestAnimationFrame` loop in
  `TrainingPanel.tsx` (a few `trainer.stepBatch()` calls per frame) so the UI stays live. The
  `Trainer` singleton (`trainer.ts`, `getTrainer`/`setTrainer`) is shared by both panels — Tensors
  live here, **not** in the zustand store. The store (`state/store.ts`) holds config + UI state only.

## Conventions

- Add a new differentiable op in `ops.ts` with a forward + a `_backward` closure that **accumulates**
  (`+=`) into inputs' `.grad`. Then add a numerical gradient check in
  `src/engine/__tests__/grad.test.ts` — this is the correctness gate; keep it green.
- Visualizations read plain `Matrix` snapshots from the `Trace`, never live Tensors.

## Commands

```bash
npm run dev     # vite dev server
npm run test    # vitest: gradient checks + model/trainer/persist
npm run build   # tsc -b && vite build
```
