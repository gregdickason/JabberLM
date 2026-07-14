# 'Twas Brillig — book working doc

Working notes for the companion book. Living document — the outline, pedagogy, gaps, and the first
voice-test drafts, kept here for future iteration. (Strategy/authoring only; the site is the interactive
lab the book links to.)

## Title (locked)
**'Twas Brillig** — *A transparent journey through a language model.*
Subtitle: **From Tokens to Agents to Intelligence.**

"'Twas brillig" ties to the Jabberwocky corpus the model is trained on (and to making sense of nonsense);
"transparent" is the see-inside ethos. The subtitle is the three beats — smallest unit (**tokens**) →
capability (**agents**) → the biggest question (**intelligence**). The book doesn't stop at "how it
works": it ends by asking, with earned clarity, what it *means* (Hofstadter's strange loop).

## Format & audience (decided)
- **Companion book** (separate written artifact: PDF + EPUB), with jabberlm.com as the live lab.
- **Layered depth:** plain-language spine a curious professional can follow with no maths (the
  `explain.html` register), plus optional **▼ Go deeper** boxes with the real mechanics for technical
  readers, and **⚙ Under the hood** asides pointing at the actual engine files.

## Pedagogy (the book's engine)
- **One promise, one spine** — "a model predicts the next token"; every chapter returns to it.
- **read → predict → try → reflect** on each concept: (a) plain explanation, (b) *predict-first* prompt,
  (c) **Try it →** a precise deep-link into the site, (d) *what this means* (judgement/limits).
- **Shared running examples** with the site: *Jabberwocky*, `sort 6 9 2`, `7x+2=16` (hallucination),
  `sum(6 9 2)` (the tool).
- **Honesty throughout:** tiny models can't do arithmetic; grokking is real but bounded; a harness fixes
  reliability, not intelligence; Part V refuses both "it's conscious" and "it's just autocomplete".
- Per-chapter **"you can now…"** checklist; exercises are *site tasks*; a **capstone** (train a
  mini-model, then a 2-tool agent).
- Apparatus: preface (how to read with the site), **glossary**, cheat-sheet, further reading, index.

## Site gaps the book must handle
- **Build item (only real code):** deep-linkable URLs/anchors so **Try it →** lands on the exact
  tab/demo/example (`lab.html#head-ablation`, `harness.html?ex=total+of+6+9+2`, `index.html?dataset=sort`).
