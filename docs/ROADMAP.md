# JabberLM Roadmap — a layered learning site

Status: planning draft. This is a strategy/roadmap document, not an implementation spec. It maps the
product to three audiences, lays out the new "reasoning" workstream, and sets a performance and
usability strategy. Items are sized roughly; "experiment" items need a measurement pass before build.

### Build progress (Phase 1 — grokking — DONE)
- **Validated** (measured): a tiny (~16K-param) model groks SORTING to ~95% held-out in **~1.5 min /
  1500 steps**; the 9 digit-token embeddings arrange into an ordered **number line** (PCA), and they
  organise *before* the accuracy jump. (Algebra still never groks — the hallucination lesson.)
- **Built:** `src/data/tasks.ts` (deterministic sort/equation corpora + held-out set), `src/interp/pca.ts`
  (from-scratch top-2 PCA, tested), `src/viz/Scatter.tsx`, the dataset dropdown trimmed to the
  **Poems / Sorting / Equations** curriculum (`src/data/jabberwocky.ts`), and a **live grok view** in
  `TrainingPanel.tsx` (held-out sort-accuracy curve + the digit number-line, recomputed every 150 steps,
  shown when training on Sorting) with an "predict first" prompt.
- **Still to do (later phases):** entry tiles + guided tours; performance defaults (adaptive throttle,
  gate `largest` on mobile); business cost/latency suite; advanced curation. See the relevant sections.

### Decisions locked (v2)
- Entry: **activity tiles** (Explore / Train / Advanced) + a prominent "New to AI? 2-min overview"
  (recommended novice default); "Walk me through" is the default for beginners.
- Datasets: the **Poems / Sorting / Equations** curriculum (memorise / generalise-groks / hallucinate),
  + custom. Single-Jabberwocky and Sonnets dropped from the dropdown.
- "Reasoning" reframed honestly: **sorting = real generalisation**, **algebra = hallucination**.
- Grokking viz: from-scratch **PCA** "number line", not UMAP.

## Vision

One through-line — **a language model predicts the next token** — explored at three depths. Every
audience meets the same real, in-browser, open-weights model; they differ only in how much of the
machinery we expose and how much maths we ask of them. Nothing is a mock-up: every number is the
model's own.

## The three tracks (and how they map to what exists)

The repo already ships three pages (`vite` inputs: `index.html`, `explain.html`, `lab.html`). We
formalise them as **tracks** with a shared identity, a "choose your level" entry, and per-track tours.

### Track 1 — Business / no prior idea  → `explain.html` (extend)
Goal: intuition + judgement, **no maths**. Today it has next-token, randomness, context,
hallucination, costs, governance demos. Add:
- **a) Predict the next token** — already strong (`NextTokenDemo`). Keep as the anchor concept.
- **b) Reasoning** — a new demo driven by a small model trained on **algebra with shown working**
  (chain-of-thought): pick an equation, watch it produce the steps then the answer token-by-token,
  then watch it **fail** on an out-of-range number. Lesson: "reasoning" here is a *learned procedure*
  that shows its working — powerful, but pattern-completion with limits (ties into the existing
  hallucination/governance narrative). See the Reasoning workstream below.
- **c) Costs, trade-offs, performance** — extend `CostsDemo`/`cost.ts` into a small suite:
  - **Token cost calculator** (user-set $ / 1M tokens × in/out tokens) — conceptual, never stale.
  - **Model trade-offs**: tiny vs default vs largest — measured **live in-browser** tokens/sec, plus
    size and quality, as a "race". Reuses the existing presets.
  - **Latency literacy**: measure real in-browser **time-to-first-token** vs total generation time and
    explain TTFT vs throughput, and how model size moves them.
  - **Open weights / self-hosting hook**: "this whole page is an open-weights model self-hosted in
    your browser — no API, no server." True, and a strong differentiator to anchor the cost story.

### Track 2 — Technical fundamentals → `index.html` (today's main app)
Goal: the real mechanics — tokenisation, embeddings, attention, residual stream, MLP, logits,
training (loss, gradients, overfitting), positional schemes, KV cache, sliding window. This is the
current playground and largely done. Work here is **polish + a guided tour** (below) and the
performance defaults (below), not new concepts.

