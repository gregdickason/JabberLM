# JabberLM — Code & Site Review

**Reviewer:** Claude Opus 4.8 (1M context)
**Date:** 2026-07-16
**Scope:** documentation accuracy · usability for the site's purpose · code quality
**Method:** three parallel read-only passes (docs / code / usability), then each concrete claim
independently verified against the source before inclusion. False positives from the automated pass are
called out in §5 for transparency.

## Verdict

JabberLM is in strong shape. The engine holds to its stated ethos (inspectable, correct-by-gradient-check),
the site's learning arc is coherent, and the recent additions (embeddings/RAG, tokenization, quantisation,
prompt-injection, shared nav) are well-built and consistently styled. The issues below are **polish and
upkeep**, not structural problems. The single most worthwhile fix is bringing `CLAUDE.md` and `README.md`
back in sync with the last few sessions of work.

Priority summary:
- **P1 (do soon):** `CLAUDE.md` omits 5 shipped features; `README.md` says "four-page" (it's five) and
  "~60 tokens" (it's 77).
- **P2 (worth doing):** dedicated grad-checks for `concatCols`/`sliceCols` (attention path); nav-label vs
  page-title/splash wording mismatches; mobile nav touch targets.
- **P3 (nice-to-have):** demo empty/loading-state polish; a couple of naming nits; reading-page text size.

---

## 1. Documentation accuracy

### P1 — `README.md` factual errors
- **`README.md:17`** — "It's a **four-page teaching site**", then lists **five** pages (Playground, New to
  AI, How a transformer works, Interpretability lab, Tool use) plus the guide. `CLAUDE.md:32` correctly says
  "five pages". → change to "five-page".
- **`README.md:35`** — "the vocabulary tiny (**~60 tokens**)". The bundled model's `vocab` is **77**
  (`src/data/modelStats.ts:23`). Either say "~77" or soften to "a few dozen"; GUIDE.md's "~20–80" is fine.

### P1 — `CLAUDE.md` is missing the last few sessions of work
`CLAUDE.md` is the canonical project guide, but has **zero** mentions of five shipped features (verified by
grep):
- **Embeddings / RAG** — `public/word-vectors.json`, `src/explain/embeddings.ts`, `EmbeddingsDemo.tsx`,
  `RagDemo.tsx` (explain §6–§7).
- **Tokenization demo** — `public/bpe-examples.json`, `src/explain/TokenizationDemo.tsx` (explain §5).
- **Quantisation** — `src/interp/quantization.ts` + `QuantizationDemo.tsx` (explain §9).
- **Prompt injection** — `runAgentInjected` / `sanitizeObservation` in `src/harness/runHarness.ts`
  (harness §4).
- **Shared nav** — `src/components/SiteNav.tsx` (used by all five pages).

Add a short paragraph per feature to the relevant CLAUDE.md sections (they're the kind of "non-obvious
architecture" notes CLAUDE.md exists to hold). The README's model/feature sections also predate these.

### Verified accurate (no action)
- `book-outline.md` section references (`explain §5–§9`, `harness §4`) **match** the actual
  `ExplainApp.tsx` section numbers/titles after the renumber. Good.
- Bundled-model filenames and every `gen:*` script in `package.json` match CLAUDE.md's Commands section.
- The headline figures ("~90K params", "89% held-out sort") match `modelStats.ts` (`params: 90_336`,
  `sortAccuracy: 89`) and are now cited with a provenance note on the explain page.

---

## 2. Code quality

### Strengths (verified)
- **Engine discipline holds.** Every `_backward` in `ops.ts` accumulates with `+=`; no React import anywhere
  in `src/engine/`; no `any` types; no `Math.random()`/`Date.now()`/`TODO`/`FIXME` in scope.
- **The past `Math.min(...bigArray)` RangeError class is fixed everywhere** — `LineChart.tsx`, `Scatter.tsx`,
  `Heatmap.tsx` all compute min/max with single-pass loops (with comments explaining why).
- **The newest differentiable ops are grad-checked** — `softCrossEntropy` and `scaleRows` both appear in
  `grad.test.ts` (the correctness gate). New helpers (`quantization.ts`, `embeddings.ts`) have unit tests,
  and `sanitizeObservation` is tested.

### P2 — Gradient-check coverage gap for structural ops
`grad.test.ts` covers the math-heavy ops well, but several **structural** ops in `ops.ts` don't appear to
have a dedicated numerical check: `concatCols`, `sliceCols`, `addMaskConst`, `embeddingLookup`, `mulElem`,
`transpose`, `sub`, `addRow`. They may be exercised indirectly by model-level tests, but `concatCols` /
`sliceCols` sit on the **attention head split/merge path** — the highest-value place to add explicit checks,
since a scatter/gather gradient bug there would be silent. Recommend adding two small checks.

### P3 — Minor
- **`src/interp/quantization.ts:64`** — the accumulator variable is named `bits8` but holds *total bits*
  (later divided by 8). Rename to `totalBits` for readability.
- **`quantization.test.ts:55`** — the "at least one weight matrix changed" check reconstructs the original
  weights via `new Model(cfg, 1)` and compares to the quantised `m`. This is **correct** (the seed makes
  init deterministic, so the fresh model reproduces `m`'s pre-quantisation weights), but the intent reads
  more clearly if you snapshot a `clone()` before `quantiseModel` instead of re-deriving it. Optional.
- **No UI unit tests** for the demos or `SiteNav` — expected for presentational React; the logic they depend
  on (`embeddings.ts`, `quantization.ts`, `runHarness.ts`) is unit-tested, which is the right split.

---

## 3. Usability (for the site's teaching purpose)

### P2 — Nav labels vs page titles/splash wording diverge
The new shared nav is a real improvement (consistent, current-page marked). Remaining friction is **wording
consistency** across the three places a page is named:
- **Explain**: nav says "New to AI" · splash tile says "Use AI more intelligently ★" · `<title>` says "AI,
  explained simply". Three different framings of one page. Pick one primary label (the audience is
  "professionals who use AI at work", so "Use AI well" / "New to AI" — choose one and use it in the nav and
  splash).
- **Learn**: nav "How it works" vs page "How a transformer **actually** works" — fine, minor.
- **Harness**: nav "Tool use" vs page "Tool use **& a tiny harness**" (and it also covers agents +
  injection). "Tool use" undersells it; "Tools & agents" would set expectations better.

This is genuinely low-stakes now that the nav is consistent — it's wording, not structure.

### P2 — Mobile nav touch targets
`SiteNav.tsx` links use `px-1.5 py-0.5 text-xs` (~2px vertical padding, ~30px tall). Below the ~44px touch
target guideline. Bump vertical padding on small screens (e.g. `py-1 sm:py-0.5`) so phone taps are reliable.

### P3 — Demo empty/loading polish
- **`QuantizationDemo.tsx`** — on §9 the "▶ Quantise & measure" button is disabled until `sort-model.json`
  loads; the greyed button + "loading the model…" status is correct but a fast scroller might read it as
  broken. (The disabled-button *bug* from earlier — a ref that never re-rendered — is already fixed; this is
  just first-glance perception.) Fine to leave.
- **`EmbeddingsDemo.tsx`** — typing an out-of-vocabulary word shows "not in this small vocabulary — try
  another" but the neighbours grid/map area goes blank. A one-line placeholder ("pick a suggested word
  above") would avoid the empty gap.
- **`TokenizationDemo.tsx` / `RagDemo.tsx`** — load states are terse ("could not load…") with no retry.
  Acceptable for bundled static JSON that rarely fails.

### P3 — Reading-page text size on mobile
Status/act labels on explain/learn are `text-[11px]` (`ExplainApp.tsx:60`, `LearnApp.tsx:39`). Body copy was
lifted to `text-sm` this session (good); these small status lines are borderline on phones but not
blocking.

### Verified good (no action)
- Section numbering on all pages is **contiguous** (explain 1–10, learn 1–8, harness 1–4).
- Every page has a way back to the Playground (nav + brand link); no page-wide dead-ends.
- The 3-route splash is clear, the "Intro" reopen button works, and the incognito/private no-splash bug was
  fixed this session (`catch → true`).

---

## 4. Prioritised recommendations

1. **Sync the docs (P1).** Fix `README.md:17` (five pages) and `README.md:35` (77 vocab); add CLAUDE.md notes
   for embeddings/RAG, tokenization, quantisation, prompt-injection, and SiteNav. ~30 min, high value.
2. **Add grad checks for `concatCols` + `sliceCols` (P2).** Closes the one real correctness-gate gap on the
   attention path.
3. **Reconcile page wording (P2).** One canonical label per page across nav / splash / `<title>`.
4. **Mobile nav padding (P2).** `py-1 sm:py-0.5` on the nav links.
5. **Small polish (P3):** `bits8`→`totalBits`; EmbeddingsDemo OOV placeholder; optional quant-test clone.

---

## 5. Corrections to the automated review pass (transparency)

Two findings from the initial automated sweep were **investigated and rejected**:
- *"Quantisation test compares different random models and passes by luck"* — **false.** `new Model(cfg, 1)`
  is seeded; it deterministically reproduces the pre-quantisation weights, so the comparison is valid. Kept
  only as an optional readability nit (§2).
- *"Playground nav is missing the subtitle every other page has"* — **false.** The playground renders
  "a transformer you can see inside · by Greg Dickason" as a SiteNav child (`src/App.tsx:176`, `md:inline`).

Everything else in this document was confirmed against the source.
