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
- **Prose chapters (site doesn't demo these):** real-world tokenization (BPE), the pretraining→SFT→RLHF
  pipeline, prompting/context engineering, embeddings/RAG, evaluation of generative models, prompt
  injection & jailbreaks, scaling laws/emergence. Multimodality = out of scope for v1.
- **Apparatus gaps:** glossary artifact, exercises/solutions, guided capstone, a figure/stat pipeline
  (numbers sourced from `src/data/modelStats.ts` so book and site never disagree).

---

## Chapter outline (5 parts)
Each chapter = objective ("after this you can…") · plain spine · **Try it →** (site anchor) ·
**▼ Go deeper** · exercise.

**Part I — What a language model is**
1. *The autocomplete that ate the world* — next-token prediction. Try: `explain §1`. Deeper: softmax/probability.
2. *Words into numbers* — tokens & embeddings; char vs BPE. Try: playground tokenize/embed, `learn` Act 1. Deeper: embedding vectors, the number line.
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

**Part III — Looking inside (interpretability)**
8. *Opening the black box* — neurons, heads, specialisation. Try: `lab` neurons/heads/head-ablation. Deeper: induction heads, polysemanticity.
9. *Cleaner concepts* — dictionary learning (SAE) & steering. Try: `lab` SAE + steering. Deeper: superposition, sparse autoencoders.
10. *Many brains in one* — Mixture of Experts. Try: `lab` MoE. Deeper: gating, sparse top-k, dense-train.

**Part IV — From model to product**
11. *New tricks* — fine-tuning & LoRA; and (prose) instruction-tuning/RLHF. Try: playground LoRA. Deeper: low-rank ΔW; pretraining→SFT→RLHF *(site gap)*.
12. *Talking to it well* — prompting & context engineering *(new; site gap)*. Try: context/attention demos. Deeper: few-shot, system prompts.
13. *Giving it tools* — function calling & the harness; reliability. Try: `harness` §1–2. Deeper: tool schemas, validation.
14. *Agents — and their risks* — the loop; prompt injection. Try: `harness` agent loop. Deeper: multi-step planning, injection/guardrails *(site gap)*.
15. *What you can't see, and what to ask* — governance, evaluation, safety, cost. Try: `explain` governance + cost suite. Deeper: evals, alignment.
**Capstone (end of Part IV):** *Build your own* — train a mini-model, then a 2-tool agent, on the site.

**Part V — Intelligence (the strange loop)** — the finale; philosophy *earned* by everything above.
Prose-led but anchored to mechanisms the reader has *seen* (grokking/number-line = emergence; the agent
loop = a literal feedback loop; steering/ablation = reaching into a representation).
16. *Emergence* — from the number line and the grokking jump to scaling and emergent abilities. Try: revisit `lab` grokking with new eyes. Deeper: phase changes, why prediction pressure builds world-structure.
17. *The strange loop* — self-reference and feedback; the agent loop pointed back at itself; **Hofstadter, *I Am a Strange Loop***. Try: `harness` agent loop as feedback; steering as intervening on a self-representation. Deeper: level-crossing feedback, Gödelian self-reference.
18. *Prediction or understanding?* — "it's just autocomplete" vs "so, arguably, are you"; Chinese Room, symbol grounding, argued with mechanisms in view. Deeper: representation vs computation.
19. *What we can — and can't — claim* — consciousness, the self as a pattern, the honest open questions; a reflective close that hands the reader judgement, not answers.

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
- **Voice test first** (below): Ch 1 full + Ch 17 sketch, to prove one voice carries both registers.

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

## Chapter 17 — The strange loop *(sketch)*

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