### Track 3 — Advanced → `lab.html` + advanced features in the main app
Goal: go beyond the basics. Already has the interpretability lab (heads, neurons, SAE, steering) and
now **LoRA fine-tuning** in the main app. Add/curate:
- Reasoning **from scratch**: the algebra model as a first-class advanced demo (train it, inspect how
  it represents digits/steps, watch generalisation break).
- LoRA (done) — keep refining the overlay/inspector.
- Candidate future topics: quantisation (show int8 weights vs float, quality/size trade-off),
  speculative decoding / KV-cache economics, simple RLHF/preference framing, tokeniser comparison.

### Entry & navigation
- Extend the existing welcome modal into a **"choose your level"** with three cards (Business /
  Fundamentals / Advanced) → routes to the right page and offers that track's tour. Persist the
  choice (localStorage), allow switching from a shared header. Keep three pages (good for
  code-splitting, SEO, analytics) but unify visual identity and cross-links.

## Reasoning workstream (algebra → induced "reasoning")

The headline new capability. **Open question the user asked: what is the smallest model that can demo
this?** We measured it — see "Experiment results" below. The short version: a tiny char model does
**not** learn equation arithmetic, and that failure is itself the best demo.

### Experiment results (measured 2026-06-24)
Trained the existing small presets on a mixed corpus (Jabber poems + single-variable algebra with
chain-of-thought), across six configurations: `tiny` (17k) / `default` (91k) / `bigger` (208k);
division task `ax+b=c` and coefficient-1 task `x+b=c`; tested both generalisation (held-out numbers)
and pure memorisation; 2.5k–8k steps.
- **Result: equation-solving accuracy stayed at chance (~0–15%) in every config** — including train-set
  (memorisation) accuracy. The models learn the *format* and emit fluent, **confidently-wrong** working
  (e.g. `9x + 5 = 50 => 7x = 41 => x = 7`). Poems still generate fine in the same model.
- `tiny` drove *training loss* down to ~1.0 while solving 0% — it memorised the surface, not the
  operation. The binding problem is **arithmetic** (subtraction/division of multi-digit numbers), which
  these sizes don't learn in this budget.
- Implication: **reliable arithmetic reasoning is not a quick tiny-model demo.** It would need a much
  bigger/longer-trained dedicated model (uncertain, and slow in-browser — fights the perf goals) or a
  different task.

### RECOMMENDED: one "three-skill" model (validated 2026-06-24)
A single tiny model trained on **three** mixed corpora, so it shows three things side by side:
1. **Poems** → text generation (the existing Jabber style).
2. **Algebra (`ax+b=c` with worked steps)** → fluent but **confidently-wrong** working = the
   hallucination lesson.
3. **Sorting (`sort 6 9 2 => 2 6 9`, digits 1–9, length 3)** → a **genuinely learned, generalising
   procedure** = "some real reasoning".

**Measured results** (poems + algebra + sorting in one model, single corpus, 3000 steps):
- **Sorting held-out exact-match: `default` 78%, `tiny` 69%** — generalises to unseen vectors (not
  memorisation), with a visible **grokking** jump (~0% until ~step 2000, then leaps). Would reach ~90%+
  with ~2–3× more steps. Errors are instructive (it stumbles on repeated digits, e.g. `6 4 4 → 4 5 6`).
- **Algebra stays confidently wrong** (`7x+4=25 => 2x=16 => x=3`) — exactly the intended hallucination.
- **Poems still generate** in the same model.
- **Smallest model: even `tiny` (17k params) does all three.** `default` (91k) is better and still
  tiny/fast (mobile-friendly). For a polished bundle, train `default` ~2–3× longer to push sorting → 90%+.

**Why this is the right call:** it delivers all three teaching beats in one inspectable model —
generation, the #1 real-world risk (confident hallucination), and a real learned procedure — and the
multi-skill mix is exactly what makes **head-specialisation** meaningful (poem-mode vs digit/algebra-mode
vs sort-mode heads), feeding the Advanced/interpretability track. It needs no model breakthrough and
stays at the tiny sizes the perf strategy wants.

