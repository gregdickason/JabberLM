# JabberLM — A Hands-On Guide

This guide walks you through the whole site: a full training run, a full inference + inspection
session, what every tab shows, what every parameter does, and a walkthrough of each of the other
pages. It assumes no prior transformer knowledge. Follow along in the app as you read.

Sections 1-5 cover the playground. Sections 6-10 cover the other pages, one section each. Section 11
covers embedding any demo in your own teaching material.

---

## 1. The big picture

JabberLM is a tiny **decoder-only transformer** (the same family as GPT) that runs entirely in your
browser. It learns to predict **the next character** of a text, one character at a time.

**It opens with a model already trained for you.** On first visit the app loads a bundled
pre-trained **"three-skill" model** (see below) so you can generate text and look inside it straight
away, with no waiting. Use the **Poem / Sort / Solve** example chips in the Inference panel to try
each skill. You can also build and train your own from scratch on the left, and flip back to the
built-in one any time with **Load built-in model**.

It is **character-level**: the vocabulary is just the distinct characters in your text (~20–80 of
them), so every "token" is a single readable character. That is what makes the internals legible —
when you look at an attention matrix, the rows and columns are actual letters.

> **The built-in model does three things — and the contrast is the whole point.** It's one tiny
> network (**~90K parameters**, the *default* preset) trained at once on poems, algebra, and sorting:
> - **Poems** → it *memorised* a style and generates more of it.
> - **`7x + 2 = 16 => …`** → it produces fluent, confident, **wrong** working. At this size it can't
>   actually learn the arithmetic — a live picture of an LLM **hallucination**.
> - **`sort 6 9 2 => 2 6 9`** → it really *sorts*, and **generalises to vectors it never saw**
>   (~89% correct). This one is genuine learned *reasoning*, and it appears suddenly partway through
>   training (a **grokking** jump) — try training it yourself and watch the sort accuracy leap.
>
> Memorisation, hallucination, generalisation — in one model you can open up. It was trained in about
> **30 minutes** of plain single-threaded JavaScript on a laptop (no GPU).

The screen has three parts:

- **Left sidebar** — all the knobs (text, architecture, features, training settings).
- **Training panel** (centre) — build a model and watch it learn.
- **Inference & inspector** (right) — generate text and look inside the model as it does so.

Both panels share **one** model. Train on the left, then inspect that same model on the right.

> Tip: the **how to use** button in the top-right gives a 5-step quick version of this guide, and
> **✨ Guide me** runs an interactive tour.

### The rest of the site

Six more pages sit behind the header links. Each has its own section below.