- **Prose chapters (site doesn't demo these):** the pretraining→SFT→RLHF pipeline, prompting/context
  engineering, evaluation of generative models, jailbreaks, scaling laws/emergence. Multimodality = out of
  scope for v1. *(Tokenization/BPE, prompt injection, quantisation, embeddings & RAG now have live demos —
  `explain §5–§9` and `harness §4` — so they're off this list.)*
- **Apparatus gaps:** glossary artifact, exercises/solutions, guided capstone, a figure/stat pipeline
  (numbers sourced from `src/data/modelStats.ts` so book and site never disagree).

---

## Chapter outline (5 parts)
Each chapter = objective ("after this you can…") · plain spine · **Try it →** (site anchor) ·
**▼ Go deeper** · exercise.

**Part I — What a language model is**
1. *The autocomplete that ate the world* — next-token prediction. Try: `explain §1`. Deeper: softmax/probability.
2. *Words into numbers* — first **tokens** (text → pieces), then **embeddings as meaning-as-geometry**:
   every token becomes coordinates, placed by the company it keeps, so similar meanings sit close and
   directions carry meaning (king − man + woman ≈ queen) — the engine of semantic **search**,
   recommendations, clustering, and the retrieval in Sidebar 7B. **Real models use subword (BPE) tokens,
   not characters** — which is *why* they miss "how many r's in strawberry?", multi-digit arithmetic and
   string-reversal: the model sees chunks like `[str][aw][berry]`, never the letters (JabberLM is
   char-level, so it's the honest counter-example — it *can* count and reverse). Try: `explain §5` (real
   GPT-4 tiktoken splits vs char-level), `explain §6` (real GloVe subset — nearest-neighbour search, live
   analogies, a 2-D word map), playground tokenize/embed, `learn` Act 1. Deeper: BPE merges, embedding
   vectors, cosine similarity, JabberLM's own digit **number line** (the same idea in miniature).
3. *Paying attention* — attention & the context window. Try: attention tab, `explain` context demo. Deeper: Q/K/V, QKᵀ/√d, masking.
4. *The rest of the block* — MLP, residual stream, layers → a guess. Try: mlp/residual/logits tabs, step-through. Deeper: full forward pass, LayerNorm.

**Part II — How it learns**
5. *Learning by being wrong* — loss, gradients, backprop, training. Try: playground training + backward step-through. Deeper: cross-entropy, AdamW.
6. *Memorise, generalise, grok* — overfitting vs generalisation; the grokking jump. Try: playground grok view; `lab` advanced grokking. Deeper: held-out, the memorise→generalise gap.
7. *Why it makes things up* — hallucination (algebra) and why size matters. Try: `explain` hallucination; params-scale. Deeper: why arithmetic won't fit a tiny model.
   - **Sidebar 7A — Specialist vs generalist (capacity & training cost).** A *tiny* model trained on
     **sorting only** vs the *default* model trained on **all three** (the Custom combined set): the
     specialist reaches high sort accuracy fast and cheap; the generalist splits its capacity across
     poems + algebra + sorting, so it needs **more steps** to match the specialist *on sort* — and pays
     with breadth. Lesson: capacity is a budget you concentrate or spread; "how long to train to equal
     sort skill" makes the trade-off concrete. Sets up MoE (Ch 10, experts = specialists under one roof)
     and fine-tuning (Ch 11, adapting a generalist to a specialty cheaply).
     - **Measured (crossover to ≥90% held-out sort; playground config — batch 16, lr 0.01, seed 1337, one
       run each):**

       | model | corpus | params | steps to ≥90% sort | training time |
       |---|---|---|---|---|
       | **tiny** | sorting only | ~15K | **2,200** | **~54 s** |
       | **default** | all three combined (Custom) | ~90K | **6,300** | **~1,220 s (~20 min)** |

       The generalist needs **~2.9× the steps** and **~22× the wall-clock training time** to reach the
       same sort skill (the time gap is larger than the step gap because it's a bigger model on a much
       longer corpus). It also groks *later and noisier*: the specialist jumped cleanly (16%→60%→84%→95%
       across steps 1,000–2,200), while the generalist sat near 0% until ~step 2,500, then climbed
       unevenly (bouncing through the 60–70s) before consolidating ≥90% at 6,300. Grokking step is
       seed-dependent, so treat these as representative, not exact — they match in-browser observations
       (specialist grokking begins ~step 1,500; generalist ~step 4,000+). *(Regenerate with the crossover
       script; keep figures in sync via the stat pipeline.)*
     - **Inference cost (the half that matters at scale).** Training is a one-off; *inference* is the bill
       you pay forever. At equal sort quality (~95% both), the tiny specialist has ~6× fewer parameters →
       ~6× less compute per token, and runs measurably faster. So even though the generalist was more
       expensive to train, the *specialist* is the one you'd deploy for a high-volume sort task. This is
       the economic engine behind how model usage is evolving as token cost bites: **route** easy requests
       to small models, **fine-tune small specialists** for high-volume tasks, **distill** a big model's
       skill into a small one, and **MoE** (run only a slice of a huge model per token) — "use the smallest
       model that clears the bar." Try: `explain §6` (specialist-vs-generalist inference demo).
     - **Distillation (measured; lab demo).** The most direct "big → small" lever: train a small *student*
       to copy a big *teacher*'s **whole output distribution** (soft targets), not just the right token —
       the extra "dark knowledge" makes it learn faster. Offline, a ~15K student distilled from the ~87K
       sort teacher reached the teacher's ~96% **and grokked ~2–3× faster** than an identical student
       trained on plain labels (distilled 24/42/60% vs labels 8/12/32% at steps 750/1000/1250; both
       converge by ~2,500 on this clean task — the gap is larger at real scale). Engine: `softCrossEntropy`
       + `Trainer.distillStep`. Try: `lab` → distillation.
   - **Sidebar 7B — Retrieval (RAG): knowledge you retrieve, skill you distil.** Hallucination is the model
     confidently filling a gap in its weights. The standard fix isn't a bigger model — it's **retrieval**:
     find the relevant text and paste it into the context, so the answer is grounded in a real, citable
     source. This is the natural counterpart to distillation, and the split is the chapter's headline:
     **skill** (how to sort, how to write) you bake into the weights — distil it into a small model;
     **knowledge** (this contract, this quarter's numbers, a private handbook) you *retrieve* at query time
     rather than trying to cram it in. Two ways to find the passage, both shown live (`explain §7`, reusing
     the §6 word vectors — no new model): **exact lookup** when you know the document's name, and
     **semantic search** when you only know the meaning (embed the query → cosine vs each document → inject
     the nearest). **Honest scale caveat:** JabberLM's own 48-char context and char-level embeddings are too
     small to *read* a retrieved document and generate from it — so the demo shows the mechanism (retrieve →
     ground) with real GloVe vectors, not end-to-end generation. The *pattern* is the lesson, and it's the
     modern framing of "RAG = giving the model a retrieval tool" (ties forward to Ch 13, tools/harness:
     a `lookup`/`search` the agent calls). Try: `explain §7` (lookup + semantic retrieval).
   - **Sidebar 7C — Quantisation: the same model at lower precision.** The 4th "cheaper inference" lever,
     alongside distillation, Mixture-of-Experts, and KV-caching. A model is a pile of numbers, normally 32
     bits each; **quantisation** stores them with far fewer bits (int8, int4), shrinking memory and the
     bandwidth that dominates inference. The teaching shape is a curve that **holds, then falls off a cliff**.
     **Measured** on the bundled sort model (round every weight matrix, keep LayerNorm/biases in fp32,
     re-test held-out sort): 32-bit **99%** → 8-bit **99%** (3.8× smaller — free) → 4-bit **91%** (7.2×
     smaller) → 3-bit **3%** → 2-bit **0%** (collapse). Lesson: you can shrink a model *a lot* before it
     degrades, then it breaks suddenly — which is why capable models run on a laptop or phone. Engine-free
     (`src/interp/quantization.ts` quantise→dequantise on a throwaway copy). Try: `explain §9`.

**Part III — Looking inside (interpretability)**
8. *Opening the black box* — neurons, heads, specialisation; **and recovery**: ablate the head a skill
   depends on, then retrain with it off and watch the skill reroute to other heads (the critical head
   *moves*) — redundancy, plasticity, recovery-of-function; the concrete backing for the Part V "it
   functionally rhymes with the brain" argument (lesion + relearning). Try: `lab` neurons/heads/head-ablation
   + **injury & recovery**. Deeper: induction heads, polysemanticity, distributed vs localized coding,
   the lesion-inference caveat (necessity ≠ localization).
9. *Cleaner concepts* — dictionary learning (SAE) & steering. Try: `lab` SAE + steering. Deeper: superposition, sparse autoencoders.
10. *Many brains in one* — Mixture of Experts. Try: `lab` MoE. Deeper: gating, sparse top-k, dense-train.

**Part IV — From model to product**
11. *How a model is made — training vs fine-tuning.* The two things people conflate. **Training (from
    scratch / pretraining):** a *base model* is grown by next-token prediction over a huge corpus — exactly
    what the playground does, scaled up by a factor of billions; it produces a fluent autocomplete that
    knows a lot but isn't yet an assistant. **Fine-tuning:** nobody retrains a giant from scratch for a new
    task — you *adapt a frozen base* cheaply on a little data. **LoRA** is the dominant method (a tiny
    low-rank overlay). Try: playground (train a base from scratch) **and** the LoRA card (adapt the built-in
    model), and feel the difference in data/compute. Deeper: low-rank ΔW; the compute/data gulf between
    pretraining and fine-tuning; the specialist-vs-generalist economics (callback to Sidebar 7A — why you
    adapt a generalist rather than train a specialist each time).
12. *Teaching it to behave — SFT, RLHF, and RLAIF.* How a raw next-token predictor becomes a *helpful
    assistant* — the step most people don't know exists. **Supervised fine-tuning (SFT / instruction
    tuning):** fine-tune the base on curated *instruction → good-response* demonstrations, so it learns to
    follow requests rather than just continue text. **Preference optimization:** then shape *which* good
    answer it prefers — **RLHF** (humans rank competing outputs; a reward model + reinforcement learning
    nudge the model toward the preferred ones) and **RLAIF** (an AI gives the preference labels instead of
    humans, guided by a written constitution/rubric — cheaper, more scalable, and how "constitutional"
    models are aligned). This is where "helpful, harmless, honest," the model's tone, and its refusals come
    from — they're *trained in*, not emergent. Honest caveat: alignment shapes *behaviour and preferences*,
    not *truth* — RLHF doesn't cure the hallucination of Chapter 7, it just makes the model nicer about it.
    **Site gap — prose** (the tiny in-browser model can't demo RL; anchor to the LoRA fine-tune experience
    as the nearest hands-on analogue — "SFT is LoRA-with-better-data at scale"). Deeper: reward models,
    PPO vs DPO, the KL penalty / "alignment tax," Constitutional AI.
13. *Talking to it well* — prompting & context engineering *(new; site gap)*. Try: context/attention demos. Deeper: few-shot, system prompts.
14. *Giving it tools* — function calling & the harness; reliability. Try: `harness` §1–2. Deeper: tool schemas, validation.
15. *Agents — and their risks* — the loop, and its blind spot: **prompt injection**. The loop feeds a
    tool's *output* back into context with no boundary between **data** and **instructions**, so whoever
    controls what a tool returns (a fetched web page, a looked-up document) can plant the model's next
    command. Shown live and reproducibly on the tiny harness model: an attacker-controlled tool result
    (`max 1 1 1`) hijacks the agent into calling `max` instead of the planned `reverse`. Mitigation:
    treat tool output as untrusted, **typed data** (keep only the declared result type) — this defeats the
    planted-instruction/tool-switch, but *can't* make a poisoned **value** trustworthy, so consequential
    actions still need explicit authorisation. Try: `harness §4` (inject + mitigation), `harness` agent
    loop. Deeper: multi-step planning, the data-vs-instruction confusion, guardrails/allow-lists; honest
    note that a large NL-trained model is *far* easier to hijack than this grammar-rigid toy.
16. *What you can't see, and what to ask* — governance, evaluation, safety, cost. Try: `explain` governance + cost suite. Deeper: evals, alignment.
    - **Inference economics (a proper treatment — this is where the money is).** Beyond price-per-token:
      (a) **which model** — specialist-vs-generalist at inference (callback to Sidebar 7A: same answer,
      a fraction of the cost); (b) the **KV cache** — a model generates one token at a time and each
      attends to everything before it, so naively the work grows with the *square* of the length; the
      cache stores earlier keys/values and reuses them, making it linear. Split it into **prefill** (read
      the prompt to build the cache — once, parallel, cheap per token) vs **decode** (generate the answer
      — one step at a time, can't be parallelised) — *that asymmetry is why output tokens are priced higher
      than input tokens*. (c) **Prompt caching** — reuse the same big prompt across calls and pay the
      prefill once (a real discount for repeated queries); the catch is the cache lives in **memory** and
      grows with context, so long contexts are limited by memory, not just compute. (d) Batching / GPU
      utilisation as the other big lever. Try: `explain §6` (KV-cache cost slider). Ch 4's Q/K/V is exactly
      what gets cached here — a one-line forward pointer there.
**Capstone (end of Part IV):** *Build your own* — train a mini-model, then a 2-tool agent, on the site.

**Part V — Intelligence (the strange loop)** — the finale; philosophy *earned* by everything above.
Prose-led but anchored to mechanisms the reader has *seen* (grokking/number-line = emergence; the agent
loop = a literal feedback loop; steering/ablation = reaching into a representation).
17. *Emergence* — from the number line and the grokking jump to scaling and emergent abilities. Try: revisit `lab` grokking with new eyes. Deeper: phase changes, why prediction pressure builds world-structure.
18. *The strange loop* — self-reference and feedback; the agent loop pointed back at itself; **Hofstadter, *I Am a Strange Loop***. Try: `harness` agent loop as feedback; steering as intervening on a self-representation. Deeper: level-crossing feedback, Gödelian self-reference.
19. *Prediction or understanding?* — "it's just autocomplete" vs "so, arguably, are you"; Chinese Room, symbol grounding, argued with mechanisms in view. Deeper: representation vs computation.
20. *What we can — and can't — claim* — consciousness, the self as a pattern, the honest open questions; a reflective close that hands the reader judgement, not answers.

**Key risk for Part V:** overclaiming. Do philosophy *with the mechanism in view* — every big claim traces
back to something the reader saw (a grok, a feature, the loop). Refuse both "it's conscious" and "it's
just autocomplete"; sharpen the mystery instead of dissolving or inflating it.

Front/back matter: Preface (how to read with the site) · Glossary · Further reading (Hofstadter, Nagel,
the interpretability literature) · Index.

## Production
- Author in Markdown; render PDF + EPUB with **Quarto or Pandoc** from a `book/` folder; CI to build.
- Site enablers: **deep-link support** (reuse `data-tour` anchors + example-chip machinery; read
  `location.hash`/`?params` on mount in App/LabApp/HarnessApp/ExplainApp) + optional read-along landing.
- Figures: repeatable capture per chapter; stats from `src/data/modelStats.ts`.
- **Voice test first** (below): Ch 1 full + Ch 18 (the strange loop) sketch, to prove one voice carries
  both registers.

---

# Voice test (first drafts — for critique/iteration)

## Chapter 1 — The autocomplete that ate the world

> *'Twas brillig, and the slithy toves / Did gyre and gimble in the wabe.*
> — Lewis Carroll, *Jabberwocky*

You have never seen a *tove*. You do not know what it means to *gyre*. And yet the line above is not
gibberish to you — it has a shape, a rhythm, a weather. Something in you read *'Twas brillig, and the
slithy…* and leaned, before the next word arrived, toward a certain *kind* of word. A noun, probably.
Something that could *gyre*.

That lean — guessing what comes next from what came before — is the whole foundation of the machines this
book is about. Not a metaphor for it. The thing itself.

A language model is autocomplete taken to a ridiculous extreme. Give it some text, and it estimates how
likely *every* possible next piece of text is — then picks one. It is not looking anything up. It has no
database of facts it consults. It is doing what you did with *brillig*: predicting what tends to come
next, and running that prediction over and over, one piece at a time, until it has written a sentence, a
paragraph, an essay, a lie.

The astonishing part — the part that took the world by surprise — is how far that single trick reaches.
Predict the next word well enough, over enough of what humans have written, and to do it you are quietly
forced to learn grammar, then facts, then style, then something that looks unnervingly like reasoning. We
will spend this book taking that apart. But it starts here, with one reflex.

To take it apart, we need a model small enough to see *all the way through* — every number on the screen
one you can trace back to the maths. So throughout this book you'll work with **JabberLM**: a real,
complete language model that runs in your browser, tiny enough to be transparent. Fittingly, one of the
things it was raised on is Carroll's nonsense verse. So when it babbles, it babbles *brillig* — a small,
honest mirror of the trick.

> **Try it →** Before you read on, *predict*: if you type `'Twas brillig, and the ` into a language model
> and let it continue, what will come out — real words, invented words, or a mix? Now open
> **jabberlm.com → New to AI (§1)** and watch it choose the next character, one at a time. Were you right
> about the *kind* of thing it produced?

Here is the first idea worth carrying out of this chapter, and it is the most important one for anyone who
*uses* these tools:

**A fluent, confident answer is a prediction, not a fact.** The model is not telling you what's true; it's
telling you what's *likely to come next* in text like the text it was trained on. Most of the time those
coincide — that's why it's useful. When they don't, it will be just as fluent, just as confident, and
completely wrong. Everything else in this book — how it learns, why it hallucinates, how we bolt tools
onto it to make it reliable — is downstream of this one fact.

> **▼ Go deeper — what "how likely" actually means**
> The model doesn't pick the next piece by magic. For every possible next token it produces a raw score (a
> *logit*); a step called **softmax** squashes those scores into probabilities that add up to 1. Then it
> *samples* from that distribution. A dial called **temperature** controls how adventurously: near 0 it
> almost always takes the most likely token (repetitive, safe); higher, and it reaches for less likely
> ones (varied, riskier). Same model, same prompt — different rolls of the dice. You can watch the actual
> probability bars, and turn that dial, in the **logits** tab of the playground. We'll meet softmax
> properly in Chapter 4; for now, just know the "guess" is really a *weighted roll*.

> **Exercise.** In the playground, type a short prompt and press Run. Watch the bar chart of
> next-character probabilities. Now set temperature to 0 and generate a few times — then to 1.2 and
> generate again. What changed, and what does that tell you about when you'd want each?

> **You can now:** say, in one sentence, what a language model fundamentally does; and explain to a
> colleague why a confident answer from one isn't the same as a true one.

The lean toward the next word is where it all begins. In the next three chapters we'll follow a single
piece of text as it falls through the machine — becoming numbers, gathering context, being *thought
about* — until, at the far end, out rolls a prediction. In glass, the whole way down.

## Chapter 18 — The strange loop *(sketch)*

By now you have done something most people who *talk* about AI have never done: you have looked inside one.
You watched nine digits, nudged only by the pressure to predict, quietly arrange themselves into a number
line — a *concept*, self-assembled. You found the particular attention head that does the sorting, and
switched it off, and watched the skill die. You built a loop in which the model read the result of its own
action and, on the strength of it, acted again.

So you are finally equipped to ask the question this whole book has been walking toward, and to ask it
*well* — which mostly means refusing the two cheap answers everyone else reaches for.

Douglas Hofstadter spent a career on one idea: that a *self* is not a thing but a **pattern** — and a
particular, curious kind of pattern he called a **strange loop**. A feedback loop that rises through the
levels of a system until it bends all the way back and starts to refer to *itself*. Point a video camera
at its own monitor and you get it in the physical world: an image that contains itself, containing itself,
a stable swirl that is somehow *about* the very system producing it. Hofstadter's wager in *I Am a Strange
Loop* is that the "I" — the stubborn feeling of being someone — is what it is like, from the inside, to
*be* such a loop.

Hold that next to what you built two chapters ago. The agent loop is a feedback loop, plainly: the model
emits an action, the harness runs it, and the *consequence is fed back into the model's own input*, where
it shapes the next action. Tiny. Mechanical. Transparent. And it raises the question with no room to hide:
is a rich enough version of *that* — a loop, running over rich enough representations, that comes to
include a representation of the looper — what a self is made of? Hofstadter's instruction is not to hunt
for a ghost in the machine. It's to look for the loop, and ask how tightly it closes.

But — careful. This is exactly where a worse book would sprint ahead and tell you the machine is waking up.
Our loop copies a *number* back into a *prompt*. That is not a self, and pretending otherwise is how you
end up fooled. The honest position is more uncomfortable than either headline: the gap between "a feedback
loop" and "a loop that models itself as an *I*" is enormous, and *we do not know how to cross it* — nor
whether piling on scale crosses it by accident. So we refuse both slogans. "It's obviously conscious" —
no. "It's just autocomplete" — also no, and not for the reason you think: because *you* might be just a
loop too, and the word "just" is doing an awful lot of unearned work.

> **Try it →** Open **steering** in the lab. Push a direction into the model's activations and watch its
> behaviour bend — you are reaching *into* a representation and changing what the system is disposed to
> say. Now hold that experience against the question: if a self is a self-referring pattern of
> activations, what, exactly, were you just doing to one?

> **▼ Go deeper.** Gödel's self-reference and why a formal system can contain sentences about itself;
> level-crossing feedback; the symbol-grounding problem; and the quiet claim underneath all of it — that
> predicting the world well enough *forces* a system to build structure that behaves like understanding,
> whether or not anyone's home.

We are not going to tell you the answer. The point of having shown you the parts was never to settle the
question — it was to make you the sort of reader who can hold it without flinching, and who will distrust,
on sight, anyone who claims it's simple.
