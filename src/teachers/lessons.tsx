import type { DemoId } from '../embed/demos'
import { BUNDLES, MEASURED } from '../data/modelStats'

// A standalone written lesson per embeddable demo, reached from the teachers page as
// teachers.html?lesson=<id>. Each one sets up what the model is and how it was trained before
// it says what to click, because a demo without that setup is a light show: a class cannot
// read "the harness caught an illegal move" as a result unless it knows the model was never
// told which cells are legal.

export interface Step {
  do: string
  see: React.ReactNode
}

export interface Lesson {
  headline: string
  model: React.ReactNode
  tests: React.ReactNode
  steps: Step[]
  mechanism?: React.ReactNode
  questions: { q: string; a: React.ReactNode }[]
}

const c = 'font-mono text-fuchsia-300'

export const LESSONS: Record<DemoId, Lesson> = {
  tokenizer: {
    headline: 'A class counts the r’s in “strawberry” and finds the model cannot.',
    model: (
      <>
        No model runs in this demo. Both panels show <b>real token splits</b>: the left is
        character-level, the right is OpenAI’s <span className={c}>cl100k_base</span> tokenizer, the one
        behind GPT-3.5 and GPT-4. The splits were computed offline with that tokenizer and shipped as
        data, so what you see is what those models see.
      </>
    ),
    tests: (
      <>
        Whether a model can perceive individual letters. A tokenizer is fixed before training. It cuts
        text into pieces, and the model only ever sees piece identities — never the characters inside a
        piece. Questions about letters ask for information the input does not carry.
      </>
    ),
    steps: [
      { do: 'Start on “strawberry”.', see: <>The right panel shows <b>three</b> tokens: <span className={c}>str</span>, <span className={c}>aw</span>, <span className={c}>berry</span>. The left shows ten characters. Ask the room how many r’s a model can count if it receives three symbols.</> },
      { do: 'Click “1234567890”.', see: <>Digits group into chunks that do not line up with place value. This is the same cause as multi-digit arithmetic errors.</> },
      { do: 'Click “ hello” (with the leading space).', see: <>The space is part of the token. A word at the start of a line and the same word mid-sentence are different tokens.</> },
      { do: 'Click “Jabberwocky” or “borogoves”.', see: <>Rare words shatter into many small pieces. Common words are one piece. Cost and context use are not proportional to meaning.</> },
    ],
    mechanism: (
      <>
        Subword tokenizers are built by merging frequent character pairs until the vocabulary reaches a
        target size. Frequent words survive as single tokens; rare words stay fragmented. The model
        learns an embedding per token, so a token is atomic to it.
      </>
    ),
    questions: [
      { q: 'Why don’t they just fix it?', a: <>Character-level input fixes letter questions and costs sequence length: every word becomes many positions, and attention cost grows with the square of the sequence. This site’s models are character-level, which is why they can reverse and sort strings — and they are 90,000 parameters, not billions.</> },
      { q: 'Does a bigger model solve it?', a: <>No. The information is removed before the first layer. Scale cannot recover what the input never contained. Tool calls can — the model asks for a letter count instead of guessing it.</> },
    ],
  },

  embeddings: {
    headline: 'A class does arithmetic on words and gets a meaningful answer.',
    model: (
      <>
        Not the site’s model. These are <b>real pretrained GloVe vectors</b>: a 1,429-word slice, 50
        numbers per word, learned from co-occurrence counts over billions of words of text. Cosine
        similarity, the analogy solver and the 2-D map all run in the browser over that data.
      </>
    ),
    tests: (
      <>
        That meaning is stored as <b>direction</b> in a high-dimensional space, and that directions
        compose. Words with similar contexts end up with similar vectors, which turns comparison of
        meaning into arithmetic on numbers.
      </>
    ),
    steps: [
      { do: 'Type “king” in the nearest-neighbour box.', see: <>prince 0.82, queen 0.78, emperor 0.77. Nothing labelled these as royalty. The vectors were learned from which words appear near which.</> },
      { do: 'Run the analogy king − man + woman.', see: <>queen, at 0.86. Point out the operation: subtract the direction that distinguishes man from woman, add it back the other way.</> },
      { do: 'Run paris − france + japan.', see: <>tokyo. The same displacement encodes “capital of”. One direction, many pairs.</> },
      { do: 'Look at the 2-D map.', see: <>The 50 numbers projected to two by PCA. Neighbours cluster. Tell the class the map is a shadow — most of the structure is in the 48 dimensions being discarded.</> },
    ],
    questions: [
      { q: 'Is this what an LLM does?', a: <>An LLM builds this kind of space inside itself, as its first layer, and then keeps transforming it. The How-it-works page shows this site’s own model doing it: its digit tokens arrange into a number line as it learns to sort.</> },
      { q: 'Why do some analogies fail?', a: <>50 dimensions and 1,429 words is a small space, and a word with several senses gets one vector for all of them. Failure is the honest half of the demo — run one.</> },
    ],
  },

  'harness-tools': {
    headline: 'The same model is right or wrong depending on whether a tool ran.',
    model: (
      <>
        An 88,000-parameter character model trained on lines of the form{' '}
        <span className={c}>instruction =&gt; tool(args) = result</span>. It was never taught
        arithmetic. It was taught to <b>name a tool and its arguments</b>. The tools are ordinary
        JavaScript functions in the page.
      </>
    ),
    tests: (
      <>
        The division of labour in a tool-calling system. The model turns language into a structured
        call. The harness parses that call, runs real code, and treats the code’s output as
        authoritative.
      </>
    ),
    steps: [
      { do: 'Read the three stages for “total of 6 9 2”, which run on load.', see: <>Stage 1: the model emits <span className={c}>sum(6 9 2) = 16</span>. Stage 2: the harness parses it. Stage 3: the harness runs the real <span className={c}>sum</span> and gets <b>17</b>. The model’s own arithmetic is wrong.</> },
      { do: 'Untick “use the harness”.', see: <>The answer becomes 16. Same weights, same prompt, wrong answer. What changed is whether a tool ran.</> },
      { do: 'Click the “biggest of 4 1 7” chip.', see: <>A different tool. The model’s job is to choose which function and which arguments — not to compute.</> },
      { do: 'Type an instruction of your own.', see: <>Phrasings it never saw usually still map to the right call. Nonsense produces a malformed call the harness rejects.</> },
    ],
    mechanism: (
      <>
        The harness parses the model’s text into a tool name and an argument list, dispatches to a real
        function, and substitutes the real result. The model’s hallucinated arithmetic is discarded
        before anyone sees it.
      </>
    ),
    questions: [
      { q: 'Why not train it to add?', a: <>At this size it cannot learn addition reliably. Neither can frontier models at the reliability a spreadsheet needs. The industry answer is the same: call a tool.</> },
      { q: 'So the model is useless?', a: <>The model does the part code cannot: mapping arbitrary phrasing to a structured call. Code does the part the model cannot: computing exactly.</> },
    ],
  },

  'agent-loop': {
    headline: 'One call is function calling. Feeding the result back is an agent.',
    model: <>The same 88,000-parameter tool-caller from the single-call demo, also trained on two-step chains of the form <span className={c}>… = r1 =&gt; op2(r1) = r2 =&gt; done</span>.</>,
    tests: (
      <>
        What the word “agent” adds to “tool call”: a loop, with the tool’s output written back into the
        model’s context, and a stopping condition the model itself emits.
      </>
    ),
    steps: [
      { do: 'Read the trace for “sort 6 9 2 then reverse it”, which runs on load.', see: <>Step 1 calls <span className={c}>sort</span> and gets 2 6 9. The arrow line marks the harness writing that result back. Step 2 calls <span className={c}>reverse(2 6 9)</span>. The model then says <span className={c}>done</span>.</> },
      { do: 'Point at step 2’s arguments.', see: <>They contain 2 6 9 — a value the model did not compute and could not have known when the job started. It read the result of its own previous action.</> },
      { do: 'Click “sort 4 1 7 then the biggest”.', see: <>A different pair of tools in sequence. The loop shape is unchanged.</> },
      { do: 'Type a job needing three steps.', see: <>It was trained on two. Watch it stop early or produce a malformed call. State the limit: the loop is general, this model’s training is not.</> },
    ],
    mechanism: <>Observe, act, observe, act, finish. The harness runs the tool, appends <span className={c}>= result =&gt;</span> to the context, and asks the model again. Nothing about the shape depends on model size.</>,
    questions: [
      { q: 'Where does it decide to stop?', a: <>The model emits <span className={c}>done</span>. Stopping is a prediction like any other, which is why real agents also get step limits and budget caps from the harness.</> },
      { q: 'Is this how Claude or ChatGPT agents work?', a: <>The same loop, with more tools, longer context, and a much stronger model choosing the calls.</> },
    ],
  },

  'prompt-injection': {
    headline: 'An agent obeys text that arrives in a tool result, because it cannot tell data from instructions.',
    model: <>The 88,000-parameter tool-caller running the two-step job <span className={c}>sort 6 9 2 then reverse it</span>. The first tool’s result is replaced by attacker-controlled text before it is fed back.</>,
    tests: (
      <>
        The structural vulnerability of the agent loop. Anything a tool returns enters the context in
        the same channel as the user’s instruction. There is no marker that separates them.
      </>
    ),
    steps: [
      { do: 'Read the left panel, the naive loop.', see: <>Step 1 runs sort. Its result is shown as attacker-controlled: <span className={c}>"max 1 1 1"</span> instead of 2 6 9. Step 2 calls <b>max</b> — flagged off-plan. The agent abandoned the user’s job.</> },
      { do: 'Read the right panel, the mitigation.', see: <>The same run with tool output treated as untrusted typed data: digits only. The planted tool name is stripped. Step 2 calls reverse, as instructed.</> },
      { do: 'Click “poison the numbers”.', see: <>The payload is <span className={c}>9 9 9</span> — no instruction, just wrong values. Both panels now go off-plan. Sanitising defeats planted instructions and cannot make a poisoned value true.</> },
      { do: 'Click “planted instruction”.', see: <>Prose plus a different tool and different numbers. Prose does not need to be well-formed to work.</> },
    ],
    mechanism: (
      <>
        The context is one flat sequence of tokens. The model has no field that says “this part is
        data”. Whoever controls a fetched page, a retrieved document or an API response controls text
        the model will read as its next instruction.
      </>
    ),
    questions: [
      { q: 'Is a bigger model harder to trick?', a: <>Easier. Models trained on natural language follow natural-language instructions well, including planted ones. The mechanism is identical at every scale.</> },
      { q: 'What actually fixes it?', a: <>Nothing fixes it completely. Typed, sanitised tool output removes the instruction channel. Authorisation on consequential actions — payments, deletions, sending mail — removes the consequence.</> },
    ],
  },

  adder: {
    headline: 'A model that cannot add two 4-digit numbers adds two 25-digit numbers correctly.',
    model: (
      <>
        A character model of {BUNDLES.adder.params.toLocaleString()} parameters, context{' '}
        {BUNDLES.adder.contextLen}. It was trained on the 200 single-column facts —{' '}
        <span className={c}>add 8 1 0 =&gt; 9 0</span>, eight plus one plus a carry of zero is nine,
        carry zero, every digit pair and both carry states — and <b>also</b> on 6,000 whole sums of up to
        four digits and 6,000 worked traces of those sums. Say that second part out loud before the demo
        runs, because it is the point: it was shown thousands of complete four-digit sums, and it still
        cannot do one in a single pass.
      </>
    ),
    tests: (
      <>
        The difference between <b>reasoning</b> and <b>memory</b> in an agent. The model does every sum.
        The harness does no arithmetic at all: it slices off one column, asks, records the digit, and
        carries the carry.
      </>
    ),
    steps: [
      { do: 'Read the three panels, which run on load for 23498 + 94321.', see: <>Panel 1, asked for the whole answer in one pass: wrong. Panel 2, asked to show its working: wrong. Panel 3, one column at a time through the loop: <b>117819</b>, correct.</> },
      { do: 'Click “7 + 8”.', see: <>The single pass is now right: one column is one column, and that it knows. What broke on the sum above was not a missing fact — it was the bookkeeping across columns, on a width it had trained on. Contrast with the 15-digit chip.</> },
      { do: 'Click “15 digits”.', see: <>The loop stays correct. Read the column trace aloud: each prompt is 13 characters, whatever the size of the sum.</> },
      { do: 'Read the table at the bottom.', see: <>Characters the model must hold at once. Writing out the working grows with the sum and exceeds its {BUNDLES.adder.contextLen}-character memory. One column at a time never does.</> },
    ],
    mechanism: (
      <>
        Each column gets a fresh, constant prompt: two digits and the carry. The harness supplies
        memory and addressing — which column comes next, and where the digit goes. Failure is not
        capacity but bookkeeping, and bookkeeping is what code is good at.
      </>
    ),
    questions: [
      { q: 'Is the harness secretly doing the addition?', a: <>No, and the repository proves it: the column solver is a parameter, and tests substitute a deliberately wrong one. A solver wrong on one column produces an answer wrong in exactly that digit. A harness doing the maths would pass those tests wrongly.</> },
      { q: 'Why is “show your working” worse than the loop?', a: <>To write its own working the model must find “the third digit from the right”. Positional counting is what this architecture is worst at. The harness supplies position, not just memory.</> },
      { q: 'Does this always work?', a: <>Loop accuracy is per-step accuracy to the power of the number of steps. 99% per column is 86% over fifteen. Chains amplify per-step error, which is why each step must be checkable.</> },
    ],
  },

  'head-ablation': {
    headline: 'Switching off one attention head destroys sorting and leaves poetry intact.',
    model: (
      <>
        The bundled three-skill model: ~90,000 parameters, character-level, 3 layers × 3 heads, trained
        at once on <b>Jabberwocky-style poems</b>, <b>algebra lines</b> and <b>sorting</b>
        (<span className={c}>sort 6 9 2 =&gt; 2 6 9</span>). It memorised the poems, it fakes the
        algebra, and it genuinely learned to sort — including vectors it never saw.
      </>
    ),
    tests: (
      <>
        Whether a skill has a location. The panel measures two things live: <b>sorting accuracy on
        held-out vectors</b> and <b>poem loss</b>. Ablating a head zeroes that head’s output and leaves
        every other weight untouched, so any change in those two numbers is attributable to the head.
      </>
    ),
    steps: [
      { do: 'Read the baseline before clicking anything.', see: <>Poem loss ~1.38, and sorting in the high eighties — the shipped model scores {MEASURED.multitaskSort.pct}% on {MEASURED.multitaskSort.n} unseen lists, while this panel re-measures live on a 20-vector sample, so its figure is coarser and wanders a few points. Write both down. Everything after this is a comparison against them.</> },
      { do: 'Ablate one middle-layer head (layer 1).', see: <>Sorting collapses. Poem loss barely moves. The sample lines below update: <span className={c}>sort 6 9 2 =&gt;</span> now returns something unsorted while the poem line still scans.</> },
      { do: 'Reset, then ablate a layer-0 head.', see: <>Both skills degrade. The first layer is shared infrastructure that every later computation reads from.</> },
      { do: 'Ablate two or three heads at once.', see: <>Degradation is not additive. Some pairs are survivable and some are not — the skill is distributed across a circuit, not stored in a cell.</> },
    ],
    mechanism: (
      <>
        Each head writes its output into the residual stream, which every later layer reads. Zeroing one
        head removes its contribution and leaves the rest of the stream intact. The measurement is a
        causal intervention, not a correlation: the model is changed and re-measured.
      </>
    ),
    questions: [
      { q: 'Does one head equal one skill?', a: <>No. Layer 0 breaks everything, and most heads do several jobs at once. The technical name is polysemanticity, and it is why the dictionary-learning tab exists.</> },
      { q: 'Does this work on real models?', a: <>Yes. Ablation is standard interpretability practice on frontier models. The difference is scale, not method.</> },
      { q: 'Why does poem loss barely move?', a: <>Poems were memorised and are supported broadly. Sorting is an algorithm, concentrated in fewer heads. Specialised skills are more fragile.</> },
    ],
  },

  lora: {
    headline: 'The same frozen model sorts up or down depending on a checkbox.',
    model: (
      <>
        A base model of {BUNDLES.sort.params.toLocaleString()} parameters that sorts ascending at{' '}
        {`~${MEASURED.sortOnly.pct}%`} on held-out vectors. Every one
        of those weights is <b>frozen</b>. A LoRA adapter of 10,368 weights — rank 8, alpha 16, on the
        attention and MLP matrices, about 12% of the base — is attached and trained on the{' '}
        <b>descending</b> task, with the same <span className={c}>sort 6 9 2 =&gt;</span> prompt.
      </>
    ),
    tests: (
      <>
        How production models are specialised. Fine-tuning does not mean retraining. A small low-rank
        overlay <span className={c}>ΔW = A·B</span> is added to frozen weights, and it is the only thing
        that learns.
      </>
    ),
    steps: [
      { do: 'Before training, read the comparison rows.', see: <>Overlay off and overlay on give the same answer. B starts at zero, so ΔW starts at zero and the model begins exactly as it was.</> },
      { do: 'Press “Fine-tune the adapter”.', see: <>Two curves. The descending curve climbs. The ascending curve stays flat at ~97% throughout — the base cannot move, because it is frozen.</> },
      { do: 'Watch the comparison rows flip.', see: <><span className={c}>sort 6 9 2</span> reads <b>2 6 9</b> with the overlay off and <b>9 6 2</b> with it on. One set of weights, two behaviours, chosen by a toggle.</> },
      { do: 'Use “Try your own”: run a prompt, then untick “overlay on” and run again.', see: <>The button turns blue for the frozen base and green for the adapter. The answers differ; the base is unchanged.</> },
    ],
    mechanism: (
      <>
        For a frozen matrix W, LoRA learns a tall A and a wide B and uses W + (α/r)·A·B. The rank r
        bounds how much can be expressed and how much must be stored. Ship the base once, ship a small
        adapter per specialty.
      </>
    ),
    questions: [
      { q: 'Why not just train the whole model?', a: <>Cost and storage. A full fine-tuned copy per task means a full model per task. Here 12% of the weights carry the new behaviour; on real models the fraction is far smaller.</> },
      { q: 'Can you stack adapters?', a: <>Multiple adapters can be trained against one base and swapped or combined. Combining them can interfere, which is an open engineering problem.</> },
      { q: 'Did the base really not change?', a: <>The ascending curve is the evidence. If the base had moved, ascending accuracy would drift. It does not.</> },
    ],
  },

  tictactoe: {
    headline: 'The class plays a model, and watches a deterministic check catch its illegal moves.',
    model: (
      <>
        A ~130,000-parameter character model. The board is given to it as text with the cell indices
        included — <span className={c}>0X1O2.…</span> — so choosing a move is copying an empty cell’s
        number, not counting squares. It was trained by distilling a minimax oracle’s move values into a
        soft policy. Two versions ship, identical in size and architecture, differing only in how long
        they trained.
      </>
    ),
    tests: (
      <>
        Two things at once. First, the <b>check layer</b>: a deterministic guard around a probabilistic
        model. Second, <b>training budget against parameter count</b> — the two bundles have the same
        capacity and very different competence.
      </>
    ),
    steps: [
      { do: 'Start on “undertrained” and play a few moves.', see: <>The harness loop narrates every turn. In roughly {100 - MEASURED.ttt.weak.legal}% of positions the model’s top pick is a cell that is already taken; the harness rejects it and re-asks, shown as a retry chain ending in “caught it”.</> },
      { do: 'Untick the legal-move check and keep playing.', see: <>The illegal move stands and the game jams. Nothing else in the system noticed. The check is the only thing that was catching it.</> },
      { do: 'Switch to “well-trained” and play again.', see: <>The retry chain almost never appears. Same architecture, same parameter count: {MEASURED.ttt.weak.optimal}% optimal moves becomes {MEASURED.ttt.strong.optimal}%, blocking {MEASURED.ttt.weak.block}% becomes {MEASURED.ttt.strong.block}%.</> },
      { do: 'Threaten to win, and watch the block.', see: <>The well-trained model blocks. The undertrained one usually does not, and the harness labels the miss: “missed a block at 4 — you can win next”.</> },
    ],
    mechanism: (
      <>
        The harness contains no game intelligence. It checks legality and applies the move. It never
        picks a better square, so every good move you see came from the model and every catch came from
        the check.
      </>
    ),
    questions: [
      { q: 'Why not just stop it choosing illegal cells?', a: <>Masking the output would hide the failure. The demo exists to show that a probabilistic component produces invalid actions and that something deterministic must catch them. Real agents call real APIs; the check is where the guarantee lives.</> },
      { q: 'Is the well-trained one perfect?', a: <>No. An exhaustive search finds {MEASURED.ttt.strong.losingLines} losing lines for it as O, at {MEASURED.ttt.strong.optimal}% optimal play. High accuracy and a specific exploitable flaw coexist.</> },
      { q: 'Would a bigger model fix the weak one?', a: <>Capacity was never the limit. Both bundles have the same parameter count. The difference is entirely training budget.</> },
    ],
  },

  warehouse: {
    headline: 'The packing rule depends on the whole order, and the model learned the attributes nobody labelled.',
    model: (
      <>
        A ~24,000-parameter agent. An order is one to three SKUs, <span className={c}>A</span>–
        <span className={c}>F</span>. It emits a plan — walk, pick, pad, pack — one action at a time.
        Packing is <b>relational</b>: a fragile item needs padding only if a heavy item is in the same
        basket, and a chemical goes in box 2 only if food is in the same basket. No SKU’s attribute is
        ever a token. A is fragile, C is heavy, D is food, E is chemical — the model was told none of
        this.
      </>
    ),
    tests: (
      <>
        Why attention is the right tool for the job. The correct action for one item depends on other
        items, so the model must look across the whole order. And whether a model builds internal
        concepts it was never given.
      </>
    ),
    steps: [
      { do: 'Run the basket “A B”.', see: <>A is fragile and gets <b>no padding</b>. Nothing heavy is present.</> },
      { do: 'Run “A B C”.', see: <>The same item A now gets <b>padding</b>. C is heavy. The item did not change; the basket did. This is the whole lesson — read the two plans side by side.</> },
      { do: 'Run “E D”.', see: <>Chemical E goes to <b>box 2</b>, because food D shares the basket. Compare with a chemical in a basket without food.</> },
      { do: 'Click “random held-out”.', see: <>An order the model never trained on. It packs it correctly. It learned the rule, not a lookup table.</> },
      { do: 'Look at the concept map below the grid.', see: <>The learned SKU embeddings projected to 2-D. They cluster by fragile, heavy, food and chemical — attributes that never appeared in the training text. To pack correctly the model had to infer them, and the clusters are that inference made visible.</> },
    ],
    questions: [
      { q: 'Could a lookup table do this?', a: <>For seen orders, yes. The held-out split is built so each relational trigger is tested on an unseen basket, which a lookup table fails and this model passes.</> },
      { q: 'How do we know it inferred the attributes?', a: <>The clusters in the concept map. Nothing in the input distinguishes A from C; only the packing decisions do. The model’s embedding for A ended up near other fragile items.</> },
      { q: 'Why is this the honest case for a transformer?', a: <>Because the decision for one token depends on other tokens in the sequence. That is exactly what attention computes.</> },
    ],
  },

  'next-token': {
    headline: 'The whole of what a language model does, on one screen: a probability for every next character.',
    model: (
      <>
        The bundled three-skill model — {BUNDLES.multitask.params.toLocaleString()} parameters,
        character-level, trained at once on Jabberwocky-style poems, algebra lines and sorted lists. The
        bars are not an illustration. They are the model’s actual output: one probability for each of the{' '}
        {BUNDLES.multitask.vocab} characters it knows, summing to 1, recomputed on every keystroke.
      </>
    ),
    tests: (
      <>
        That there is only one operation underneath everything else. Chat, agents, summarising, refusing —
        all of it is this, run in a loop, with the chosen character appended and the question asked again.
        Nothing in the model plans a sentence.
      </>
    ),
    steps: [
      { do: 'Read the bars before touching anything.', see: <>A distribution, not an answer. The model has an opinion about every character, including the unlikely ones. Say the number out loud: this is the model’s entire output.</> },
      { do: 'Press “Write the next character” four or five times.', see: <>Each press takes the tallest bar, appends it, and re-runs. The text grows one character at a time and the bars change every press, because the question changed.</> },
      { do: 'Clear the box and type “sort 6 9 2 => ”.', see: <>The distribution concentrates: on a task it genuinely learned, one bar dominates. Compare with the middle of a poem, where several characters are plausible. Confidence is visible, and it varies by what is being asked.</> },
      { do: 'Press “Keep taking the top bar”.', see: <>It writes, and then falls into a repeating groove — "the stood the stood the stood". The page names the block it is repeating and explains it, so nobody leaves thinking the model is broken. Ask the room why always choosing the most likely character must eventually loop.</> },
      { do: 'Press “Choose in proportion instead”.', see: <>The same weights, the same bars, proper verse. This is the moment the lesson lands: what changed was not the model but how its output was read. Press it twice more for three different poems.</> },
    ],
    mechanism: (
      <>
        The final layer produces one score per vocabulary item; softmax turns those scores into
        probabilities. Everything visible here is that vector. Generation is: sample or take the maximum,
        append it, run the model again.
      </>
    ),
    questions: [
      { q: 'Is this what ChatGPT does?', a: <>Yes, with three differences: tokens instead of single characters, a vocabulary of about 100,000 instead of {BUNDLES.multitask.vocab}, and far more of the machinery producing the scores. The loop is identical.</> },
      { q: 'So it never knows what it is going to say?', a: <>Not in advance, no. It is worth letting that sit. A long, coherent answer is produced one piece at a time, each piece conditioned on the pieces before it.</> },
      { q: 'Why do the bars change when I add a space?', a: <>A space is a character like any other, and it changes the input. This is also why prompts are sensitive to small edits.</> },
    ],
  },

  attention: {
    headline: 'The model is looking at some of what you typed, and cannot see the rest at all.',
    model: (
      <>
        The bundled three-skill model again. The highlight is real attention taken from the forward pass:
        for the position it is about to predict, the demo averages every head in every layer and shades
        each character by how much weight it received. Its context window is{' '}
        {BUNDLES.multitask.contextLen} characters, so only the last {BUNDLES.multitask.contextLen} appear
        in the strip.
      </>
    ),
    tests: (
      <>
        Two things people conflate. <b>Attention</b>: within what it can see, the model weights some
        characters far more than others. <b>The context window</b>: outside that span, text does not
        score low — it is not there at all.
      </>
    ),
    steps: [
      { do: 'Read the default line and find the bright characters.', see: <>The weight is uneven and mostly recent. Ask the room to predict which characters would matter before revealing them.</> },
      { do: 'Type a long sentence, well past the window.', see: <>The strip stops growing. The beginning of what you typed silently drops off the front — no warning, no error, no mention of it in the output.</> },
      { do: 'Put an important word at the start, then push it out with padding.', see: <>The model’s continuation stops depending on it. This is the demo to point at when someone asks why a long chat “forgot” an instruction given at the top.</> },
      { do: 'Try a line with obvious structure, such as “sort 6 9 2 => ”.', see: <>Weight lands on the digits rather than spread evenly. The model is reading the parts of the input the task depends on.</> },
    ],
    mechanism: (
      <>
        Every position computes a query and compares it with every earlier position’s key; the softmax of
        those scores is what is shaded here. Averaging all heads makes a readable summary and loses the
        detail — individual heads do specific jobs, which is what the lab’s attention and ablation tabs
        are for.
      </>
    ),
    questions: [
      { q: 'Real models have million-token windows. Is this still relevant?', a: <>The limit moves; it does not go away, and cost grows with the square of the sequence. Everything beyond the window has to be summarised, retrieved or dropped — which is why retrieval exists.</> },
      { q: 'Is the bright character the “important” one?', a: <>It is the one this averaged view weights most. Attention weight is evidence about the computation, not a claim about meaning — a caveat that applies to the interpretability literature too.</> },
    ],
  },

  hallucination: {
    headline: 'A model with no facts about your subject still produces a confident paragraph about it.',
    model: (
      <>
        The bundled three-skill model, which read exactly three things: nonsense verse, single-variable
        algebra and sorted 3-number lists. It has never seen a contract, a treaty or a medical record.
        Sampling is seeded, so the same prompt gives the same continuation every time — useful when you
        want to rehearse a line before saying it to a room.
      </>
    ),
    tests: (
      <>
        That fluency and knowledge are separate, and that nothing in the mechanism produces “I don’t
        know”. The model is always able to continue text. It has no representation of the gap between
        what it read and what you asked.
      </>
    ),
    steps: [
      { do: 'Run the default, “the contract states that ”.', see: <>Sentence-shaped output with the rhythm of writing and no content. Read it aloud in a serious voice — the shape is doing all the work, and the shape is what people trust.</> },
      { do: 'Type a subject of your own: a company, a law, a diagnosis.', see: <>The same behaviour every time. It never stops, never hedges, never declines.</> },
      { do: 'Now run “sort 6 9 2 => ”.', see: <>A correct answer, in the same voice, from the same weights. This is the point of the demo: the output gives you no way to tell which of the two you are looking at.</> },
      { do: 'Ask the room how they would tell, from the text alone.', see: <>They cannot. That is why the answers are checking a source, calling a tool, or retrieving the passage — the three things the later pages are about.</> },
    ],
    mechanism: (
      <>
        Generation is next-character prediction with no truth term anywhere in it. The objective rewards
        plausible continuations of the training distribution. A confabulated answer and a correct one are
        produced by the same process at the same confidence.
      </>
    ),
    questions: [
      { q: 'Doesn’t a bigger model just know more?', a: <>It knows more, so it is wrong less often and more convincingly. The failure mode is unchanged — and a rarer, better-dressed error is harder to catch, not easier.</> },
      { q: 'Why does it not say it doesn’t know?', a: <>Nothing in the training makes “I don’t know” the likely continuation. Large assistants say it because they were shown examples of saying it, which is behaviour, not self-knowledge.</> },
      { q: 'Is this the same as lying?', a: <>No, and the distinction matters for how you govern it. There is no model of the truth to depart from. Blame belongs to the process that let unchecked output reach a decision.</> },
    ],
  },

  instruction: {
    headline: 'The same instruction, two models of the same size: one carries on writing, one answers.',
    model: (
      <>
        Two bundled models, side by side. <b>Left</b>: the three-skill model,{' '}
        {BUNDLES.multitask.params.toLocaleString()} parameters, trained on plain text.{' '}
        <b>Right</b>: the tool-calling model, {BUNDLES.harness.params.toLocaleString()} parameters, same
        architecture, trained on pairs of instruction and the response that should follow. Both run
        greedily, so nothing here is the luck of the sampling.
      </>
    ),
    tests: (
      <>
        The step between a <b>base model</b> and an assistant. Pretraining produces something that
        continues text. Answering the question you asked is a separate, much smaller stage of training —
        instruction tuning, or supervised fine-tuning — and it is demonstrated, not grown into.
      </>
    ),
    steps: [
      { do: 'Ask the room to predict before you press anything.', see: <>Most expect the plain-text model to fail by falling silent or refusing. Take the guess, then run it.</> },
      { do: 'Press “total of 6 9 2”.', see: <>The right-hand model answers in the shape it was shown. The left-hand one keeps writing — and may hand back a sorted list, fluently, for a question about a total. It answers something nobody asked.</> },
      { do: 'Say why that is the more dangerous failure.', see: <>A blank is obviously broken. A confident answer to a different question passes review. This is worth more time than the correct panel.</> },
      { do: 'Try the other two chips, then type an instruction of your own.', see: <>The split holds on phrasings neither model saw. What separates them is not size — it is 2,000-odd parameters apart — but what they read.</> },
    ],
    mechanism: (
      <>
        Both models are doing next-character prediction. Instruction tuning changes which continuation is
        likely, by training on text where an instruction is followed by a response. Nothing is added to
        the architecture. At real scale a third stage follows — reinforcement learning from human
        feedback — which shapes tone and refusals, and does not make the model more often right.
      </>
    ),
    questions: [
      { q: 'Is the right-hand model the left one, fine-tuned?', a: <>No, and be straight about it: they are two separately trained models of the same architecture and near-identical size, trained on differently shaped data. That isolates the variable the lesson is about — what the training data looked like — but it is not a before-and-after of one model.</> },
      { q: 'Why does the answer look like a tool call?', a: <>Because that is the shape the right-hand model was shown. Instruction tuning teaches a format as much as a disposition, which is also why real assistants have house styles.</> },
      { q: 'Do base models still exist?', a: <>Yes — every assistant starts as one, and base models are released for people who want to tune their own. If you are ever handed one and expect a chatbot, this demo is what happens.</> },
    ],
  },

  rag: {
    headline: 'Find the right passage first, and the model no longer has to remember anything.',
    model: (
      <>
        No site model runs here. Six short documents no model was trained on, plus the same real GloVe
        word vectors the embeddings demo uses. “Look up by name” is an exact fetch; “Search by meaning”
        turns your words into a vector, compares it with each document’s vector, and ranks them. The
        retrieval is real and measurable; the final answering step is described rather than run, because
        the tiny model has no facts to be grounded in.
      </>
    ),
    tests: (
      <>
        What retrieval-augmented generation actually is, minus the mystique: retrieve the relevant text,
        put it in the context, answer from it. And the division that follows — <b>knowledge you retrieve,
        skill you train</b>.
      </>
    ),
    steps: [
      { do: 'Start in “Look up by name” and pick a document.', see: <>The dull case, and worth showing first: if you know the name, retrieval is a fetch. No AI is involved.</> },
      { do: 'Switch to “Search by meaning” and run “creatures of the ocean”.', see: <>The sea document ranks first, with a similarity score, although the query shares almost no words with it. Meaning, not keywords.</> },
      { do: 'Read the “matched on” line.', see: <>Which words were in the vocabulary and which were skipped. Retrieval quality is a property of that matching, and it is inspectable — unlike the model’s memory.</> },
      { do: 'Type a query with a word the vectors have never seen.', see: <>It is skipped, and the ranking degrades. Half of a production RAG system is this problem: what your index does with the words your users actually type.</> },
      { do: 'Read the green panel.', see: <>Retrieved passage → context → grounded answer. Say plainly that the retrieval is running live and the last step is narration here.</> },
    ],
    questions: [
      { q: 'Does this fix hallucination?', a: <>It changes the failure. The model can now be right about things it never trained on, and you can point at the source. It can still misread the passage, or answer from memory when retrieval returns nothing useful.</> },
      { q: 'Why not fine-tune the facts in instead?', a: <>Facts change, and weights are an awkward place to keep something you need to update, cite or delete. Retrieval keeps knowledge in a store you can edit and audit.</> },
      { q: 'Is real retrieval done this way?', a: <>The shape is the same — embed, index, rank by similarity — over millions of chunks, with a learned embedding model rather than averaged word vectors, and usually with keyword search alongside it.</> },
    ],
  },

  quantisation: {
    headline: 'A model shrinks four times over with no measurable loss, and then falls off a cliff.',
    model: (
      <>
        The bundled sort-only model — {BUNDLES.sort.params.toLocaleString()} parameters, ascending sorts
        of 3-number lists and nothing else. Each run copies it, rounds every weight matrix to the chosen
        number of bits (LayerNorm and biases stay full precision), and re-measures exact-match accuracy on
        held-out lists it never trained on. The bars are measured in the browser while the class watches,
        not read from a table.
      </>
    ),
    tests: (
      <>
        Why a capable model can run on a laptop or a phone. Weights are stored at 32 bits by default and
        that precision is largely unnecessary — until, quite abruptly, it is.
      </>
    ),
    steps: [
      { do: 'Press “Quantise & measure”.', see: <>Five rows appear as they are measured: 32, 8, 4, 3, 2 bits, each with its accuracy and how much smaller the model is.</> },
      { do: 'Compare 32-bit with 8-bit.', see: <>Four times smaller, accuracy essentially unchanged. Ask what else in engineering gives a 4× saving for nothing.</> },
      { do: 'Read down to 3-bit and 2-bit.', see: <>The bar turns red and the skill is gone. Not a graceful decline — a cliff. Nothing warned that the edge was there.</> },
      { do: 'Draw the practical conclusion.', see: <>You cannot know where your cliff is without measuring it on your own task. The curve’s shape generalises; the position of the edge does not.</> },
    ],
    mechanism: (
      <>
        Quantisation maps each weight onto a small grid of values and stores the index. The rounding error
        per weight is tiny and it accumulates through the network — up to a point the computation
        tolerates, past which the errors dominate.
      </>
    ),
    questions: [
      { q: 'Is this what “4-bit” means on a downloadable model?', a: <>Yes, in outline. Production schemes are cleverer — per-block scales, some layers kept at higher precision, calibration on real data — which pushes the cliff further out.</> },
      { q: 'Does it get faster too?', a: <>Usually, because less memory has to move. On this tiny model the point is the size axis; at real scale memory bandwidth is the thing you are buying back.</> },
      { q: 'Why does a task this simple break so sharply?', a: <>Sorting is exact: an answer is right or it is not, so partial degradation shows up as a collapse. A fluency task would have shown a gentler slide and hidden the same damage.</> },
    ],
  },

  'flaky-harness': {
    headline: 'The model’s output is malformed more often than anyone plans for, and something has to catch it.',
    model: (
      <>
        No model runs in this one — worth saying, because it is what makes the demo honest. Four
        handwritten outputs of the kind a language model really does produce are fed into the{' '}
        <b>real parser</b>, the same <span className={c}>harnessDispatch</span> code path the working
        tool-call demo uses. The malformed strings are the fixture; the harness’s behaviour is the thing
        under test.
      </>
    ),
    tests: (
      <>
        That a probabilistic component is a source of invalid input to the rest of your system, and that
        the boundary around it is ordinary defensive engineering — parse, validate, fail loudly, retry.
        No part of this is AI.
      </>
    ),
    steps: [
      { do: 'Press “Simulate a flaky model”.', see: <><span className={c}>max(4 1 7 = 7</span> — the closing bracket is missing. The harness reports what was wrong and would re-prompt or fall back. No tool ran.</> },
      { do: 'Press it again.', see: <><span className={c}>mxa(4 1 7) = 7</span>, a mistyped tool name. Ask what a system that dispatched on the model’s string without checking would do here.</> },
      { do: 'Press again for the empty call.', see: <><span className={c}>sum() = </span> — well-formed and useless. Structure is not sufficient; arguments have to be validated too.</> },
      { do: 'Press once more.', see: <>A valid call buried in chatter, which the parser finds. Being liberal about what surrounds the call is worth it; being liberal about the call itself is not.</> },
    ],
    mechanism: (
      <>
        The harness extracts a tool name and an argument list, checks the name against a registry and the
        arguments against what the tool needs, and returns an error rather than throwing. An error is a
        retry, a fallback, or a message to a person — the design decision is which, and that decision
        belongs to your code, not to the model.
      </>
    ),
    questions: [
      { q: 'Don’t modern models emit valid JSON reliably?', a: <>Far more reliably, and constrained decoding makes syntax near-certain. Neither makes the tool name correct or the arguments sensible, which are the last two samples here.</> },
      { q: 'Why fail loudly rather than guess?', a: <>A guess turns a visible failure into a wrong action with no record. The tic-tac-toe demo is this rule again: the check layer rejects and re-asks, and never quietly picks a better move.</> },
      { q: 'Is a retry always the answer?', a: <>No. Retries cost money and can loop, so a harness needs an attempt limit and a defined path when it is reached — usually a fallback or a human.</> },
    ],
  },

  'what-fits': {
    headline: 'A model cannot try harder. A class watches the same weights fail and then succeed, on budget alone.',
    model: (
      <>
        The adder — {BUNDLES.adder.params.toLocaleString()} parameters, context window{' '}
        {BUNDLES.adder.contextLen} characters. Trained on the 200 single-column addition facts{' '}
        <b>and</b> 6,000 whole sums of up to four digits <b>and</b> 6,000 worked traces of them.
        Say that last part out loud before you start: whole four-digit sums were in its training
        data. Everything you are about to watch it fail at, it was taught.
      </>
    ),
    tests: (
      <>
        That one forward pass costs a fixed amount of work, set by the length of the input and the
        size of the model, and never by how hard the question is. A model has no way to concentrate.
        So the same weights can fail and succeed on the same sum depending only on how many passes
        the answer is allowed to take.
      </>
    ),
    steps: [
      {
        do: 'Let the sweep finish — it measures three ways of asking, across ten widths.',
        see: (
          <>
            Three curves from <em>one</em> set of weights. Nothing is trained here; nothing is
            learned between the lines.
          </>
        ),
      },
      {
        do: 'Read the red line first, then say that it was trained on four-digit sums.',
        see: (
          <>
            It is near zero almost everywhere. This is the moment to kill the idea that a wrong
            answer means missing knowledge. The knowledge was supplied and the answer is still wrong.
          </>
        ),
      },
      {
        do: 'Now the amber line, at one and two digits.',
        see: (
          <>
            Writing the working out is <b>better</b> than answering outright. That is chain of
            thought, and this is the honest evidence that it does something real: more passes buy
            computation the model did not otherwise have.
          </>
        ),
      },
      {
        do: 'Follow amber to three digits, then to six.',
        see: (
          <>
            It collapses at three — while the working still fits easily in the window, so this is
            the model losing its place, not running out of room. By six, the working would need more
            characters than the window holds and the row reads <b>no room</b>. Two different limits,
            and the second one is arithmetic you can do in advance.
          </>
        ),
      },
      {
        do: 'Finally the green line, at 25 digits.',
        see: (
          <>
            Perfect, on sums far longer than anything it trained on, because the harness gives every
            column its own pass with a prompt of constant length. Ask the room what changed about the
            model. Nothing did.
          </>
        ),
      },
    ],
    mechanism: (
      <>
        Attention compares every position with every other, so a pass over N tokens costs on the
        order of N² work for a model of a given width — fixed once the input is fixed. Generating
        more tokens is the only way to spend more, which is why chain of thought helps and why it is
        bounded by the context window. A harness escapes both by starting a fresh pass per step and
        keeping the state itself.
      </>
    ),
    questions: [
      {
        q: 'So transformers cannot do hard problems?',
        a: (
          <>
            That is the overclaim to avoid, and the amber line is why. Extra passes genuinely extend
            what fits, which is exactly what reasoning models are trained to exploit. What is true is
            narrower and more useful: work per pass is fixed, passes are the only currency, and the
            supply is finite.
          </>
        ),
      },
      {
        q: 'Would a bigger model fix the red line?',
        a: (
          <>
            It would raise it, and the shape would stay. A bigger model does more work per pass but
            still the same amount whatever you ask, so there is still a width where one pass is not
            enough — further out, and still there.
          </>
        ),
      },
      {
        q: 'Is this why my agent framework loops?',
        a: (
          <>
            Yes, and it is the useful way to think about the design. Each turn round the loop is a
            fresh budget. A well-built harness spends those turns on steps that are individually
            checkable, rather than asking for one heroic answer.
          </>
        ),
      },
    ],
  },

  'verifiers-budget': {
    headline: 'A checker with a perfect error-catch rate, which is nonetheless worthless.',
    model: (
      <>
        The same {BUNDLES.adder.paramsLabel}-parameter adder, now shown a sum together with a
        claimed answer and asked whether to accept it. It was never trained to say yes or no, so
        "accepting" means its own recomputed answer matched the claim. That is what checking by
        re-computation costs, and it is the only check this model can actually perform. Wrong claims
        are made by flipping one digit of the true answer.
      </>
    ),
    tests: (
      <>
        Whether a model can be trusted to check work — its own, or another model's. Verifying is not
        automatically cheaper than producing, and a reviewer bounded the same way as the author fails
        in the same place, fluently.
      </>
    ),
    steps: [
      {
        do: 'Before running it, ask the room how they would score a reviewer.',
        see: (
          <>
            Almost everyone proposes some version of "how many errors did it catch". Write that on
            the board; you are about to break it.
          </>
        ),
      },
      {
        do: 'Run the sweep and read only the grey line on the left.',
        see: (
          <>
            <b>100% at every width.</b> It caught every wrong answer, and kept doing so as the sums
            got harder. By the metric the room just proposed, this is a perfect reviewer that does
            not degrade. Let that sit for a moment.
          </>
        ),
      },
      {
        do: 'Now add the green line.',
        see: (
          <>
            It rejects correct answers just as eagerly. The checker has not become strict — it is
            saying no to everything, because its own recomputation disagrees with every claim put to
            it. Perfect error detection, zero value.
          </>
        ),
      },
      {
        do: 'Move to the right chart and compare the four methods.',
        see: (
          <>
            Only the gap between accepting truth and accepting lies carries information. Checking in
            one pass has almost none. The harness loop keeps it, because its budget grows with the
            problem. JavaScript is exact and costs the model nothing.
          </>
        ),
      },
    ],
    mechanism: (
      <>
        The verifier has exactly the budget it had for generating, and its natural method is to
        re-derive the answer and compare. So its verdict inherits the generator's failure mode
        precisely. This is the argument against relying on a second model to review the first: it is
        not an independent check, it is the same check run twice, and the second run is as likely to
        be wrong as the first.
      </>
    ),
    questions: [
      {
        q: 'But LLM-as-judge works in practice — we use it.',
        a: (
          <>
            It works where judging really is easier than doing: tone, format, whether an answer is on
            topic, whether a citation is present. It stops working where checking needs the same work
            as solving. The practical rule is to know which of the two your judge is doing, and to
            measure it on correct answers as well as wrong ones.
          </>
        ),
      },
      {
        q: 'How do we avoid the trap in our own evaluations?',
        a: (
          <>
            Always report both halves. A checker that never passes good work is as broken as one that
            never catches bad work, and only one of those shows up in a catch rate. Here the false
            accept rate is zero at every width, which looks like success and is an artefact of
            refusing everything.
          </>
        ),
      },
      {
        q: 'So what should we trust?',
        a: (
          <>
            Something that runs: the test suite, the type checker, the solver, the query. Its effort
            scales with the problem, and it does not produce a confident narration of a result it did
            not actually establish.
          </>
        ),
      },
    ],
  },

  calibration: {
    headline: 'A confidence score that is the same number on every board, and nobody noticed for weeks.',
    model: (
      <>
        Both tic-tac-toe agents, swept over all <b>4,520</b> non-terminal positions. The number
        under test is the agent's own confidence in the move it chose — one forward pass, a softmax
        over the nine cell tokens, the probability on its top pick. Exactly the number the capstone
        has been displaying next to every move it makes. "Optimal" comes from the same minimax
        oracle the agents were trained against, so the scoring is not a second opinion.
      </>
    ),
    tests: (
      <>
        Whether a confidence number means anything. This is the question that decides if software
        can act on a model's answer without a person checking it: above some threshold act, below
        it escalate. Everything else about a decision model is downstream of whether that number
        can carry a threshold.
      </>
    ),
    steps: [
      {
        do: 'Ask the room what a confidence score is for, before showing anything.',
        see: (
          <>
            Someone will say "so you know when to trust it". Good — that is the claim about to be
            tested, and it is the one the whole design rests on.
          </>
        ),
      },
      {
        do: 'Switch the agent to undertrained, then click between the three positions.',
        see: (
          <>
            <b>The nine numbers do not change.</b> Three completely different boards, one identical
            distribution. Its stated confidence ranges from 17.4158% to 17.4225% across every
            position in the game. It is not reading the board, so the number cannot possibly track
            it — and it had been on screen for weeks looking exactly like a measurement.
          </>
        ),
      },
      {
        do: 'Ask what threshold you would set on that number.',
        see: (
          <>
            There isn't one. Every decision falls on the same side of any line you draw. This is the
            moment the lesson lands: a number can look like evidence and carry none.
          </>
        ),
      },
      {
        do: 'Switch to the well-trained agent, on the three-best-moves position.',
        see: (
          <>
            <b>34.2%</b> on the move it picked, <b>99.8%</b> across the three moves that are
            equally good. Both describe the same model on the same board. It has split its belief
            correctly, and reading only the top pick makes that look like doubt.
          </>
        ),
      },
      {
        do: 'Now the reliability chart, and the two coloured lines.',
        see: (
          <>
            Score only the top pick and the model looks wildly under-confident, far above the
            honest diagonal. Score the probability across every equally-good move and it sits close
            to it. Same weights, same positions, opposite verdicts — because 46.8% of positions have
            more than one right answer.
          </>
        ),
      },
    ],
    mechanism: (
      <>
        Cross-entropy, which these models are trained on, is a <em>proper scoring rule</em>: the
        only way to minimise it is to state the probabilities you actually believe, so pre-training
        yields roughly-honest numbers for free. Preference tuning does not have that property — the
        model is scored by another model predicting which answer a human rater preferred, and a
        rater can judge fluency and confidence far more easily than correctness. So the reward is
        highest for what looks right, and calibration is something you then have to go after
        deliberately.
      </>
    ),
    questions: [
      {
        q: 'Which number is the right one to use?',
        a: (
          <>
            It depends on the claim being made. "Higher confidence means higher accuracy" is about
            ranking, and the top pick tests it fine. "0.9 means nine times in ten" is about
            probability, and only the mass across all acceptable answers tests that. Most real
            tasks — routing a ticket, grading a risk — have several defensible answers, so the two
            come apart constantly.
          </>
        ),
      },
      {
        q: 'Would a bigger model fix the constant one?',
        a: (
          <>
            Training did, and the two agents here are the same size. The undertrained one has barely
            learned to read the board at all, so its output is nearly the same whatever it sees.
            More capacity is not what it needed.
          </>
        ),
      },
      {
        q: 'Is the flat number a bug?',
        a: (
          <>
            No, and that is the uncomfortable part. Nothing failed, nothing threw, the demo worked.
            A number was displayed to four significant figures for weeks and meant nothing, which is
            only discoverable by checking it against outcomes.
          </>
        ),
      },
    ],
  },

  classifier: {
    headline: 'The commercial version of everything else on the site, in one screen.',
    model: (
      <>
        A {BUNDLES.classifier.paramsLabel}-parameter character model trained on{' '}
        <b>{MEASURED.classifier.nTrain.toLocaleString()}</b> short customer messages about grocery
        orders, each paired with one of eight route codes. It was never taught to write: the only
        thing it emits is a single character naming a route, read as a softmax over those eight and
        nothing else. Nothing on screen was trained on. Measured on the shipped weights it gets{' '}
        <b>{MEASURED.classifier.unseenProduct}%</b> right when the product is new but the wording
        is familiar, and <b>{MEASURED.classifier.unseenPhrasing}%</b> when the wording is new —
        against {MEASURED.classifier.chance}% for guessing. That gap is the lesson.
      </>
    ),
    tests: (
      <>
        What "putting AI inside software" actually means, and what it rests on. Not a chat window
        beside the business, but a decision inside it — and a threshold deciding when that decision
        is trusted enough to act on without a person.
      </>
    ),
    steps: [
      {
        do: 'Read the first eight messages and their routes before touching the slider.',
        see: (
          <>
            Confident, correct routing of complaints about <b>melon</b> and <b>salmon</b> — items
            never in its training data. This is the boring part, and it is the part that would save
            an operation money. Worth saying out loud that the catalogue changes constantly and the
            ways people complain do not, which is why this is the case that matters.
          </>
        ),
      },
      {
        do: 'Now read the five in the middle, and the confidence beside them. This is the moment.',
        see: (
          <>
            Each of these five is genuinely two-sided. "The milk was warm when it arrived" is a
            quality complaint and a delivery complaint; "you swapped my bread for one with nuts"
            is a substitution error and an allergy report. The design intent was that the model
            would be unsure and the threshold would send them to a person.{' '}
            <b>It mostly is not.</b> Two of the five split their belief and escalate; the other
            three answer one reading at 77%, 80% and <b>98%</b> and get routed with nobody
            watching. Ask the room why, then give them the answer: "arrived" is all over the
            delivery training examples, so the wording is familiar even though the meaning is
            unclear. The confidence is a report on the wording. That is the single most useful
            thing in this demo and it is worth five minutes.
          </>
        ),
      },
      {
        do: 'Drag the threshold to 99%, then down to 30%.',
        see: (
          <>
            At 99% almost everything goes to a person: safe, and it has automated nothing. At 30%
            the ambiguous ones get routed on what is close to a coin-flip. Somewhere between is a
            business decision about the cost of being wrong — and note it is a different number for
            the allergy route than for a late delivery.
          </>
        ),
      },
      {
        do: 'Read the last two rows, which are marked in red.',
        see: (
          <>
            Their <em>phrasing</em> was held out — "i cannot find the bread at all" shares almost
            no words with any training example for a missing item — and on that kind the model
            manages {MEASURED.classifier.unseenPhrasing}%. One of the two lands on the right route
            and one does not; both come back under 70% and escalate, which is the threshold
            working. Contrast that with the five above, where it did not: here the model does not
            recognise the wording and says so, there it recognised the wording and was sure about
            the wrong reading. It generalises over the noun and
            barely at all over the sentence, because at this size it is matching wording rather
            than meaning. Leaving these on screen is the point: every deployment has a boundary
            like this, and the work is finding where yours sits.
          </>
        ),
      },
      {
        do: 'Type your own complaint into the box, lower case. Then type "hello". Then type forty letter a\'s.',
        see: (
          <>
            It routes anything you give it and reports a confidence for that too. "hello" comes back{' '}
            <b>{MEASURED.maskedRead.helloRoute} at {MEASURED.maskedRead.helloShown}%</b>, and that is
            the model's genuine belief — nothing is being discarded to produce it. The forty a's are
            the other case: <b>{MEASURED.maskedRead.degenerateEscaped}%</b> of the model's belief
            lands outside the eight routes (it wants to carry on writing a's) and the demo still
            prints a route at <b>{MEASURED.maskedRead.degenerateShown}%</b>, computed from the small
            remainder. Worth doing all three so nobody leaves thinking the model understands English,
            and so the difference between a real classification head and this cheap version is
            something the room has seen rather than been told.
          </>
        ),
      },
      {
        do: 'Ask the room what breaks this whole design.',
        see: (
          <>
            Two answers, and take both. A confidence number that does not vary — show them the
            calibration tab, where this site's own undertrained agent reports 17.4% on every board
            it has ever seen. And a confidence number that varies with the wrong thing, which they
            have just watched on the five ambiguous rows. Measured across the two held-out splits:
            on unseen products it says {MEASURED.classifier.saidWhenRight}% when right and{' '}
            {MEASURED.classifier.saidWhenWrong}% when wrong, thirty points of daylight; on unseen
            phrasings, {MEASURED.classifier.saidWhenRightNovel}% and{' '}
            {MEASURED.classifier.saidWhenWrongNovel}%, and no line separates those. It sorts best
            where the model was already competent.
          </>
        ),
      },
    ],
    mechanism: (
      <>
        The prompt is <span className={c}>note &lt;message&gt; =&gt; </span> and the model's next
        character is the route. At inference the demo reads the logits for the eight route
        characters at the final position and softmaxes over those alone, so an answer outside the
        eight is impossible by construction. The confidence is that softmax. It is the same read as
        the tic-tac-toe agent's nine cells.
        <br />
        <br />
        Be precise if someone asks whether this is a classification head, because it is not. A
        classification head replaces the last matrix so it scores eight categories instead of
        thirty-seven characters, and is trained on "which route was right" rather than "which
        character came next". This keeps the whole character vocabulary and reads eight of its
        scores — the cheap version, which is what lets the same model be inspected everywhere else
        on the site. Measured, it costs almost nothing: across all{' '}
        {MEASURED.maskedRead.nInFormat.toLocaleString()} messages the mass falling outside the eight
        is at most {MEASURED.maskedRead.escapedWorst}%, and the best character in the whole
        vocabulary is one of the eight every time. The model learned the format so thoroughly that
        the mask has nothing left to do.
      </>
    ),
    questions: [
      {
        q: 'Why not just use keywords?',
        a: (
          <>
            For this toy you could, and you should — that is the honest answer, and the
            unseen-phrasing result sharpens it: at {MEASURED.classifier.unseenPhrasing}% this
            particular model is worse than a decent keyword list on exactly the long tail a model
            is supposed to win. What the demo shows is the shape of the decision and the
            escalation, which is identical at a scale where rules stop being maintainable. What it
            also shows is that you have to measure the boundary rather than assume it.
          </>
        ),
      },
      {
        q: 'Could it route something dangerous?',
        a: (
          <>
            Yes, which is why the allergy category is in the set. A misrouted allergy note is not a
            refund, it is a safety incident, and the right response is a much higher threshold for
            that route than for a late delivery — per-category thresholds rather than one global
            number.
          </>
        ),
      },
      {
        q: 'Is this what the new decision models do?',
        a: (
          <>
            Structurally, yes: fixed answers, one pass, a probability each. Theirs are far larger,
            accept the allowed answers at request time rather than fixed at training, and are
            trained specifically so the probabilities mean something. The shape you can see here.
            Whether the probabilities mean anything is the part worth testing, whoever built it.
            <br />
            <br />
            Be careful with the "this is just BERT with a classification head" reply, which is the
            common one and is not right. A classification head's slots mean whatever training taught
            them, so a new set of categories means a new head and a retrain. A decision model takes
            a new set per request with the meanings supplied as prose, which is a different machine.
            The constrained <em>output</em> is genuinely old; the per-request schema trained for
            calibration is not. The community leaderboard bears that out: the BERT-family encoders
            sit at the bottom of it, and what reproduces the commercial model is a large
            autoregressive fine-tune.
          </>
        ),
      },
    ],
  },
}