| page | what it is | section |
|---|---|---|
| **New to AI** (`explain.html`) | a no-maths explainer for people who *use* AI at work | [6](#6-new-to-ai--explainhtml) |
| **How it works** (`learn.html`) | one example followed through a real model, step by step | [7](#7-how-it-works--learnhtml) |
| **Tools & agents** (`harness.html`) | a model that calls tools, loops, gets hijacked, and reasons | [8](#8-tools--agents--harnesshtml) |
| **Lab** (`lab.html`) | thirteen interpretability and training demos | [9](#9-the-lab--labhtml) |
| **Capstone** (`capstone.html`) | two agents you play with, then look inside | [10](#10-the-capstone--capstonehtml) |
| **For teachers** (`teachers.html`) | session plans and embeddable demos | [11](#11-teaching-with-it--teachershtml) |

The site's arc runs: memorise → hallucinate → generalise → use tools → loop → agent.

---

## 2. A standard training run

1. **Pick a text.** In the sidebar's *Training text* section, choose a sample (or paste your own):
   - **Jabber Poems** — Jabberwocky + ~100 more in the same style; the model learns the *style* and
     generalises (this is the "language model" flavour).
   - **Sorting** — examples like `sort 6 9 2 => 2 6 9`. The model learns a real, generalising
     procedure, with a visible **grokking** jump.
   - **Equations** — worked single-variable algebra (`7x + 2 = 16 => …`). A tiny model learns the
     *format* but never the arithmetic — the **hallucination** lesson.
   - **Custom (all three combined, editable)** — seeds the box with poems + sorting + equations so you
     can train one model on a multi-section corpus (or replace it with your own text).

   The line under the box shows the character count and how many unique characters there are — that
   unique count becomes the vocabulary size.

2. **Pick a size.** In *Architecture*, click a preset: **tiny** (fast, a bit dim) or **default** (a
   good balance — the size the built-in model uses). Both are small enough to train live in a minute or
   two; the active preset is highlighted. (Presets just set the architecture numbers for you — you can
   still edit them by hand. Big models are shown via the pre-baked bundled models, not live training.)

3. **Press ▶ Play.** The first press *builds* a fresh model for your text + architecture and starts
   training. Watch four things:
   - **Loss curve** — cross-entropy loss. Lower = better next-character predictions. It should fall
     steeply at first, then flatten. This is the single best "is it learning?" signal.
   - **Live sample** — every so often the model writes a short sample from scratch. Early on it's
     random noise; within a minute it drifts toward text like your corpus.
   - **Per-parameter gradient norm** — amber bars showing which weights are changing most this step.
     Big early, shrinking as training settles.
   - **Weights** heatmap — pick any weight matrix from the dropdown and watch its values shift as it
     learns (red = positive, blue = negative; hover any cell for the exact number).
   - **Grokking view** (Sorting only) — when the dataset is *Sorting*, a second chart appears: accuracy
     on held-out lists the model never trained on, plus the 9 digit embeddings projected to 2-D. Watch
     the accuracy sit low, then **jump** — that's grokking.

4. **Steer it live.** While it runs, change the **learning rate** or **batch size** in the sidebar and
   watch the loss react immediately — no restart needed.

5. **⏸ Pause** when the loss has flattened and the sample looks decent.

### Held-out validation & overfitting (optional)

By default the loss is measured on the same text the model trains on, so it always keeps falling — the
model can simply **memorise** the text. To see whether it's actually *generalising*, turn on a
held-out split: in the sidebar set **held-out %** (e.g. `20`). That reserves part of the text as
**validation** data the model never trains on, and every **validate every** steps the app measures
loss on it (forward only — it never affects the weights).

The split is **representative**: instead of holding out one tail chunk, the app cuts the corpus into
~20 blocks and reserves every M-th block, so the held-out sample is spread across *all* sections of a
multi-section corpus (poems *and* sorting *and* equations), not just the end. Training windows are
kept strictly inside the training blocks, so there's no leakage.

Now the loss chart shows **two lines**: **train** (emerald) and **val** (amber). Both start from the
same point — validation is measured once at **step 0** (before any training), so the lines share a
baseline (~`ln(vocab)`, the loss of random guessing) and you watch them *diverge*. Watch for the
classic **overfitting** signature: train loss keeps falling while validation loss flattens and then
starts to **rise**. That gap is the model memorising training-specific detail that doesn't transfer —
the single most important thing a held-out set reveals; real pipelines stop (early stopping) right
around where the val curve bottoms out.

6. **Save it.** In the *model* row: **Save** keeps it in your browser; **JSON Save** downloads a file
   you can reload later with **JSON Load**. (Use single-**Step** for one batch at a time;
   **↺ Rebuild** throws the model away and starts over with fresh random weights.)

### Step Through — watch one forward pass and backprop

Press **⇄ Step Through** to pause training and open a guided, click-by-click tour of a *single*
learning step on a short input. Use **Next / Back** (or the ← → / space keys) to walk through it:

- **Forward pass** (green): tokenize the input → look up embeddings → add positions → apply the causal
  mask → for each layer, project to Q/K/V (head 0), form attention scores and weights, mix the values
  and add back to the residual stream, then the MLP → final LayerNorm → logits → softmax → the
  cross-entropy **loss**.
- **Backpropagation** (amber): starting from ∂loss/∂logits, the gradient flows *backwards* through the
  output, each layer (showing how the loss depends on head 0's attention and on a weight matrix), and
  finally into the embeddings — ending with the full token-embedding gradient the optimizer uses to
  nudge the weights.

Every number shown is the model's real value/gradient for that input (hover any cell to read it). To
keep it legible it follows **one head and one weight per layer** rather than all of them — enough to
see the whole pass end-to-end.

---

## 3. A standard inference + inspection

Now use the trained model (right panel).

1. **Type a prompt** (e.g. `'Twas brillig`, or `sort 6 9 2 => `) and press **Run**. This feeds the
   prompt through the model, fills the inspector, and writes **the first predicted character** — so the
   output already grows past what you typed. The first time, the **Step** and **Generate ×20** buttons
   pulse to show you what to do next.

2. **Press ⏭ Step (1 token)** to generate one more character. The model samples the next character and
   appends it; the inspector updates to show exactly how it decided. Step again and again to watch it
   write. **Generate ×20** does 20 steps at once (the output box auto-scrolls so you always see the
   newest text). **↺ Reset** clears everything.

   - **Run** = start from the prompt + first letter. **Step** = continue one character. **Reset** =
     clear. Editing the prompt box also starts a fresh session.

3. **Open the tabs** to look inside. Every heatmap is **hover-to-read** — move your mouse over any cell
   to see its exact value and which characters it relates to.

### What each tab shows

- **tokenize** — your text turned into integer token ids, plus the full vocabulary. Step one of any
  LLM: text → numbers.
- **embed** — each token's **embedding** vector (a learned row of numbers per character) and, if
  positions are learned, the **positional** contribution added on top. This is the vector that enters
  the first layer.
- **attention** — the heart of it. Use the little **layer/head map** on the left to choose which
  attention head to inspect, then read:
  - **Q, K, V** — the query, key, and value vectors for each character.
  - **scores = QKᵀ/√d** — how strongly each character (row) *wants* to look at each other character
    (column), before masking.
  - **attention weights** — those scores after masking + softmax: the actual mixing proportions (each
    row sums to 1). This is "who attends to whom."
  - **mask** — which positions are blocked (blue). By default a character can only look at itself and
    earlier characters (causal).
  - **head output** — the result, `attention · V`, that this head writes back.
- **residual** — follow a **single character's** vector as it flows through the network. Each block
  reads from and adds to this "residual stream." Drag the slider to pick which character to follow.
- **mlp** — the per-block feed-forward network: the vector is projected **up** to `d_ff` (the wide
  hidden activations), passed through the activation, then projected **back down**. Attention moves
  information *between* characters; the MLP does each character's individual "thinking."
- **logits** — the output end. The final vector becomes one score (**logit**) per vocabulary
  character; softmax turns those into the **next-character probability** distribution. The sampled
  character is highlighted.
- **RoPE** — (rotary positions) shows position encoded as **rotation**: coloured spokes are each
  position's angle; white dots are this head's actual rotated query components. Most visible when
  *positional = RoPE*.
- **KV cache** — the key/value cache as a grid, marking which rows are **reused** vs **recomputed** per
  step, and how much computation a cache saves (it grows ~quadratically with length).
- **sliding window** — drag the window width and watch the attention mask become a **band**: each
  character can only see the most recent *W* characters; older context (struck-through) drops out.

*(The **LoRA** tab appears only while fine-tuning — see §6.)*

---

## 4. Every parameter, and what it does

### Training text
- **Text / samples / custom** — the corpus the model learns. Its unique characters define the
  vocabulary. Changing it requires a **Rebuild** (the model's input/output sizes change).

### Architecture *(changing any of these needs a Rebuild + retrain)*
- **presets: tiny / default** — quick size shortcuts (the active one is highlighted). Live training
  stays small; both train in a minute or two.
  - tiny = d_model 24, 2 heads, 2 layers, context 32, d_ff 96 (~20K params)
  - default = d_model 48, 3 heads, 3 layers, context 48, d_ff 192 (~90K params — the built-in model)
- **d_model** — the width of every token's vector (the residual stream). Bigger = more capacity, more
  compute. *(default 48)*
- **heads** — how many independent attention heads per layer. Each can learn a different relationship.
  `d_model` must divide evenly by heads. *(default 3)*
- **layers** — how many decoder blocks are stacked. Deeper = can learn more abstract patterns.
  *(default 3)*
- **context len** — the most characters the model can attend over at once. *(default 48)*
- **d_ff** — width of the MLP's hidden layer, usually 4× d_model. *(default 192)*
- **activation** — the MLP nonlinearity: **gelu** (smooth, default) or **relu** (hard zero for
  negatives).
- **weight tying** — reuse the input embedding matrix as the output projection. On by default; saves
  parameters and usually helps.

### Features *(live — no rebuild)*
- **positional** — how the model knows character order:
  - **learned** — a trained position vector added to each token (default).
  - **RoPE** — rotary embedding; rotates Q/K by position (see the RoPE tab).
  - **none** — no position info (the model becomes order-blind — try it to see it break).
- **causal mask** — when on (default), a character can only attend to itself and earlier ones — this
  is what makes it a *generator*. Turn it off to let every position see the whole sequence and watch
  the attention matrix fill its upper triangle.
- **sliding window** — blank = full context. Set a number *W* to limit each character to the last *W*
  characters (see the sliding-window tab).
- **KV cache (infer)** — toggles the inference-time cache demonstration (see the KV-cache tab). Results
  are identical; it's about *work saved*, not output.

### Training *(live)*
- **optimizer** — **AdamW** (adaptive, fast, default) or **SGD** (plain gradient descent — slower,
  more sensitive to learning rate).
- **learning rate** — step size for weight updates. Too low = crawls; too high = loss spikes/diverges.
  *(default 0.01)*
- **batch size** — how many text windows are averaged per step. Bigger = smoother but slower steps.
  *(default 16)*
- **grad clip** — caps the gradient size to keep training stable; blank = off. *(default 1.0)*
- **held-out %** — fraction of the text reserved for validation (never trained on); `0` = off. Turns
  on the second (val) loss line so you can watch for overfitting. Spread representatively across the
  corpus (see §2). *(default 0)*
- **validate every** — how often (in steps) to measure validation loss. *(default 25)*
- **steps/frame** (Training panel) — how many training steps run per animation frame. Leave **auto
  speed** on and it self-throttles to keep the UI smooth.

### Sampling *(live, Inference panel)*
- **temp** (temperature) — randomness. `0` = always pick the most likely character (repetitive,
  "safe"); `1` = use the model's raw probabilities; `>1` = wilder, more surprising. *(default 0.8)*
- **top-k** — only sample from the *k* most likely characters; blank = off.
- **top-p** — only sample from the smallest set of characters whose probability sums to *p* (nucleus
  sampling); blank = off.

### Save / Load
- **Save / Load** — store/restore the model in your browser (localStorage).
- **JSON Save / JSON Load** — download/upload the model as a file (use this to share, or to keep a
  fine-tuned model).
- **Load built-in model** — drop the bundled pre-trained **three-skill** model (poems + sorting +
  equations) back in at any time (this is also what loads automatically on first visit).

---

## 5. Experiments to try

- **Watch it grok.** Pick **Sorting** + **tiny** (or **default**) and Play. The grokking chart's
  held-out accuracy sits near zero for a while, then suddenly leaps — the model stops guessing and
  learns the *rule*. The 9 digits also slide into a "number line." (Or hit **✨ Guide me** for the
  guided version.)
- **Watch it hallucinate.** Pick **Equations** and Play, or just ask the built-in model
  `7x + 2 = 16 => ` in Inference. It writes confident, fluent, wrong working — it learned the *shape*
  of algebra, not the arithmetic. Size doesn't fix this at these scales.
- **Specialist vs generalist.** Train **tiny** on **Sorting** only, and separately **default** on
  **Custom** (all three combined), both with *held-out % = 20*. The specialist reaches high sort
  accuracy fast; the generalist splits its capacity across three skills, so it takes noticeably longer
  to match it *on sorting*. Capacity is a budget you either concentrate or spread.
- **See positions matter.** Train, then set *positional = none* and Generate. The text gets less
  coherent — order information is gone.
- **Break causality.** In the attention tab, toggle *causal mask* off and watch the mask's blue upper
  triangle vanish and the attention weights spread to future characters.
- **Feel the window.** Set *sliding window* to a small number (say 8) and open the sliding-window tab;
  watch most of the context get struck through, and generation lose long-range consistency.
- **Temperature sweep.** Generate with *temp = 0* (repetitive), `0.8` (balanced), and `1.5` (chaotic).
- **Overcook the learning rate.** Set *learning rate* to `0.5` and Play — the loss curve spikes and
  the sample turns to garbage. Lower it back down and it recovers.
- **Find the sorting circuit.** In the **Lab** (head ablation), switch off attention heads one at a
  time and watch which one breaks *sorting* while poems carry on — a hands-on look at specialisation.

---


## 6. New to AI — `explain.html`

Ten sections, no maths. Several run on real precomputed data rather than the in-browser model: the
token splits come from OpenAI's `cl100k_base` tokenizer, and the word vectors are a 1,429-word slice
of GloVe. Nothing on the page requires you to train anything.

Walk it in order. The sections build on each other.

1. **It predicts the next piece of text.** The bundled model's probability for every possible next
   character, given what you typed. Type a few characters of a poem line and watch the distribution
   sharpen. This is the whole objective: one distribution over the next token, sampled, appended,
   repeated.
2. **Why the same question gives different answers.** Two runs side by side. Run A is temperature 0
   and identical every click. Run B uses your temperature and a fresh seed. Variation is a sampling
   choice, not a property of the weights.
3. **What it can see, and why it forgets.** Highlights which earlier characters the model attended to
   when predicting the next one. Attention outside the context window is not weak — it does not exist.
4. **Why it makes things up.** The model produces fluent output whether or not it has anything real to
   say. Ask the bundled model for algebra working and read the answer: the form is right, the
   arithmetic is invented.
5. **Tokens, and why letters trip it up.** The pivotal demo for a general audience. `strawberry` is
   **three** tokens to GPT-3.5/4 — `str`, `aw`, `berry` — and **ten** to a character-level model. A
   model that never sees individual letters is guessing when you ask it to count them. Same cause for
   multi-digit arithmetic and string reversal.
6. **Words as coordinates.** Nearest neighbours by cosine similarity, live analogies
   (`king − man + woman ≈ queen`, 0.86), and a 2-D projection of the 50-dimensional vectors. Meaning
   is stored as direction.
7. **Giving it real facts — retrieval (RAG).** A tiny document store the model was never trained on.
   Exact lookup, then semantic retrieval over the same GloVe vectors, then a knowledge graph that
   answers multi-hop questions flat chunk retrieval cannot compose.
8. **What it costs to run.** Text in, tokens out, an illustrative price, and how it scales with answer
   length and volume.
9. **Inference economics.** Three demos measuring real in-browser generation speed: model size against
   latency, KV-cache prefill against recompute, and a specialist model against a generalist doing the
   same job. The quantisation sweep runs here too — 32-bit down to 2-bit on the bundled sort model,
   re-measuring accuracy at each step. The curve holds to 4-bit and collapses at 3.
10. **What you can't see.** The questions to ask a vendor, and which of them the demos above have just
    shown you how to answer.

## 7. How it works — `learn.html`

One example, followed through a real model, in eleven steps. The page uses the bundled three-skill
model, so every matrix shown is a matrix that model actually holds.

The steps in order:

1. **One token's journey** — the map of what follows.
2. **Text becomes numbers.** Character-level tokenization. The vocabulary is the distinct characters
   in the training text.
3. **Each number becomes a vector.** The embedding table. One row per vocabulary entry.
4. **Letting tokens look at each other.** Attention. Q, K and V for the example prompt, the
   attention matrix, and the causal mask that stops a position seeing the future.
5. **Each token does its own thinking.** The MLP.
6. **Turning the last vector into a guess.** Logits, then softmax.
7. **How it learns** — the loss and the gradient step.
8. **Loss, gradients, and held-out data.** Why the held-out curve is the one that matters.
9. **Grokking.** Held-out accuracy sits flat, then leaps. The digits arrange themselves into a
   number line as it happens — the internal change that makes the external jump.
10. **Scale and practicalities.**
11. **Bigger models, emergent features, and fine-tuning.**

Read section 9 twice. The number line is the clearest evidence on the site that a model builds
structure nobody asked it for: nothing in the training data says 2 is between 1 and 3.

## 8. Tools & agents — `harness.html`

The model on this page is ~88K parameters, trained on lines of the form
`instruction => tool(args) = result`. It never learns arithmetic. It learns to name a tool.

**§1 — one call.** Type `total of 6 9 2` and press Run. Three stages appear: the model emits
`sum(6 9 2) = 16`, the harness parses the call, and the harness runs the real JavaScript `sum` and
gets `17`. Untick **use the harness** and the answer becomes `16` — the model's own guess, wrong. The
same weights are right or wrong depending on whether a tool ran. Execution is what a harness makes
authoritative.

**§2 — the harness has to be robust.** Click *Simulate a flaky model* to feed the harness garbled
output: a missing bracket, a mistyped tool name, missing arguments, a valid call buried in chatter. It
recovers or refuses; it never runs a bad call.

**§3 — the loop.** Ask for `sort 6 9 2 then reverse it`. The harness runs `sort`, feeds `2 6 9` back
into the context, and the model reads that result and emits `reverse(2 6 9)`. Two steps, then `done`.
A single call is function calling. The loop is what makes it an agent.

**§4 — prompt injection.** The same two-step job, but the first tool's result is attacker-controlled.
The naive loop reads the planted text as its next instruction and calls the wrong tool. The mitigation
treats tool output as untrusted typed data — digits only — which defeats the tool switch and does
**not** defeat a poisoned value. An agent cannot distinguish data from instructions. Consequential
actions need authorisation, not just sanitisation.

**§5 — reasoning in a loop.** A different model, 90K parameters, taught exactly 200 facts: the
addition table, in the form `add 8 1 0 => 9 0`. Enter two numbers and it runs three ways at once.
Asked for the whole answer in one pass, it is wrong at every width. Asked to show its working, it is
wrong past four digits — writing "the third digit from the right" requires positional counting, which
this architecture is worst at. Asked one column at a time, with the harness holding the carry, it is
correct at 4, 6, 10, 15 and 25 digits. The model does every sum. The harness does no arithmetic at
all; it slices columns and remembers the carry.

**§6 — where this leaves you.** The harness did three separable jobs on this page: it checked output,
it ran tools, and it held state. Most systems need all three.

## 9. The lab — `lab.html`

Thirteen tabs, grouped into four themes. Each is addressable: `lab.html?tab=head-ablation` opens that
tab directly. Sections that train do so live, on the main thread, and stop themselves when the
held-out curve converges.

**Observe.**

- **Neurons** — individual MLP activations across a text, and what makes each one fire.
- **Attention heads** — every head's attention matrix for a prompt you type.
- **Dictionary (SAE)** — a sparse autoencoder trained on the residual stream, decomposing activations
  into features. At this size the features are low-level: spaces, letter pairs, capitals.

**Intervene.**

- **Head ablation** — zero a head's output and re-measure two skills. The bundled model does three
  things; ablating a middle-layer head collapses sorting while poems continue. Ablating a layer-0 head
  breaks everything, because the first layer is shared.
- **Injury & recovery** — ablate the critical head, then retrain with it still switched off. The skill
  comes back as other heads take over. Re-scanning afterwards shows the critical head has moved.
- **Steering** — clamp a direction into the residual stream and watch the output bend.

**Adapt.**

- **Distillation** — the bundled sort model as a teacher, a smaller student trained on the teacher's
  full probability distribution rather than hard labels. The student reaches the teacher's accuracy
  and groks 2-3× faster than an identical student trained on labels.
- **LoRA fine-tuning** — the sorting model sorts ascending at ~97%. Freeze all 87,456 parameters,
  attach a rank-8 adapter of 10,368 weights (~12% of the base), and train only the adapter on
  descending sort. The overlay checkbox flips the output between `2 6 9` and `9 6 2`. With the overlay
  off, ascending accuracy is untouched, because the base never moved. `ΔW = A·B` starts blank and
  fills in as you train.
- **Forgetting** — teach the model a second verb two ways. Plain fine-tuning on the new task collapses
  the old one from ~96% to ~4%. Adding a self-distillation loss against a frozen snapshot of the old
  model keeps both.
- **Reward learning (RLVR)** — a brief supervised warm-up to ~55%, then policy-gradient training that
  climbs past 90% from a verifier's yes/no alone. No labelled answers.

**Scale & serve.**

- **Mixture of experts** — four expert FFNs and a gate. Training is dense; inference can be sparse
  top-k. The gate's routing is visible per token.
- **Advanced grokking** — the delayed-generalisation jump, with train and held-out curves side by
  side.
- **Speculative decoding** — a 17K draft model proposes K tokens, a 90K target verifies all K in one
  forward pass. Greedy decoding makes the output bit-for-bit identical to running the target alone,
  with ~2.3× fewer target forward passes at K=4.

## 10. The capstone — `capstone.html`

Two agents. Play them, then look inside them.

**Tic-tac-toe.** A ~130K-parameter character model plays you. The board is index-labelled
(`0X1O2.…`), so choosing a move is copying an empty cell's index rather than counting positions. The
model was trained by distilling a minimax oracle's per-cell values into a soft policy.

Two bundles ship, identical in architecture and parameter count, differing only in training budget:

| | legal moves | optimal | blocks | vs random |
|---|---|---|---|---|
| undertrained (100 steps) | 40% | 24% | 18% | 64% not-lost |
| well-trained | ~100% | 98% | 92% | never loses |

Play the undertrained one first. Its top pick is an already-occupied cell in 60% of positions, so the
harness legal-move check fires on most turns: it rejects the move, re-asks the model, and shows the
retry chain. Untick the check and the illegal move stands — the game jams. The harness contains no
game intelligence. It checks legality and nothing else.

Then switch to the well-trained model and watch the check go quiet. A better model needs the guard
less. It still never becomes optional: the exhaustive proof finds nine losing lines for the
well-trained model as O, at 98% optimal play.

**The inspector.** The same interpretability tools from the lab, projected onto the board. Attention
per head at the move-decision position, ablation of a head, and an SAE. Switch between the two models
on a board where you threaten to win: mean attention on the threatened cell is 0.20 for the
undertrained model and 0.79 for the well-trained one, across all 1,484 must-block positions. That
difference is the mechanism behind 18% blocking becoming 92%.

**The warehouse.** A ~24K-parameter agent packs orders of one to three SKUs. Packing is relational: a
fragile item needs padding only if a heavy item shares the basket, and a chemical goes in box 2 only
if food shares it. Correct action requires attending across the whole order, which is the honest
reason to use a transformer. No SKU's attribute is ever a token — the model infers it. The concept map
projects the learned SKU embeddings to 2-D, where they cluster by the attribute nobody labelled.

## 11. Teaching with it — `teachers.html`

Session plans, a per-page "moment to point at", and the embed reference.

Any demo can be lifted out of its page and dropped into a course site, wiki, LMS page or deck as one
iframe:

```html
<iframe src="https://jabberlm.com/embed?demo=adder"
        width="100%" height="1080" style="border:0"></iframe>
```

Ten demos are embeddable: `tictactoe`, `harness-tools`, `agent-loop`, `prompt-injection`, `lora`,
`tokenizer`, `embeddings`, `adder`, `head-ablation`, `warehouse`. Add `&scale=1.6` to enlarge
everything for a lecture theatre. The frame carries no navigation and no teaching copy — the host page
supplies the words. Each demo has a written lesson on the teachers page covering what the model is,
what is being tested, and how to walk a class through it.

Everything runs in the visitor's browser. No accounts, no API keys, no per-student cost, and nothing
leaves the machine.
