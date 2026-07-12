# JabberLM Roadmap / Status

**Updated 2026-07-05.** This began as a planning draft; almost all of it has shipped, so it's now a
**status + future-ideas** document. See `README.md` for the current feature list and `CLAUDE.md` for the
architecture.

## Vision (unchanged)

One through-line — **a language model predicts the next token** — explored at several depths. Every
audience meets the same real, in-browser, open-weights model; they differ only in how much machinery we
expose and how much maths we ask of them. Nothing is a mock-up: every number is the model's own.

## Delivered

The site is now **five pages**, mapping the original three "tracks" plus a guided middle and an agentic
capstone:

- **Business / no maths — `explain.html`.** Next-token, randomness, context, hallucination, a
  cost/latency suite (token calculator + a live tiny-vs-default-vs-largest tokens/sec race + real
  in-browser TTFT), the open-weights/self-hosting hook, a parameter-scale comparison (JabberLM vs
  GPT-2 vs frontier), and governance.
- **How a transformer works — `learn.html` (new).** The missing middle: a guided, narrated walk that
  follows one example through a real model (tokenize → embed → attention → MLP → next-char), then the
  "how it learns" and "scale" acts. Reuses the real inspector views.
- **Technical fundamentals — `index.html`.** The live playground; entry tiles + a "walk me through"
  DOM tour; **live grokking** view when training on Sorting (held-out accuracy jump).
- **Advanced — `lab.html`.** Interpretability lab: neurons, attention heads, head ablation, dictionary
  learning (SAE, illustrated on sorting), steering, **Mixture of Experts**, and a live **advanced
  grokking** demo (dense model on sort+max+reverse, per-task correctness panels + a memorise→generalise
  chart). Plus in-browser **LoRA** in the main app.
- **Injury & recovery (lab).** Ablate the head sorting depends on (accuracy collapses), retrain with it
  permanently off → the skill recovers as the model reroutes it through other heads; a re-scan shows the
  critical head has moved. The mechanistic analogue of neuroplasticity / recovery-of-function. Backed by
  a feasibility experiment (injure 68→0%, recover to 75% in ~500 steps, critical head 0.0→0.1).
  *(Beyond the original roadmap.)*
- **Tool use & harness — `harness.html`.** The agentic capstone: a tiny model trained to emit
  `tool(args)` calls; a JS harness parses → dispatches to a real function → returns the result, and
  catches malformed calls. Completes the arc memorise→hallucinate→generalise→**use tools** (the model
  that can't add calls a calculator and is always right). Also **chains two calls** into a working
  **agent loop** (observe→act→act→done) — validated at ~100% on held-out numbers. *(Beyond the original
  roadmap.)*

Other delivered items from the original plan:

- **Three-skill bundled model** (`multitask-model.json`): poems (memorise) / algebra (hallucinate) /
  sorting (generalise-groks) — the reasoning question, resolved honestly (**sorting = real
  generalisation, algebra = hallucination**).
- **Mixture-of-Experts model** (`moe-model.json`) + the token-level MoE engine (`nExperts`, `scaleRows`,
  gate in the Trace, expert ablation, dense-train/top-k-infer). *(Beyond the original roadmap.)*
- **Entry tiles + guided tours** (in-house `Tour.tsx`, ~no deps) replacing the "choose your level" idea.
- **Performance defaults:** live-training presets trimmed to **tiny/default** (bigger/largest dropped —
  big models are shown via the pre-baked bundled models and the explain-page speed race); **adaptive
  steps/frame** throttle; teaching surfaces **default to the bundled model**.
- **From-scratch PCA number line**, the deterministic task corpora (`src/data/tasks.ts`),
  **Custom = all-three-combined** dataset, and a **representative (block-strided) held-out** split.
- Accessibility pass (ARIA labels on canvases), mobile responsiveness, and a11y/mobile hardening.

## Decisions resolved

- **Entry:** activity tiles + a recommended "New to AI" default and per-track tours — built.
- **Datasets:** Poems / Sorting / Equations + Custom(combined); single-poem and sonnets dropped from the
  dropdown (sonnets remain offline via `gen:sonnets`).
- **Grokking viz:** from-scratch PCA number line (main app) and, in the lab's advanced-grokking demo, a
  **train-vs-held-out** chart (the honest grokking signal) instead of the embedding number line.
- **Tour system:** in-house (~150 lines), no dependency.
- **Web-Worker training:** not pursued — stayed main-thread with small defaults + adaptive throttle
  (option (a)); the inspector reads live main-thread Tensors, so a worker would fight that design.

## Why sorting, not equations (kept for reference)

Measured (2026-06-24): tiny/default/bigger char models trained on single-variable algebra with worked
steps stayed at ~chance exact-match (even on the train set) — they learn the *format* and emit fluent,
**confidently-wrong** working. Arithmetic (multi-digit subtraction/division) doesn't fit these sizes.
**Sorting**, by contrast, groks to ~90%+ held-out. So "reasoning" is demonstrated by sorting (real,
generalising), and algebra is the hallucination lesson — the contrast is the teaching point.

## Possible future work (unbuilt)

- **Advanced-track topics:** quantisation (int8 vs float weights, size/quality trade-off), speculative
  decoding / KV-cache economics, tokenizer comparison, a simple RLHF/preference framing.
- **Web-Worker training spike** — only if larger live training becomes worth the architectural change.
- **Deep links / shareability** (`?page=…&demo=…` to land on a specific demo or tour step).
- **Mobile inspector fallback:** a values-table view of heatmaps (doubles as accessibility) beyond the
  current horizontal-scroll.
- **Analytics** on per-page entry, tour completion, and demo interaction (Cloudflare Web Analytics is in
  use) to learn what actually teaches.
- Apply the lab's 1-D **number-line / train-vs-held** treatment to the main-app grok view for
  consistency.
