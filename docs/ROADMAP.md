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
- **Distillation (lab).** Train a tiny student to copy a big teacher's output distribution
  (`softCrossEntropy` op + `Trainer.distillStep`); the ~6× smaller student reaches the teacher's ~95% and
  groks ~2–3× faster than the same student on hard labels. The compression lever behind cheap inference —
  completes the inference-economics arc. *(Beyond the original roadmap.)*
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
- **Embeddable demos for lecturers/trainers** — `embed.html?demo=<id>`, one demo per frame, no nav or
  copy, `?scale=` for a projector, auto-height postMessage (`src/embed/demos.ts`, README → Embedding,
  and the `/teachers` page, whose table is generated from the registry so it can't drift).
  **Shipped (5):** `tictactoe`, `harness-tools`, `agent-loop`, `prompt-injection`, `lora` — the last
  four in a fixed box so a host page can't reflow mid-demo.

  The pattern is now cheap to repeat: register the demo, render it without its page's framing, measure
  its expanded box in the browser, set `frame`/`font`. The cost is *not* the embed — it is how tangled
  the demo is with its page. Three shapes, in rising order of work:
  **(a) zero-arg component** (`TokenizationDemo()`, `EmbeddingsDemo()`, `GrokSection()`) — drop it in;
  **(b) needs a model** (`AblationSection({trainer})`) — wrap in a loader like `WithHarnessModel`;
  **(c) assembled inline in its page** (the warehouse agent, harness §5) — needs the same extraction
  the harness §1/§3/§4 demos got: interactive part into a shared component, prose stays on the page.

  **Next five, in this order:**
  1. `tokenizer` — explain's `TokenizationDemo`. Shape (a). Real GPT-4 subword splits vs char-level:
     the "why it can't count the r's in strawberry" lesson. No model to fetch, instant, fine on a
     phone — the strongest demo for a non-technical audience and the cheapest to ship.
  2. `embeddings` — explain's `EmbeddingsDemo`. Shape (a), fetches `word-vectors.json` (~200 KB).
     Nearest neighbours, king−man+woman≈queen, the 2-D map. The classic lecture moment.
  3. `adder` — harness §5 (`AdderSection`). Shape (c), small: it takes `n` and renders its own heading.
     The reasoning loop — a model that cannot add two 4-digit numbers in one pass adds two 25-digit
     numbers perfectly through the loop. The best single argument for harnesses on the site.
  4. `head-ablation` — lab's `AblationSection`. Shape (b), needs the lab's `autoLoadModel`. Break a
     head, watch a learned skill collapse. Instant payoff, no waiting — unlike the training demos.
  5. `warehouse` — the capstone's relational agent + `ConceptMap`. Shape (c), the most work here:
     `CapstoneApp` assembles grid + run + concept map inline. Pays for it by being the one demo that
     shows a model discovering a concept nobody labelled.

  **After that, roughly in value order** — `flaky-harness` (harness §2, pairs with `harness-tools`),
  `rag` and `quantisation` (both shape (a); the two questions corporate audiences always ask),
  `injury-recovery` and `grokking` (the best "watch it learn" moments, but each needs minutes of live
  training — workshop material, not a 5-minute slot; both auto-pause on convergence), then the rest of
  the lab (`sae`, `steering`, `moe`, `distillation`, `forgetting`, `rlvr`, `speculative`), which are
  all shape (a)/(b) and near-free once the earlier ones exist. The playground itself is the biggest
  prize and the most work — it needs a slimmed-down layout, not just a frame.
- **Mobile inspector fallback:** a values-table view of heatmaps (doubles as accessibility) beyond the
  current horizontal-scroll.
- **Analytics** on per-page entry, tour completion, and demo interaction (Cloudflare Web Analytics is in
  use) to learn what actually teaches. *Partly done:* lab tabs now route through `?tab=<slug>` with a
  `pushState`, which the beacon reports as a pageview (`src/lab/tabRoute.ts`, README → Deploy) — so the
  thirteen lab demos are measurable. Explain (10), capstone (7) and harness (5) sections still are not;
  the same `?section=` + `pushState` treatment on their scroll-spy would cover them.
- Apply the lab's 1-D **number-line / train-vs-held** treatment to the main-app grok view for
  consistency.
