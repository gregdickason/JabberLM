# JabberLM

A **browser-only, fully-inspectable decoder-only transformer** that demonstrates how transformer
language models work at every level (it's a *small* LM — not an LLM). It trains live in your browser on a short text
(default: Lewis Carroll's *Jabberwocky*) using a **character-level** tokenizer, and lets you inspect
the real Q/K/V matrices, attention weights, gradients, and logits as it learns and generates.

Everything is written from scratch in TypeScript: a tiny tensor + reverse-mode autograd engine, the
transformer, the optimizer, and the visualizations. Every number on screen is one you can trace back to the math.

## Why character-level + Jabberwocky?

Jabberwocky's invented words ("brillig", "slithy", "borogoves") would fragment badly under a normal
subword tokenizer. Character-level keeps the vocabulary tiny (~50 tokens) and every token a single,
human-readable character.

## Features

- **Live training panel** — play / pause / single-step, a falling loss curve, a live sample that
  drifts toward Jabberwocky-like text (or alternative text you paste), per-parameter gradient-norm bars, and a live weight heatmap.
  Edit the learning rate, optimizer (SGD / AdamW), batch size, and grad-clip mid-run.  Also step through a forward pass and back propagation.
- **Inference + inspector panel** — type a prompt, step one token at a time, and walk the full
  pipeline through tabs: `tokenize → embed → attention → residual → mlp → logits`. Hover any
  heatmap cell to read the exact value. Sample with temperature / top-k / top-p.
- **Deep feature demos (live toggles)**:
  - **RoPE** — rotary position embedding visualized as rotation; spokes show each position's angle.
  - **KV cache** — the key/value cache as a grid, with reused-vs-recomputed status and the
    (~quadratic) compute saved.
  - **Sliding window** — recompute the attention mask live and see which tokens fall out of view.
- **Save / load** trained weights to your browser or to a JSON file.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also renders GUIDE.md → public/guide.html)
npm run test     # gradient checks + model/trainer/persistence tests
npm run build    # static production bundle in dist/ (no network calls)
```

## Deploy

It's a fully static site (~70 KB gzipped, no backend), hosted on **Cloudflare Pages** at
[`jabberlm.com`](https://jabberlm.com).

## How it's built

```
src/engine/    # framework-agnostic core (no React)
  tensor.ts        reverse-mode autograd over flat Float32Array matrices
  ops.ts           matmul, softmax, layerNorm, gelu/relu, cross-entropy, slice/concat, …
  rope.ts          rotary position embedding (differentiable)
  attention.ts     multi-head causal attention w/ RoPE / sliding-window / masking
  model.ts         the decoder-only transformer; forward() returns logits + a full Trace
  optimizer.ts     SGD + AdamW with grad clipping and per-param norms
  trainer.ts       cooperative mini-batch training loop
  generate.ts      autoregressive sampling (temperature / top-k / top-p)
  persist.ts       save/load model weights
src/components/  # React UI: ConfigSidebar, TrainingPanel, InferencePanel, inspector/, features/
src/viz/         # Canvas heatmap, line chart, bar chart, color scales
```

The engine's correctness is pinned by **numerical gradient checks** (analytic vs finite-difference)
for every op, plus end-to-end tests that the model overfits a short string and that the trainer
drives loss down on Jabberwocky.
