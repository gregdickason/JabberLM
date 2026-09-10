# JabberLM as a teaching aid — evaluation (9 Sept 2026)

> **Status: acted on.** The build of 10 Sept 2026 closed most of what follows. Tier 1 and Tier 2
> are done, plus the stats module, deep links, prefill, seven new embeds, and the glossary and
> series pages. What remains is listed at the end of `docs/BUILD-DECISIONS.md`. This document is
> kept as the record of what was wrong and why, not as a live to-do list.

Scope: every page's user-facing copy was read from source (`src/**`), cross-checked against
`GUIDE.md`, `README.md`, `src/data/modelStats.ts`, `docs/book-outline.md`, `docs/ROADMAP.md` and the
live site's HTML. Three questions: does it teach a **non-technical** reader, does it teach a
**developer / product manager** who has never studied transformers, and can it serve as the
**companion to a book published as short blog posts with embedded demos**.

Short verdict: the site is unusually honest and unusually deep, and its bones are right. Its weaknesses
are in the connective tissue: terms used before they are defined, a handful of stale or wrong sentences,
reading-time labels that are half the real figure, no glossary, no plain explanation of how a
"predict the next character" machine becomes a chat assistant, and companion infrastructure (deep links,
prefill, per-post embeds, a stats module for all nine models) that exists for a third of the site.

---

## 1. Non-technical audience (managers, teachers, journalists — no maths)

**What works**

- The root URL's welcome modal routes them correctly: "New to AI" is starred and first.
- The explain page has a real arc: *what it does → why outputs vary → what it can see → why it lies →
  how it reads / represents / can be grounded → what it costs → what to ask*. Every section ends with a
  "What this means for your work" callout, and those callouts are the best copy on the site
  ("set a low temperature, record the model version, and keep the output").
- Three demos need no model and land instantly on a phone: the tokenizer (strawberry), the word map, and
  RAG. These are the strongest non-technical demos and are already embeds.
