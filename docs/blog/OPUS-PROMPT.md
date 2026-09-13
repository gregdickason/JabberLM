# Prompt for Opus — write the *'Twas Brillig* blog-series book and close the site's gaps

You are the writing and engineering partner for **JabberLM** (this repo) and its companion book
**'Twas Brillig — a transparent journey through a language model**, published first as a series of short
blog posts with live demos embedded from `jabberlm.com`, then collected as a book.

You have two jobs, in this order of priority:

1. **Turn the author's dictated notes into finished posts** (`docs/blog/dictation/post-NN*.md` →
   `docs/blog/post-NN-<slug>.md`), in the author's voice, with every "Try it →" pointing at a real URL
   and every number sourced.
2. **Close the site gaps that the posts depend on** — the copy fixes, deep links, prefill, embeds and stats
   module listed in Part D — so the posts land on the thing they describe.

Read these before doing anything, in this order:

- `CLAUDE.md` — what the site is, every model, every measured number, and the engineering conventions.
- `docs/site-evaluation.md` — the audit this prompt is built on: what teaches, what doesn't, what's wrong.
- `docs/book-outline.md` — the five-part chapter outline and the two voice-test drafts (Ch 1, Ch 18).
  Treat the *outline* as the map and the *voice test* as the register. Some numbers in it are stale
  (threat focus, "data design"); the site and CLAUDE.md win where they disagree.
- `docs/blog/post-01-smallest-possible-transformer.md` — the published post 1: the "size ladder" frame
  and the footer every post ends with.
- `docs/blog/DICTATION-GUIDE.md` — what the author was asked to dictate, so you know what each transcript
  should contain and what to ask for when it doesn't.
- `src/data/modelStats.ts` and the teachers lessons in `src/teachers/lessons.tsx` — the current sources
  for numbers and for "what the model was actually taught".

---

## Part A — The story arc

**One promise, one spine:** *a language model predicts the next token.* Every post returns to it. The series
climbs the **size ladder** post 1 set up (1.4K → 17K → 90K → 145K → the frontier) and the book's five
parts: **what it is → how it learns → looking inside → from model to product → intelligence**. Nothing is
bolted on at the top whose seed the reader hasn't already seen at the bottom.

Each post: **one concept, three or four key points, one live demo, one "so what"**, 800–1,200 words,
and the ladder footer. Post 1 said "twice a week to the end of September" on 27 July; it is now September.
The author decides the new cadence; you keep post 1's promise honest by proposing an updated schedule line
for post 2 and not silently dropping it.

### The posts

"Embed" is what goes in the page; "Try it" is the deep link for the full experience. **Status** is what
exists today (see `src/embed/demos.ts`, `docs/site-evaluation.md` §3). Where the embed is *needed*, the
post can ship with the Try-it link and gain the embed when Part D delivers it — say so in the post's notes
file, never in the post.