**Build (on approval):**
- New `scripts/gen-model.ts` dataset (`DATASET=multitask`) emitting poems + algebra(CoT) + sorting,
  trained longer to stabilise sorting; bundle `multitask-model.json` (reuse the offline-train +
  checkpoint infra, like `jabber-model.json`).
- Demos: a **sorting** demo (watch it sort + the grokking story), the **confident-arithmetic** demo
  (business-track hallucination), poems as before; plus a lab probe for **which heads fire on
  sort vs algebra vs poem context**.
- Framing: show sorting *working* and arithmetic *failing* in the same model — the contrast is the lesson.

### Original approach (kept for reference / the optional spike)

### Original approach (kept for reference / the optional spike)

### Approach
- **Synthetic corpus, char-level, with chain-of-thought ("scratchpad")** so the model learns to *show
  working*, which is both more convincing and more inspectable than answer-only.
  - Single-variable linear: `2x + 5 = 11 => 2x = 6 => x = 3`
  - Two-equation simultaneous: `3x + 2y = 16 ; x + y = 6 => x = 4 ; y = 2` (with elimination steps).
  - **Bound difficulty for tractability**: small integer coefficients (1–9), integer solutions in a
    small range (e.g. 0–9 or −9..9). The point is a convincing in-distribution demo, not a general
    solver. Vocabulary stays tiny (digits, `+ - * = ; x y`, space, newline).
- New generator `scripts/gen-model.ts` variant (or `DATASET=equations`) to emit the corpus + train,
  reusing the existing offline-train + checkpoint infrastructure. Pre-train and **bundle** the chosen
  model (like `jabber-model.json`), so the demo needs no in-browser training.

### Smallest-model experiment (do this first)
- Sweep presets × context length and measure **exact-match accuracy on held-out equations**:
  - configs ≈ {tiny (d24/L2), default (d48/L3), bigger (d64/L4)} × context {64, 128}.
  - The binding constraint is **context length** (CoT sequences are long) and depth (multi-step
    arithmetic), not vocab. Attention is O(T²), so context is the expensive knob — keep it as small as
    the scratchpad allows.
- **Hypothesis to test, not assume**: single-variable with CoT is likely learnable around the
  *default* preset (d48/L3) with context ~64–96; simultaneous equations likely wants ~d64/L3–4,
  context ~128. Pick the **smallest** config that hits ~90%+ in-distribution exact-match.
- Deliverable of the experiment: a recommended `reasoning` preset + a bundled pre-trained model + an
  eval number to quote ("solves N-step linear equations at X% in-distribution").
- **Framing guardrail**: prominently show it breaking out-of-distribution (bigger numbers, 3 vars) so
  business users don't over-generalise. This *is* the teaching point and aligns with Governance.

## Performance strategy (browser, mobile + laptop)

Observation (correct): **tiny/default are already enough** for the Jabber-poems / sonnets demos;
"largest" is slow to train live, especially on mobile. Principles:

- **Pre-bake the serious models offline** (jabber, sonnets, reasoning) and bundle them; in-browser
  training is for the *"watch it learn"* experience and should default to **tiny/default**.
- **Default smaller, gate bigger**: make `default` the default; mark `largest` as "slow — best on
  desktop", and consider hiding/disabling `largest` (live training) on small screens.
- **Adaptive `steps/frame`**: auto-throttle based on measured frame time so the UI stays ~60fps on
  whatever device; replaces the manual knob as the default.
- **Inference**: keep forward/generation on the main thread (cheap for small models); throttle
  `Generate ×N` with visible progress; the new auto-scroll already helps.
- **Web Worker for training — evaluate, don't assume**: moving training off-main-thread would smooth
  the UI and allow bigger models, but it conflicts with the current design where Tensors live in a
  main-thread singleton the inspector reads directly (CLAUDE.md). Options: (a) stay main-thread with
  smaller defaults + adaptive throttle (low effort, high payoff — do first); (b) a worker that trains
  and periodically posts weight/loss snapshots for inspection (bigger architectural change — only if
  we genuinely need larger live training). Recommend (a) now, (b) as a later spike.
- **Bundle budget**: each pre-trained model is ~1 MB gzipped; lazy-load per page so a track only pays
  for its model. Keep the reasoning model as small as the experiment allows.
