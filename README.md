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

It's a **five-page teaching site**, so different readers can start where they're comfortable:

- **Playground** (`index.html`) — train live and inspect every internal (the main app).
- **New to AI** (`explain.html`) — a no-maths explainer of how these models answer, vary, cost, and go
  wrong, for people who *use* AI at work — with live demos of tokenization (real GPT-4 subword splits),
  word embeddings, retrieval (RAG), and quantisation.
- **How a transformer works** (`learn.html`) — a guided walk that follows one example through a real
  model: tokens → vectors → attention → next-character guess, then watch it grok.
- **Interpretability lab** (`lab.html`) — neurons, attention heads, head ablation, dictionary learning
  (SAE), activation steering, **Mixture of Experts**, and a live **advanced grokking** demo.
- **Tool use & a tiny harness** (`harness.html`) — a tiny model that doesn't compute answers but emits
  **tool calls**, which a small JS **harness** parses and runs. The model that hallucinates arithmetic
  elsewhere becomes always-right here, because the harness does the maths. It also demonstrates **prompt
  injection** — an attacker-controlled tool result hijacking the agent loop — and the mitigation.

There's also a generated long-form **guide** (`GUIDE.md` → `public/guide.html`).

## Why character-level, and why many poems?

Jabberwocky's invented words ("brillig", "slithy", "borogoves") would fragment badly under a normal
subword tokenizer. Character-level keeps the vocabulary tiny (a small vocabulary — 77 tokens for the
bundled model) and every token a single, human-readable character.

The corpus is the lesson. Train on **many** poems in the same style (*Jabber Poems*) and a tiny model
learns the *style* and **generalises** — which is what makes it feel like a small LLM. The training-text
dropdown is **Jabber Poems / Sorting / Equations / Custom** — where *Custom* seeds all three combined
(editable) so you can train one model on a multi-section corpus and watch a representative held-out split
(a sample from *each* section) rather than just the tail. (Single-poem and *Shakespeare's sonnets*
corpora still exist offline via `gen:sonnets`, for the older single-skill poem models.)

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

## The Mixture-of-Experts model

A second bundled model (`public/moe-model.json`, **~145K parameters**, `npm run gen:moe`) is an
**authentic token-level Mixture of Experts**: each layer's single MLP is replaced by **4 expert FFNs
plus a gate** that routes every token to them (attention is unchanged). It's trained on three tasks —
**sort / max / reverse** — and generalises to unseen inputs (95% / 100% / 100% held-out). It's trained
*dense* (all experts, gate-weighted — differentiable and gradient-checked) with an inference-time
top-k/sparse toggle for the efficiency story. The lab's **Mixture of Experts** tab loads it and shows
per-token gate heatmaps, expert specialisation, and expert ablation.

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
- **Interpretability lab** (`lab.html`) — reverse-engineer what the model learned, not just its outputs:
  - **Neurons** & **attention heads** — top-activating contexts and head roles (induction / previous-token).
  - **Head ablation** — knock out heads and watch which *skill* breaks (sorting lives in one layer, poems
    in another) — a hands-on look at specialisation and polysemanticity.
  - **Injury & recovery** — ablate the head sorting depends on (accuracy collapses), then **keep training
    with it off** and watch the skill recover as the model reroutes it through other heads; re-scan to see
    the critical head has *moved*. The mechanistic echo of neuroplasticity / recovery-of-function.
  - **Dictionary learning (SAE)** — train a sparse autoencoder in-browser and browse the cleaner features
    it finds (illustrated on clean sorting inputs).
  - **Steering** — add a feature/neuron direction into the residual stream and watch generation shift.
  - **Mixture of Experts** — per-token gate heatmaps, expert specialisation, expert ablation, and a
    dense↔top-1 routing toggle (on the bundled MoE model).
  - **Advanced grokking** — train a dense model live on sort + max + reverse at once; per-task correctness
    panels and a **memorise → generalise** chart (train accuracy leads, held-out lags then jumps — that's
    grokking).
  - **Distillation** — train a tiny **student** to copy a bigger **teacher**'s whole output distribution
    ("dark knowledge"); the ~6× smaller student reaches the teacher's accuracy, and learns faster than an
    identical student trained on plain labels. The compression lever behind cheap inference.
- **Plain-language pages** — `explain.html` (how AI answers / varies / costs / hallucinates, no maths) and
  `learn.html` (a guided walk through a real forward pass, then grokking).
- **Tool use / harness** (`harness.html`) — the agentic capstone: a tiny model is trained to emit
  `tool(args)` calls; a JS harness parses → dispatches to a real function → returns the result, and
  handles malformed calls. Completes the site's arc: **memorise → hallucinate → generalise → use tools**
  (the model that can't add now calls a calculator and is always right). It also **chains two calls** —
  the harness feeds the first tool's result back and the model issues a second call — a working
  **agent loop** (observe → act → act → done) in ~88k parameters.
- **Save / load** trained weights to your browser or a JSON file. The teaching pages default to the
  known-good bundled model; the lab can **Upload a JSON model** or **Inspect your last training run**.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also renders GUIDE.md → public/guide.html)