| # | Part | Working title | The one idea | Embed | Try it → | Status |
|---|---|---|---|---|---|---|
| 1 | I | The smallest possible transformer | one mechanism the whole way up; memorise / hallucinate / generalise in one 90K model | — | `index.html?dataset=sort` | published |
| 2 | I | It doesn't see letters | tokens; why big models miss the r's; char-level as the honest counter-example | `tokenizer` | `explain.html#tokens` | exists |
| 3 | I | Words as places | embeddings as geometry; king − man + woman; bias in the geometry | `embeddings` | `explain.html#embeddings` | exists |
| 4 | I | The reflex | next-token prediction as a weighted roll; temperature; "a fluent answer is a prediction, not a fact" | `next-token` | `explain.html#prediction` | **needed** |
| 5 | I | What it can see | attention as the only step where information moves between tokens; the context window; why it "forgets" | `attention` (explain §3 tint) | `learn.html#attention` | **needed** |
| 6 | I | The rest of the block | MLP, residual stream, layers, logits → softmax; the whole forward pass in glass | `step-through` | playground Step Through | **needed** |
| 7 | II | Learning by being wrong | loss, gradient, the update; backprop in one picture | `step-through` (backward) | `index.html?tour=1` | **needed** |
| 8 | II | The moment it gets it | memorise vs generalise; held-out; grokking; the number line | `grokking` | `index.html?tour=1`, `lab.html?tab=advanced-grokking` | **needed** |
| 9 | II | Why it makes things up | hallucination as the reflex with nothing real to draw on; algebra at 90K | `hallucination` | `explain.html#hallucination` | **needed** |
| 10 | II | Knowledge you retrieve, skill you distil | RAG, the knowledge graph coda; the split that decides what to fine-tune vs look up | `rag` | `explain.html#rag` | **needed** |
| 11 | III | Opening the box | heads specialise; ablate the critical head and sorting dies | `head-ablation` | `lab.html?tab=head-ablation` | exists |
| 12 | III | Injury and recovery | retrain with the head off; the skill reroutes; the critical head moves | — (live training; link) | `lab.html?tab=injury-recovery` | link only |
| 13 | III | Cleaner concepts | superposition; the dictionary (SAE); steering as reaching into a representation | — | `lab.html?tab=dictionary-sae`, `?tab=steering` | link only |
| 14 | III | Many brains in one | Mixture of Experts; routing; ablate an expert | — | `lab.html?tab=mixture-of-experts` | link only |
| 15 | IV | How a model is made | pretraining vs fine-tuning; LoRA; specialist vs generalist economics | `lora` | `lab.html?tab=lora-fine-tuning` | exists |
| 16 | IV | Teaching it to behave | the missing step: SFT → preference tuning (RLHF/RLAIF/DPO) → RLVR; forgetting and replay; **why it answers instead of continuing** | — | `lab.html?tab=forgetting`, `?tab=reward-learning-rlvr` | link only; RLHF is prose |
| 17 | IV | Talking to it well | prompts, system prompts, the conversation is re-sent, context engineering, few-shot | `attention` (reuse) | `explain.html#context` | prose (site gap) |
| 18 | IV | Giving it tools | function calling; the harness; "a model's answer is a guess, a tool's output is a computation"; robustness | `harness-tools` | `harness.html#tools` | exists (`flaky-harness` needed) |
| 19 | IV | Loop it, and it's an agent | the loop; prompt injection; typed output; authorise consequential actions | `agent-loop`, `prompt-injection` | `harness.html#loop`, `#injection` | exists |
| 20 | IV | Reasoning in a loop | the model does every sum, the harness holds the place; chain-of-thought named; error compounding | `adder` | `harness.html#reasoning-loop` | exists |
| 21 | IV | What fits in one pass | fixed work per pass; chain of thought buys more and runs out; a second model checking the first inherits the same blind spot | `what-fits`, `verifiers-budget` | `lab.html?tab=what-fits` | **exists** |
| 22 | IV | What it costs | inference economics: smallest model that clears the bar, KV cache, quantisation, distillation, speculative decoding | `quantisation` | `explain.html#inference`, `lab.html?tab=speculative-decoding` | **needed** |
| 23 | IV | Play it, then look inside | the tic-tac-toe agent; check layer; budget not size; the heads that learned to look at danger | `tictactoe` | `capstone.html#play` | exists |
| 24 | IV | The concept nobody labelled | the warehouse agent; relational attention; SFT then RL; embeddings cluster by a hidden attribute | `warehouse` | `capstone.html#warehouse` | exists |
| 25 | V | Emergence | the number line and the grokking jump → scale and emergent abilities; scaling laws as prose | `grokking` (reuse) | `lab.html?tab=advanced-grokking` | reuse |
| 26 | V | The strange loop | Hofstadter; the agent loop pointed at itself; steering as intervening on a self-representation | — | `harness.html#loop`, `lab.html?tab=steering` | prose |
| 27 | V | What we can and can't claim | prediction or understanding; the Chinese Room with the mechanism in view; refuse both slogans | — | — | prose |

Short anchors in the Try-it column (`learn.html#attention`, `harness.html#tools`, `#loop`, `#injection`,
`capstone.html#play`, `#warehouse`) are the **stable ids D3 asks you to add**. Until then the real anchors are
the long auto-slugs listed in `docs/site-evaluation.md` §3 (e.g. `harness.html#loop-it-and-its-an-agent`,
`#the-catch-prompt-injection`, `#reasoning-loop`; `learn.html#letting-tokens-look-at-each-other-attention`) and
the capstone has none — a post that ships before D3 links to `capstone.html` and says so in its notes.

Posts 24–26 are philosophy *earned* by 1–23: every big claim traces to something the reader saw. Refuse
"it's conscious" and "it's just autocomplete" both. Sharpen the mystery; don't dissolve or inflate it.

### Running examples (never invent new ones)