- Define a **mobile performance target** (e.g. default preset generates ≥ X tokens/sec on a mid phone)
  and test against it.

## Guided walkthroughs ("WalkMe"-style)

Today's `Walkthrough.tsx` is a *content* narration of one forward/backward pass — keep it as a deep
dive. We additionally need a **DOM-anchored product tour** (spotlight + tooltip + Next/Back/Skip):

- Build a small in-house `Tour` system (steps = `{ anchor: data-tour-id, title, body, placement }`,
  spotlight overlay, progress saved in localStorage) — ~150 lines, no new dependency (matches the
  no-deps ethos). Anchor via `data-tour` attributes on key elements.
- **One tour per track**: Business (explain demos), Fundamentals (sidebar → Play → inference tabs →
  step-through), Advanced (LoRA card → overlay toggle → LoRA tab; reasoning; lab links).
- Trigger from the "choose your level" entry ("Take the tour") and a persistent "Guide me" button.
- Make tours **resumable and skippable**; never force them.

## Usability — mobile & laptop

- Build on the recent responsive work (the app/lab are already responsive; sidebar is a drawer on
  mobile). Stress-test the **new** surfaces (LoRA card, reasoning demo, cost suite) on a 390px width.
- Inspector heatmaps need graceful mobile handling (horizontal scroll / pinch, or a compact mode);
  consider a **values-table fallback** that doubles as accessibility.
- Touch targets, font scaling, and a possible **simplified mobile layout** for the business track.

## Cross-cutting — "what else to consider"

- **Narrative coherence**: keep next-token prediction as the spine; each track deepens the same idea.
- **Don't over-claim "reasoning"**: frame as learned procedure with limits; show failure modes.
- **Analytics**: per-track entry + tour-completion + demo-interaction events (Cloudflare Web Analytics
  is already in use) to learn what actually teaches.
- **Accessibility**: keyboard nav, colour-contrast on heatmaps, ARIA/labels, and a numeric fallback
  for canvas visualisations. Important for a *learning* site.
- **Deep links / shareability**: URL params to land on a specific demo or tour step
  (`?track=business&demo=reasoning`), so a teacher can link straight to it.
- **Progress/state persistence**: chosen track, completed tours, last model — localStorage; plus an
  obvious "reset / clear storage" affordance for demos that wedge.
- **Content staleness**: keep cost numbers conceptual or user-set (calculator), and date any sourced
  figures.
- **Testing/eval burden**: keep the numerical grad-check gate; add an **eval harness** for the
  reasoning model (exact-match accuracy); note that visual/responsive checks still need a browser
  (no browser-automation tooling in the current dev environment — those passes are manual/local).
- **Pedagogical sequencing**: a suggested path within each track (and a "what next" hand-off between
  tracks).
- **Trust & safety framing**: the existing Governance content should explicitly cover the reasoning
  demo's limits.

## Suggested phasing

1. **Reasoning feasibility experiment** (measure smallest model; produce a bundled reasoning model +
   eval number). Unblocks Track 1b and Track 3 reasoning. *Do this first — it's the biggest unknown.*
2. **Performance defaults**: default to `default` preset, adaptive steps/frame, gate `largest` on
   mobile. Low effort, immediate UX win across all tracks.
3. **Business track build-out**: reasoning demo + cost/latency/trade-off suite + open-weights hook.
4. **Guided-tour system** + the three tours + "choose your level" entry.
5. **Mobile/usability hardening** of new surfaces; accessibility pass.
6. **Advanced track curation** (reasoning-from-scratch, refine LoRA, optional new topics).
7. (Optional spike) **Web Worker training** if we decide larger live training is worth it.

## Open decisions (need your call)
- Reasoning scope for v1: single-variable only, or include simultaneous equations? (Single-variable is
  a safer, smaller first demo; simultaneous is more impressive but needs a bigger model + longer CoT.)
- Tour system: build the ~150-line in-house tour, or accept one tiny dependency (e.g. a driver.js-like
  lib) for speed?
- Do we add a unified "choose your level" landing, or keep the current welcome modal and just add
  per-page tours?
- Web Worker training: worth the architectural complexity, or commit to "small live + pre-baked big"?
