# JabberLM

A **browser-only, fully-inspectable decoder-only transformer** that demonstrates how transformer
language models work at every level (it's a *small* LM — not an LLM). It trains live in your browser
using a **character-level** tokenizer, and lets you inspect the real Q/K/V matrices, attention
weights, gradients, and logits as it learns and generates.

It **ships with a pre-trained model** (trained offline by the same engine on the *Jabber Poems* set —
*Jabberwocky* plus ~100 more original poems in the same invented style). That model loads
automatically on first visit, so you can generate text and explore the internals immediately, without
training anything first.

Everything is written from scratch in TypeScript: a tiny tensor + reverse-mode autograd engine, the
transformer, the optimizer, and the visualizations. Every number on screen is one you can trace back to the math.

## Why character-level, and why many poems?

Jabberwocky's invented words ("brillig", "slithy", "borogoves") would fragment badly under a normal
subword tokenizer. Character-level keeps the vocabulary tiny (~60 tokens) and every token a single,
human-readable character.

The corpus is the lesson. Train on **one** poem and a tiny model just **memorises** it (held-out
validation loss turns up almost immediately — overfitting). Train on **many** poems in the same style
(*Jabber Poems*) and the same tiny model learns the *style* and **generalises** — which is what makes
it feel like a small LLM. Both options are in the dropdown so you can see the contrast yourself; a
real-English contrast (*Shakespeare's sonnets*) is there too.

## The built-in model

The bundled model (`public/jabber-model.json`) is **~0.46M parameters** (the *largest* preset:
d_model 96, 4 heads, 4 layers, context 128). It was trained on ~90K characters of *Jabber Poems* for
**2,400 steps** to cross-entropy loss **~1.31** in **~87 minutes** of **single-threaded JavaScript**
(no GPU — the same engine that runs in the browser) on a MacBook Air (M4, 16 GB). Regenerate it any
time with `npm run gen:jabber` (or `npm run gen:sonnets` for the sonnets variant).

## Features

- **Live training panel** — play / pause / single-step, a falling loss curve, a live sample that
  drifts toward Jabberwocky-like text (or alternative text you paste), per-parameter gradient-norm bars, and a live weight heatmap.
  Edit the learning rate, optimizer (SGD / AdamW), batch size, and grad-clip mid-run.  Also step through a forward pass and back propagation.
- **Inference + inspector panel** — type a prompt, step one token at a time, and walk the full
  pipeline through tabs: `tokenize → embed → attention → residual → mlp → logits`. Hover any
  heatmap cell to read the exact value. Sample with temperature / top-k / top-p.
- **LoRA fine-tuning (in-browser)** — adapt the loaded model by training a tiny low-rank overlay
  (`ΔW = A·B`) on top of frozen base weights. Pick a built-in pack (or paste text), watch only the
  adapters train, inspect the `A` / `B` / `ΔW` heatmaps in the **LoRA** tab, and toggle the overlay
  on/off to compare base vs fine-tuned generation. Adapters save/load with the model.
- **Deep feature demos (live toggles)**:
  - **RoPE** — rotary position embedding visualized as rotation; spokes show each position's angle.
  - **KV cache** — the key/value cache as a grid, with reused-vs-recomputed status and the
    (~quadratic) compute saved.
  - **Sliding window** — recompute the attention mask live and see which tokens fall out of view.
- **Save / load** trained weights to your browser or to a JSON file, and **Load built-in model** to
  drop the bundled pre-trained model back in at any time.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also renders GUIDE.md → public/guide.html)
npm run test         # gradient checks + model/trainer/persistence tests
npm run build        # static production bundle in dist/ (no network calls)
npm run gen:jabber   # (re)train the bundled model → public/jabber-model.json
```

## Deploy

It's a fully static site (no backend), hosted on **Cloudflare Pages** at
[`jabberlm.com`](https://jabberlm.com). The app code is ~70 KB gzipped; the bundled pre-trained model
adds ~1 MB gzipped (`jabber-model.json`), fetched once and cached.

## How it's built

```
src/engine/    # framework-agnostic core (no React)
  tensor.ts        reverse-mode autograd over flat Float32Array matrices
  ops.ts           matmul, softmax, layerNorm, gelu/relu, cross-entropy, slice/concat, loraDelta, …
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