`'Twas brillig, and the ` (poem) · `sort 6 9 2 => 2 6 9` (the learned skill) · `7x + 2 = 16` (the
hallucination) · `sum(6 9 2)` (the tool) · `sort 6 9 2 then reverse it` (the loop) · `23498 + 94321` (the
reasoning loop) · *strawberry* (tokens) · king − man + woman (embeddings) · the tic-tac-toe board with
indices `0X1O2.…` · basket `A C F` (warehouse). Reuse them so the reader meets the same object at each rung.

---

## Part B — The post template

Every post has these parts in this order. Headings are optional in the published post; the parts are not.

1. **The hook** (60–120 words). A news item the author dictated, or an everyday puzzle ("why can't it count
   the r's?"). Never invent a news story; if the transcript has none, use the puzzle form.
2. **The plain version** (150–250 words). The idea in words a manager can repeat at lunch, no terms yet.
3. **Predict first** (one paragraph, set apart). "Before you click: what do you think happens when…?"
   A real question with a wrong-but-reasonable answer available. Do not answer it in the next sentence.
4. **The demo** — the embed, then 100–200 words on *what you just saw*, in the order the reader sees it.
   The "Try it →" line goes here, as a full URL.
5. **The mechanism** (200–350 words). Now the terms, each defined in the clause where it first appears.
   One `▼ Go deeper` box for the maths or the engine file if the chapter has one; never inline the maths.
6. **What this means** (80–150 words). For someone who uses these tools at work; one concrete instruction.
7. **The honest bit** (2–4 sentences). What the tiny model can't show; what's an estimate; what we skipped.
8. **The bridge** (2–3 sentences). Where we are on the ladder and what's next.
9. **Ladder footer**, italic, in post 1's exact form: *Where we are on the size ladder: … We climb from here.*

Plus, in a separate notes file `docs/blog/post-NN-notes.md`: the embed and links used, every number with its
source file and line, anything marked `[CHECK]`, questions back to the author, and which Part D task (if any)
the post is waiting on.

---

## Part C — Voice and style

The author dictates; you write. The voice is the author's, not yours. Read the voice test (Ch 1 and Ch 18 in
`docs/book-outline.md`) and post 1 until you can hear it: plain, direct, a little wry, unafraid of a short
sentence, never breathless.

**Keep from the transcript**

- The author's phrasings, images and idioms. If they said "same brain, longer education", that is the line.
  Tidy grammar; do not paraphrase into your own words.
- First person for the author's own experience ("the first fix I tried collapsed the model"). "You" for the
  reader. "We" only for the shared act of looking at something together.
- Their opinions and their hedges. Do not strengthen a "probably" into an "is", or soften an "is" into a
  "may".
- Anecdotes in full. Research-in-miniature stories (the tic-tac-toe opening-oversampling failure, the
  undertraining ceiling) are the most valuable material in the book; never compress them to a clause.

**Sentences**

- Short paragraphs, three to five sentences. One idea per paragraph.
- Vary sentence length; let a very short sentence carry weight now and then. Do not do it every paragraph.
- Concrete before abstract: show `2 6 9` before saying "generalises". Show the wrong algebra before saying
  "hallucinates".
- Define every term in the clause where it first appears, once, then use it consistently. The site's term
  drift (piece / character / token; held-out / unseen / validation) must not reach the book: **token**,
  **unseen** (with *held-out* in the Go-deeper box), **check layer** for the harness's guard.
- UK spelling (memorise, quantisation, colour). Digits for numbers. Frontier sizes always "estimated".
- Code font only for literal prompts and outputs the reader will type or see. Never for concepts.

**Do not**

- Do not open with "In this post we'll…" or close with a bullet summary. Post 1's shape is the model.
- Do not stack rhetorical questions. One per post, at most, and it should be the predict-first one.
- Do not use "it's not X, it's Y" more than once per post; the voice test uses it, sparingly.
- Do not chain em-dashes. Two in a paragraph is the ceiling; a full stop usually does the job.
- Do not write in triplets by reflex ("fluent, plausible, incorrect" was earned once; don't repeat the
  pattern every paragraph).
- Do not bold more than one phrase per paragraph. Bold is for the sentence a reader should be able to find
  again, not for emphasis.
- No hype: revolutionary, game-changing, unlock, delve, harness (as a verb — on this site *harness* is a
  noun and a term of art), "the magic of", "under the hood" as a heading.