npm run test         # gradient checks + model/trainer/persistence tests
npm run build        # static bundle in dist/ (6 pages: index/explain/learn/lab/harness/guide)
npm run gen:multitask # (re)train the bundled three-skill model → public/multitask-model.json
npm run gen:moe      # (re)train the Mixture-of-Experts model  → public/moe-model.json
npm run gen:harness  # (re)train the tool-calling model        → public/harness-model.json
npm run gen:sort     # (re)train the sort-only model (recovery) → public/sort-model.json
```

## Deploy

It's a fully static site (no backend), six HTML pages, hosted on **Cloudflare Pages** at
[`jabberlm.com`](https://jabberlm.com). The bundled three-skill model (`multitask-model.json`, ~281 KB
gzipped) is fetched once on the teaching surfaces and cached; the MoE model (`moe-model.json`) and the
tool-calling model (`harness-model.json`) are each fetched only when their page/tab is opened.

**Analytics:** enabled via **Cloudflare Web Analytics** (free, cookieless — no consent banner, no code).
Turn it on in the Cloudflare dashboard → the Pages project → *Metrics / Web Analytics* → "Enable" (or
Web Analytics → Add a site → pick the Pages project). Cloudflare injects the beacon at the edge, so
there's nothing to add to the repo. It reports referrers (e.g. LinkedIn), top pages, and bounce.

The beacon only ever reports a URL, built from **`pathname + search`** — a `#fragment` is invisible to
it — so anything that happens *inside* a page (a tab, a section, a demo you ran) is unmeasurable by
default. The lab's thirteen demos are the exception: they route through **`lab.html?tab=<slug>`**
(`src/lab/tabRoute.ts`), and the beacon patches `history.pushState`, so switching tabs registers as its
own pageview and "which demo did anyone actually open?" becomes answerable. Two rules that module's
comments spell out, both read off the beacon source: **push** (a `replaceState` is not a navigation and
reports nothing) and push an **absolute** path (it resolves a relative URL to the bare origin, which
would collapse all thirteen tabs into one entry). Old `lab.html#slug` links still resolve. The other
in-page surfaces — explain/capstone/harness sections — remain invisible; same fix would apply.

**Social preview:** `og:image` is a raster **`public/og-image.png`** (1200×630) — LinkedIn and X don't
render SVG cards. Regenerate it with `python3 scripts/gen-og.py` if the branding changes, then re-scrape
the URL in the LinkedIn Post Inspector / X Card Validator to bust their cache.

## How it's built

```
src/engine/    # framework-agnostic core (no React)
  tensor.ts        reverse-mode autograd over flat Float32Array matrices
  ops.ts           matmul, softmax, layerNorm, gelu/relu, cross-entropy, slice/concat, loraDelta,
                   scaleRows (MoE gate weighting), …
  rope.ts          rotary position embedding (differentiable)
  attention.ts     multi-head causal attention w/ RoPE / sliding-window / masking
  model.ts         the decoder-only transformer (optional token-level MoE when nExperts > 1);
                   forward() returns logits + a full Trace
  optimizer.ts     SGD + AdamW with grad clipping and per-param norms
  trainer.ts       cooperative mini-batch loop; representative block-strided held-out split
  generate.ts      autoregressive sampling (temperature / top-k / top-p)
  persist.ts       save/load model weights
src/data/        # datasets: jabberPoems, shakespeare, jabberwocky (TEXT_SAMPLES), tasks.ts (sort/max/
                 # reverse/equations corpora + held-outs), harnessTasks.ts (tool-call corpus + registry),
                 # modelStats
src/interp/      # interpretability: activations, maxact, sae, heads, ablation, steering, pca
src/components/  # main-app UI: ConfigSidebar, TrainingPanel, InferencePanel, inspector/, features/
src/explain/     # "New to AI" page (explain.html)
src/learn/       # "how a transformer works" page (learn.html)
src/lab/         # interpretability lab: Neurons/Heads/Ablation/Recovery/SAE/Steering/MoE/Grok/Distill
src/harness/     # tool use & harness page (harness.html): runHarness.ts (parse→dispatch→robustness)
src/state/       # zustand store + bundled-model install (pretrained.ts)
src/viz/         # Canvas heatmap, line chart, bar chart, scatter, color scales
```

The engine's correctness is pinned by **numerical gradient checks** (analytic vs finite-difference)
for every op, plus end-to-end tests that the model overfits a short string, that the trainer drives
loss down on Jabberwocky, and that the held-out split samples across sections without leakage.

## License

[MIT](LICENSE) © Greg Dickason.
