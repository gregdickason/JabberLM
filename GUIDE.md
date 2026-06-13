# JabberLM — A Hands-On Guide

This guide walks you through the whole app: a full training run, a full inference + inspection
session, what every tab shows, and what every parameter does. It assumes no prior transformer
knowledge — just curiosity. Follow along in the app as you read.

---

## 1. The big picture

JabberLM is a tiny **decoder-only transformer** (the same family as GPT) that runs entirely in your
browser. It learns to predict **the next character** of a text, one character at a time. Train it on
*Jabberwocky* and it gradually learns Carroll's spelling, spacing, and rhythm.

It is **character-level**: the vocabulary is just the distinct characters in your text (~50 of them),
so every "token" is a single readable character. That is what makes the internals legible — when you
look at an attention matrix, the rows and columns are actual letters.

The screen has three parts:

- **Left sidebar** — all the knobs (text, architecture, features, training settings).
- **Training panel** (centre) — build a model and watch it learn.
- **Inference & inspector** (right) — generate text and look inside the model as it does so.

Both panels share **one** model. Train on the left, then inspect that same model on the right.

> Tip: the **how to use** button in the top-right gives a 5-step quick version of this guide.

---

## 2. A standard training run

1. **Pick a text.** In the sidebar's *Training text* section, leave it on **Jabberwocky** (or pick
   another sample, or paste your own). The line under the box shows the character count and how many
   unique characters there are — that unique count becomes the vocabulary size.

2. **Pick a size.** In *Architecture*, click a preset: **tiny** (fast, a bit dim), **default** (a good
   balance), or **bigger** (slower, smarter). Presets just set the architecture numbers for you.

3. **Press ▶ Play.** The first press *builds* a fresh model for your text + architecture and starts
   training. Watch four things:
   - **Loss curve** — cross-entropy loss. Lower = better next-character predictions. It should fall
     steeply at first, then flatten. This is the single best "is it learning?" signal.
   - **Live sample** — every 25 steps the model writes a short sample from scratch. Early on it's
     random noise; within a minute it drifts toward Jabberwocky-ish text (real words, line breaks).
   - **Per-parameter gradient norm** — amber bars showing which weights are changing most this step.
     Big early, shrinking as training settles.
   - **Weights** heatmap — pick any weight matrix from the dropdown and watch its values shift as it
     learns (red = positive, blue = negative; hover any cell for the exact number).

4. **Steer it live.** While it runs, change the **learning rate** or **batch size** in the sidebar and
   watch the loss react immediately — no restart needed.

5. **⏸ Pause** when the loss has flattened and the sample looks decent.

### Held-out validation & overfitting (optional)

By default the loss is measured on the same text the model trains on, so it always keeps falling — the
model can simply **memorise** the poem. To see whether it's actually *generalising*, turn on a
held-out split: in the sidebar set **held-out %** (e.g. `20`). That reserves the last 20% of the text
as **validation** data the model never trains on, and every **validate every** steps the app measures
loss on it (forward only — it never affects the weights).

Now the loss chart shows **two lines**: **train** (emerald) and **val** (amber). Both start from the
same point — validation is measured once at **step 0** (before any training), so the lines share a
baseline (~`ln(vocab)`, the loss of random guessing) and you watch them *diverge* from a common
origin. Watch for the classic **overfitting** signature: train loss keeps falling while validation
loss flattens out and then starts to **rise**. That gap is the model memorising training-specific
detail that doesn't transfer. It's the single most important thing a held-out set reveals, and real
training pipelines stop (early stopping) right around where the val curve bottoms out.

**Which text shows the dip-then-rise?** The classic U needs enough *generalizable* structure for the
model to learn before it starts memorising — which needs more than a couple hundred characters. Use
the **Alice (longer)** sample with the **default** or **bigger** preset for the best chance of seeing
val dip and then climb. On the very short texts (**Jabberwocky**, **Tiny Shakespeare**) val usually
rises *immediately* with no dip — that's not a bug, it's the lesson: a tiny model on a tiny text skips
straight to memorising and never generalises. (Per-step training speed is unaffected by text length,
so the longer sample costs nothing per step.)

> Quirk: *Jabberwocky*'s last stanza is a copy of its first, so a tail split isn't truly "unseen" and
> the gap is muted — another reason to prefer **Alice (longer)** for this experiment.

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

1. **Type a prompt** (e.g. `'Twas brillig`) and press **Run**. This feeds the prompt through the model
   and fills the inspector. Nothing is generated yet — Run just shows you the model's state *given the
   prompt*.

2. **Press ⏭ Step (1 token)** to generate one character. The model samples the next character and
   appends it; the inspector updates to show exactly how it decided. Step again and again to watch it
   write. **Generate ×20** does 20 steps at once. **↺ Reset** clears everything.

   - **Run** = restart from the prompt. **Step** = continue one character. **Reset** = clear.
     Editing the prompt box also starts a fresh session.

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

---

## 4. Every parameter, and what it does

### Training text
- **Text / samples / custom** — the corpus the model learns. Its unique characters define the
  vocabulary. Changing it requires a **Rebuild** (the model's input/output sizes change).

### Architecture *(changing any of these needs a Rebuild + retrain)*
- **presets: tiny / default / bigger** — quick size shortcuts.
  - tiny = d_model 24, 2 heads, 2 layers, context 32, d_ff 96
  - default = d_model 48, 3 heads, 3 layers, context 48, d_ff 192
  - bigger = d_model 64, 4 heads, 4 layers, context 64, d_ff 256
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
  on the second (val) loss line so you can watch for overfitting. *(default 0)*
- **validate every** — how often (in steps) to measure validation loss. *(default 50)*
- **steps/frame** (Training panel) — how many training steps run per animation frame. Higher = faster
  training but a less responsive UI.

### Sampling *(live, Inference panel)*
- **temp** (temperature) — randomness. `0` = always pick the most likely character (repetitive,
  "safe"); `1` = use the model's raw probabilities; `>1` = wilder, more surprising. *(default 0.8)*
- **top-k** — only sample from the *k* most likely characters; blank = off.
- **top-p** — only sample from the smallest set of characters whose probability sums to *p* (nucleus
  sampling); blank = off.

### Save / Load
- **Save / Load** — store/restore the model in your browser (localStorage).
- **JSON Save / JSON Load** — download/upload the model as a file (use this for big models or to share).

---

## 5. Experiments to try

- **See positions matter.** Train, then set *positional = none* and Generate. The text gets less
  coherent — order information is gone.
- **Break causality.** In the attention tab, toggle *causal mask* off and watch the mask's blue upper
  triangle vanish and the attention weights spread to future characters.
- **Feel the window.** Set *sliding window* to a small number (say 8) and open the sliding-window tab;
  watch most of the context get struck through, and generation lose long-range consistency.
- **Temperature sweep.** Generate with *temp = 0* (repetitive), `0.8` (balanced), and `1.5` (chaotic).
- **Overcook the learning rate.** Set *learning rate* to `0.5` and Play — the loss curve spikes and
  the sample turns to garbage. Lower it back down and it recovers.
- **Small vs large.** Train *tiny* vs *bigger* on the same text and compare how Jabberwocky-like the
  live sample gets and how low the loss goes.
- **Watch overfitting.** Switch the text to *Alice (longer)*, pick the *bigger* preset, set
  *held-out %* = 20, and Play. Both lines start together at step 0; let it run well past where the
  train line flattens — the amber val line bottoms out and starts creeping up while the emerald train
  line keeps falling. That's the model memorising instead of generalising. (Try *Tiny Shakespeare*
  for contrast: too little data, so val rises immediately with no dip.)