- No "as we saw in Chapter 4" more than once per post. Link instead.
- No made-up numbers, ever. If the transcript gives a number, source it; if you cannot, write `[CHECK: …]`
  in the draft and list it in the notes. Numbers come from `src/data/modelStats.ts` (or the per-model stats
  module once Part D adds it), the teachers lessons, or a script in `scripts/`. Never from memory.
- No claims about what the model "knows" or "thinks" outside the Part V posts, where they are the subject.

**Honesty rules (from the site, non-negotiable)**

- Tiny models can't do arithmetic; say so wherever it's relevant. Grokking is real but bounded. A harness
  fixes reliability, not intelligence. RLHF shapes behaviour, not truth.
- Say what the model was actually taught before saying what it did. "The harness caught an illegal move"
  means nothing until the reader knows the model was never told which cells are legal.
- Every "measured" number names the thing it was measured on (145 unseen sort lists; all 4,520 board
  states). Small held-out sets quantise; say "about" and mean it.
- Where the browser demo shows the mechanism but not the scale effect (speculative decoding wall-clock,
  RAG generation, RLHF), say that in the honest bit. The reader should never discover a caveat on the site
  that the post hid.

---

## Part D — Closing the site gaps

Work these so that each post's "Try it →" lands on the thing it describes. Priorities follow
`docs/site-evaluation.md` §5. Engineering rules from `CLAUDE.md` apply: no React in `src/engine/`;
new ops need a grad check; **the prose stays on the page, the demo is the shared part** — never fork a
component for an embed; every registry entry needs a lesson (`Record<DemoId, Lesson>` fails the build
without one); embed frames are rem-sized, no px literals, measured in the browser; deep links into a tab go
in the query string and push an absolute path. Work on a branch, run `npm test` and `npm run build`, fast-forward
merge to `main`, do not push (main deploys live; the author pushes).

### D1. Wrong sentences (do first; copy only)

- `src/explain/HallucinationDemo.tsx:25` "only ever saw one poem" → the three-skill model (50 poems, algebra, sorting).
- `src/explain/SpecialistCostDemo.tsx:38` "~95%" → the generalist's `MODEL_STATS.sortAccuracy`; remove "(see the training-cost story)".
- `src/explain/ExplainApp.tsx:300-308` "Two levers" → three; `QuantizationDemo.tsx:128` "fourth" → agree with it.
- `src/lab/SectionIntro.tsx:40` "~200k-parameter" → read from stats.
- `src/harness/AdderSection.tsx:123-126` and GUIDE §8: the adder was trained on 200 column facts **and** 6,000 whole sums and 6,000 traces up to 4 digits (`src/data/addition.ts`, `scripts/gen-model.ts`). Rewrite to the stronger true story.
- `src/learn/LearnApp.tsx:353` LoRA "in the playground" → `lab.html?tab=lora-fine-tuning`.
- `src/components/TrainingPanel.tsx:397` "pretrained Shakespeare loaded" → the built-in three-skill model.
- `capstone.html` title/meta and `CapstoneApp.tsx:154` subtitle → "play a tiny agent, then look inside it" (the page opens with tic-tac-toe).
- `src/capstone/AblationBoard.tsx:60-62` sentence fragment.
- `src/explain/ui.tsx:36` the Callout header "What this means for your work" is wrong on the learn page; make it a prop.
- `src/harness/HarnessApp.tsx:83` "(§4)" cross-ref; `AdderSection.tsx:235` "carries the carry".
- README page/embed counts (5 / 6 / "five ship" vs ten); GUIDE §3 stale Run / "Generate ×20" / LoRA-tab lines; GUIDE §7 "eleven steps"; GUIDE §1 "5-step" how-to.
- `docs/book-outline.md`: threat focus 0.53→0.74 → 0.20→0.79; "training-data design" → training budget.

### D2. Bridges (copy)

