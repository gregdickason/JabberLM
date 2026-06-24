# JabberLM

A **browser-only, fully-inspectable decoder-only transformer** that demonstrates how transformer
language models work at every level (it's a *small* LM — not an LLM). It trains live in your browser
using a **character-level** tokenizer, and lets you inspect the real Q/K/V matrices, attention
weights, gradients, and logits as it learns and generates.

It **ships with a pre-trained "three-skill" model** (trained offline by the same engine) that loads
automatically on first visit, so you can generate text and explore the internals immediately, without
training anything first. The one tiny model writes poems, **sorts** numbers (a genuinely learned
procedure), and **"solves"** equations (fluently, but with invented arithmetic) — a live lesson in
memorisation vs generalisation vs hallucination. See "The built-in model" below.

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

## The built-in "three-skill" model

The bundled model (`public/multitask-model.json`) is a single tiny network — the *default* preset,
**~90K parameters** (d_model 48, 3 heads, 3 layers, context 48) — trained on Jabber poems **+**
single-variable algebra **+** sorting. One model, three behaviours, which together teach the
difference between **memorisation, hallucination, and generalisation**:

- **Poems** → text generation (it memorised a style).
- **Algebra** (`7x + 2 = 16 => …`) → fluent but **confidently wrong** working — it can't actually learn
  the arithmetic at this size. The hallucination lesson, live.
- **Sorting** (`sort 6 9 2 => 2 6 9`) → a **genuinely learned procedure** that generalises to unseen
  inputs (**89%** held-out exact-match), and it emerges with a visible **grokking** jump partway
  through training. "Real" reasoning at 90K params.

It was trained for **6,000 steps** in **~30 minutes** of **single-threaded JavaScript** (no GPU — the
same engine that runs in the browser) on a MacBook Air (M4, 16 GB). Regenerate it with
`npm run gen:multitask` (or `npm run gen:jabber` / `npm run gen:sonnets` for the single-skill poem
models). The corpus builder lives in `scripts/multitask-corpus.ts`.

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
npm run gen:multitask # (re)train the bundled three-skill model → public/multitask-model.json
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