- The tic-tac-toe game is a genuine universal way in, and the loop trace ("harness → agent: here's the
  board … agent → harness: 'play cell 8' … harness checks: cell 8 ✗ taken → re-ask") is readable by anyone.

**Where it loses them**

- **Terms before definitions.** The explain page uses *sampling*, *vector*, *weights*, *KV cache*,
  *keys and values*, *prefill/decode*, *32 bits*, *open-weights*, *system prompt*, *fine-tuned / distilled /
  routing / Mixture-of-Experts* without defining them, mostly in §6–§9. §9 alone names five techniques in
  one box. The decision-maker banner promises "what these systems cost" and then assumes the reader knows
  what prefill is.
- **The chat gap.** Every demo is text continuation (`the contract states that …`). A reader who has only
  met ChatGPT is never told that a chat turn is a prompt, that the whole conversation is re-sent each turn,
  or that "answers my question rather than continuing my sentence" is a *trained-in* behaviour
  (instruction tuning). Nothing on the site explains it. This is the single largest conceptual hole for
  this audience and it undercuts the context-window and cost sections, which only make sense once you know
  the history is re-sent.
- **No "what is training data / what did it read / when".** "Trained on a large slice of the internet" is
  the whole treatment. Data cutoff is never mentioned.
- **Predict-first is rare.** Only the hallucination section (explain §4) has one, and it asks about
  algebra while the demo below runs a contract sentence. The tour's grokking step answers its own question
  in the next sentence.
- **Reading time.** "10 min" in the nav; the explain page is 3,000–3,500 words plus 14 widgets. Realistic
  is 20–30 min. The capstone is labelled 10 min and is 20–30. There is no "you can stop here" cue at the
  end of explain's basics.
- **The capstone never says what the model was told.** Before the game starts, nothing says it only
  predicts characters, was never given the rules or the legal cells, and copies a cell index. The teachers
  lesson has exactly this paragraph because the page lacks it. "Harness caught an illegal move" is not a
  result to someone who assumes the model knows the rules.
- **No glossary anywhere on the site**, and the same idea is called *piece / character / token /
  word-piece / chunk* across one page, *held-out / unseen / validation / val* across two.

**Wrong or stale sentences a lay reader would trust**

- explain §4: "this tiny model (which only ever saw one poem)" — it saw 50 poems, algebra and sorting.
- explain §9: "both reach ~95% on unseen lists" — the generalist is 89% (`modelStats`). Same page, hero
  says 89%. "(see the training-cost story)" points at a section that does not exist.
- explain §9: "Two levers" followed by three numbered items; quantisation then calls itself "the fourth".
- lab caveat on three tabs: "a ~200k-parameter character model" — it is 90,336.
- harness §5: "taught exactly one thing … 200 facts … That is the whole of its arithmetic" — the corpus
  also has 6,000 whole sums and 6,000 self-traces up to 4 digits (`addition.ts`, `gen-model.ts`). The true
  story (trained on whole sums, still fails them, succeeds through the loop) is stronger.
- learn §8: LoRA "in the playground" — removed; lab only.
- playground status after first load: "pretrained Shakespeare loaded ✓".
- capstone `<title>`/meta/nav subtitle: "a warehouse agent" — the page opens with tic-tac-toe.
- capstone: "never loses to a random opponent" without the 9 losing lines vs perfect play that CLAUDE.md
  treats as the best teaching dissociation on the site.

**Rating: B−.** Right structure, real data, honest callouts; undone by jargon drift in the back half,
a missing chat/instruction-tuning bridge, and a dozen sentences that are simply wrong.

---

## 2. Developers and product managers (technical, never studied transformers)

**What works**

- The harness page is the best page for this audience. "A single call is function calling. An agent adds
  the loop." "Most of an agent's reliability comes from there rather than from the weights." The
  value-poisoning caveat in §4 (typed output stops a planted instruction but cannot make a poisoned value
  true) is a point most introductions skip.
- The playground's **Step Through** is the best mechanism prose on the site: Q/K/V, `scores = Q·Kᵀ/√d`,
  masking, softmax rows summing to 1, the MLP as key→value lookups, `∂loss/∂logits = softmax − one-hot`,
  and a concrete `W_after = W_before − lr × grad` cell. A developer who reads it can re-tell the forward
  and backward pass.
- The lab's Adapt group (LoRA, forgetting, RLVR) and speculative decoding each carry a one-line
  "why this matters in production" that a PM can repeat.
- The capstone's budget-not-size lesson is stated plainly and is quotable: "same brain, longer education."

**Where it falls short**

- **The learn page is too thin for its job.** ~700–900 words for "how a transformer actually works". It
  hand-waves the attention arithmetic ("Comparing them decides who reads from whom"), never mentions the
  mask, √d, LayerNorm or the residual add in prose (they appear cold in heatmap titles), never says why
  there are multiple heads or what layers add, gives backprop three sentences and no picture, and states
  no dimensions for this model or any real one. A PM leaves without "this is 90K; GPT-3 is 175B, 96
  layers, d_model 12,288". Act 2 ("How it learns") contains no learning: prose plus a static scatter.
- **Step Through is hidden.** It is one of six buttons and the learn page points to it once. It should be
  the learn page's Act 1 payoff, or be linkable.
- **The playground sidebar has zero tooltips.** d_model, heads, d_ff, weight tying, RoPE, causal mask,
  sliding window, KV cache, AdamW, learning rate, grad clip, top-k, top-p, "per-parameter gradient norm",
  the weights heatmap: all bare labels. Every explanation lives in GUIDE §4 behind two clicks.
- **No mapping to the real API surface.** Nothing on the harness page says "in a real API the tool is
  declared as a JSON schema, the model returns structured JSON, and the loop you see is what the SDK's
  tool-runner does." No system prompt, no MCP, no observability ("this trace is what your logging should
  show"), no least privilege beyond "authorise consequential actions". The most useful number for a PM,
  error compounding (99% per step is ~86% over 15 steps), is in CLAUDE.md and not on the page.
- **Chain-of-thought is demonstrated and never named.** Harness §5 mode 2 ("show its working, all in one
  go") *is* chain-of-thought; "reasoning model", "test-time compute" never appear.
- **The lab is a shelf, not a course.** Group blurbs are tooltips only; the framing paragraph disappears
  once a model loads; the first tab (neurons/superposition) is the hardest cold-open; cross-tab references
  are positional ("the previous tab", "the tools above") and wrong for the grouped layout; steering depends
  on training an SAE two rows away. Six tabs (neurons, heads, SAE, ablation, recovery, grokking) never say
  why anyone outside research cares. RLHF/DPO/alignment do not appear anywhere in `src/`.
- **Evals are done everywhere and named nowhere.** The site measures held-out accuracy on 20–145 examples
  in a dozen places and never says "this is an eval; this is what to ask a vendor for"; the quantisation
  of 20-example sets (5% steps) is undisclosed.

**Rating: B for the harness page, C+ for learn/playground as a mechanism course.** The material exists
(Step Through, GUIDE §4) but is not where this reader looks.

---

## 3. As the companion to a blog-series book

**The intended arc (`docs/book-outline.md`)** is five parts, 20 chapters, read → predict → try → reflect,
with "Try it →" deep links. It is a good arc. The problems are fit and infrastructure.

**Schedule.** `docs/blog/post-01` (written 27 July) promises "twice a week between now and the end of
September" and a book "out at the end of September". It is 9 September. Twenty chapters at two a week is
ten weeks. Either the series runs to late November or it covers a subset. The outline and post 1 need to
agree before post 2 goes out.

**Embed coverage.** Ten embeds exist: `tictactoe`, `harness-tools`, `agent-loop`, `prompt-injection`,
`lora`, `tokenizer`, `embeddings`, `adder`, `head-ablation`, `warehouse`. They cover chapters 2, 8 (partly),
11, 14, 15 and the capstone. **Chapters 1, 3, 4, 5, 6, 7, 9, 10, 12, 13, 16 have no embed** — that is the
whole Part I/II spine (next-token, attention, the block, training, grokking, hallucination). The ROADMAP's
"next up" list (`flaky-harness`, `rag`, `quantisation`, `injury-recovery`, `grokking`, then the rest of
the lab) still leaves chapters 1, 3, 4, 5, 13 with nothing.

**Deep links.** Only the playground (`?tour=1`, `?dataset=`), lab (`?tab=`), teachers (`?lesson=`) and
embed (`?demo=`, `?scale=`) use query strings. Explain, learn and harness are hash-only, which lands but is
invisible to analytics; learn's Act dividers have no id; harness anchors are auto-slugged from titles and
two are hard-coded in the capstone (edit a title, break a link). **The capstone has no anchors at all.**
The outline's `harness.html?ex=…` does not exist.

**Prefill.** Nothing accepts a prompt, example, basket, board or head from the URL. A post cannot say
"open the hallucination demo with `7x + 2 = 16`" or "open the word map on *king*". Every demo holds its
prompt in local state.

**Series surface.** No landing page distinct from the playground, no series index or chapter→page map, no
read-along page, no glossary, no cheat-sheet, no RSS/newsletter hook, no about/credits page. The site never
mentions the book or the series. The nav's "Next →" is a fixed page order, not the book's.

**Stats pipeline.** `modelStats.ts` describes one of nine bundled models and is imported by three files.
Every number for harness, adder, sort, tic-tac-toe, warehouse, MoE and draft models is a string literal
in JSX (~8 files) plus GUIDE plus the teachers lessons, and they already disagree: lessons say the ablation
baseline is 85%, modelStats says 89; the outline says threat focus 0.53→0.74, the page says 0.20→0.79;
the outline says "training-data design was the lever", the page (correctly) says budget; README says
five, six and ten embeds in three places.

**Shareability.** One `og:image` for every page and no per-tab/per-demo card, so every "Try it" link
previews identically. Canonicals are extensionless; nav links are `.html`.

**Rating: C.** The demos a blog would embed are excellent where they exist; the plumbing that makes each
post's "Try it →" land, prefill and count exists for about a third of the site, and the numbers a book
must quote have no single source for eight of nine models.

---

## 4. Gaps a reader would expect the site to cover

Ordered by how many readers hit them.

1. **From completion to chat.** What a prompt is, what a system prompt is, that a conversation is re-sent
   each turn, and that answering (rather than continuing) is trained in: pretraining → SFT → preference
   tuning (RLHF/RLAIF/DPO). The site has SFT, RLVR and forgetting in the lab but never assembles the
   pipeline, and RLHF/alignment appear nowhere. One explain section plus one prose chapter closes it.
2. **A glossary.** One page, one line per term, linked from every first use.
3. **Training data, plainly.** What it read, that it is a snapshot, the cutoff, what "open weights" means.
4. **Evals as a practice.** Name the thing the site already does; say what to ask a vendor for.
5. **Positional encoding, multi-head, depth, LayerNorm, the residual add** in the learn page prose, with
   this model's dimensions next to a real model's.
6. **Chain-of-thought / reasoning models** named where they are already shown (harness §5).
7. **Prompt engineering / context engineering.** Declared a site gap in the outline; still nothing.
8. **Safety and bias** beyond one clause; why labs do interpretability (audit, steer, detect).
9. **Logit lens** in the lab's Observe group. The engine already returns per-layer logits; it is the
   cheapest missing interpretability demo and the most intuitive.
10. **Attention on text** (not only sort) somewhere in the lab; induction heads on a poem.
11. **Scaling laws / emergence** as prose with the grokking demo as the anchor (Part V needs it).
12. **Multimodality and long-context** explicitly declared out of scope, so readers stop looking.
13. **A "build your own" exercise** on the capstone (change the reward, the check rule, a basket rule).
14. **The exhaustive-proof dissociation** on the capstone page (97.9% correct yet 9 losing lines).

---

## 5. Prioritised fix list (site)

**Tier 1 — wrong sentences (copy only, an hour)**
one poem (`HallucinationDemo.tsx:25`) · ~95% and dead "training-cost story" (`SpecialistCostDemo.tsx:38`) ·
"Two levers"/three items/"fourth lever" (`ExplainApp.tsx:300-308`, `QuantizationDemo.tsx:128`) ·
"~200k-parameter" (`lab/SectionIntro.tsx:40`) · "exactly 200 facts" (`AdderSection.tsx:123-126`, GUIDE
§8) · LoRA "in the playground" (`LearnApp.tsx:353`) · "pretrained Shakespeare loaded" (`TrainingPanel.tsx:397`) ·
capstone title/meta/subtitle · AblationBoard fragment (`AblationBoard.tsx:60-62`) · Callout header
"What this means for your work" on the learn page (`ui.tsx:36`, needs a prop) · README page/embed counts ·
GUIDE §3 stale Run/Generate ×20/LoRA-tab lines · `book-outline.md` threat-focus and "data design" lines ·
the `#4` cross-ref in harness §1 · "carries the carry".

**Tier 2 — bridges (copy, a day)**
"what the model was told" paragraph before the tic-tac-toe board · a chat/instruction-tuning section on
explain (between §4 and §5) · a glossary page · define-on-first-use pass for the terms listed above ·
learn page: mask, √d, LayerNorm, residual add, why heads, what depth adds, a dimensions table, a
backprop picture (link the Step Through) · harness §5 names chain-of-thought and prints the error
compounding number · lab group intros as visible text and a "start here" tab · reading-time labels
(explain 20 min, learn 15, capstone 20) · a "you can stop here" cue after explain §7 · capstone recap that
names where each idea was taught · capstone "9 losing lines" paragraph.

**Tier 3 — companion infrastructure (code, a few days)**
stable short ids on every section of explain/learn/harness/capstone + `?section=` pushState for analytics ·
`?prompt=` / `?ex=` / `?word=` / `?basket=` / `?board=` prefill on the relevant demos and embeds ·
`modelStats.ts` → a per-model stats module covering all nine bundles, imported by every page and the
lessons, and a script that regenerates it · embeds for the Part I/II spine: `next-token`, `attention`
(context tint), `hallucination`, `grokking` (the playground grok panel, tiny preset, auto-play),
`step-through` (the Walkthrough as a frame), `flaky-harness`, `rag`, `quantisation`, `logit-lens` ·
a `/series` landing page (posts in order, each with its "Try it" link) and a mention of the book on
the site · per-demo `og:image` (a screenshot pipeline) · sidebar tooltips on the playground.

**Tier 4 — new demos (code, a week+)**
logit lens tab · attention-on-a-poem view · a chat-vs-completion demo (same model, a `Q: … A:` corpus
window, showing the format is learned) · a capstone "edit the rule" exercise.