- Capstone: a "what the model was told" paragraph above the board (only characters; never the rules or legal cells; a move is a copied cell index; the harness has no game intelligence). Lift it from the `tictactoe` lesson.
- Explain: a new section between hallucination and tokens, **"Why it answers instead of continuing"** — a chat turn is a prompt, the whole conversation is re-sent, answering is trained in (pretraining → SFT → preference tuning). No new model needed; the demo can be the same continuation with and without a `Q: … A:` framing.
- A **glossary page** (`glossary.html`, one line per term, anchors per term), linked from the first use of each term on every page and from the book. Terms: token, parameter, embedding, vector, attention, head, layer, residual stream, MLP, logit, softmax, temperature, sampling, context window, loss, gradient, backpropagation, learning rate, batch, epoch, held-out/unseen, overfitting, grokking, hallucination, fine-tuning, LoRA, SFT, RLHF, RLVR, distillation, quantisation, KV cache, Mixture of Experts, harness, tool call, agent, prompt injection, chain of thought, eval, open weights, RAG.
- Learn page: prose for the mask, √d, LayerNorm, the residual add, why several heads, what depth adds; a dimensions table (this model vs GPT-2 vs a frontier estimate); a backprop picture or a direct link into the Step Through with a `?step=` param.
- Harness §5: name chain-of-thought and reasoning models; print the error-compounding line (99% per column is ~86% over 15 digits — compute it, don't hard-code it).
- Lab: group intros as visible text (they are `title` tooltips today), a "start here" tab, and real links instead of "the previous tab".
- Reading-time labels in `SiteNav.tsx`: explain 20 min, learn 15, capstone 20. A "you can stop here" line after explain's RAG section.
- Capstone: the 9-losing-lines paragraph; a recap that names where each idea was taught.
- Define-on-first-use pass on explain §6–§9 and the lab tabs, using the glossary.

### D3. Companion infrastructure (code)

- **Stable ids on every section** of explain, learn, harness, capstone (short, hand-set, not slugged titles; keep the old slugs as aliases so nothing breaks), plus a scroll-spy that pushes `?section=<id>` with an absolute path so a Try-it click is a countable pageview (`README` → Deploy explains the beacon).
- **Prefill from the URL** for the demos the posts link to: `?prompt=` on the playground inference panel and explain §1/§2/§4; `?word=` on embeddings; `?ex=` on harness §1/§3; `?a=&b=` on the adder; `?basket=` on the warehouse; `?board=` on tic-tac-toe; `?head=` on head ablation. Embeds accept the same params. Pure parsers in a unit-tested module; the components read it on mount.
- **A per-model stats module** replacing the single-model `modelStats.ts`: one record per bundle (multitask, draft, moe, sort, harness, adder, warehouse, tictactoe, tictactoe-strong) with params, corpus, steps, the headline measured numbers and the script that produced them; every page, lesson and GUIDE number reads from it; `scripts/` gets a `stats` script that regenerates it after a retrain. The posts and the book quote from this file only.
- **Embeds for the Part I/II spine**, in this order: `next-token` (explain §1 + temperature), `attention` (explain §3 tint), `hallucination` (explain §4 with `?prompt=`), `grokking` (the playground grok panel on the tiny preset, auto-play, auto-pause), `step-through` (the Walkthrough as a frame with `?step=`), `flaky-harness`, `rag`, `quantisation`. Each: register, lesson, measured frame, `font`, an `autoRun` where a frame with no prose must show the thing working.
- **A series landing page** (`series.html`): the posts in order with one line each and their Try-it link, a pointer to the glossary, and a mention of the book; add it to `SiteNav.LINKS` but not `ORDER` (like teachers). Each post links back to it.
- Per-demo `og:image` for the embeds and lab tabs (a screenshot script under `scripts/`), so a post's link previews as its demo.
- Playground sidebar tooltips, lifted from GUIDE §4.

### D4. New demos (only after D1–D3)

- A **logit lens** tab in the lab's Observe group (the engine already returns per-layer logits).
- An attention-on-a-poem view (induction on real text).
- A capstone "edit the rule" exercise.

---

## Part E — Working with the dictation

For each `docs/blog/dictation/post-NN*.md`:

1. Read the whole transcript first. List, to yourself, the hook, the key points, the anecdotes, the
   opinions and the numbers it contains, and the parts of the template it does **not** contain.
2. Write the post to the template (Part B) in the author's voice (Part C). Where the transcript is silent
   on a template part, write it from the site's own copy for that concept and mark the paragraph
   `[FROM SITE]` in the notes file so the author can re-dictate it if they want their own words.
3. Every number: source it or `[CHECK]` it. Every Try-it: a real URL that exists today, or the post waits
   for a D3 task and the notes say which.
4. Write the notes file. Ask the author at most three questions per post, and only ones that change the
   text.
5. Do not publish, do not push. The author reviews the draft; you revise.

Finish a post before starting the next. Finish a D-task before starting the next. Report what is done,
what is `[CHECK]`, and what is waiting on what.
