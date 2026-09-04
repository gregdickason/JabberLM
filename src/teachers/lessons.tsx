import type { DemoId } from '../embed/demos'

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
        A 90,000-parameter character model, context 96, taught exactly one thing: the addition table.
        Two hundred facts of the form <span className={c}>add 8 1 0 =&gt; 9 0</span> — eight plus one
        plus a carry of zero is nine, carry zero. Every digit pair and both carry states. That is all of
        its arithmetic.
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
      { do: 'Click “7 + 8”.', see: <>The single pass is now right. The model is not broken — it is out of room. Contrast with the 15-digit chip.</> },
      { do: 'Click “15 digits”.', see: <>The loop stays correct. Read the column trace aloud: each prompt is 13 characters, whatever the size of the sum.</> },
      { do: 'Read the table at the bottom.', see: <>Characters the model must hold at once. Writing out the working grows with the sum and exceeds its 96-character memory. One column at a time never does.</> },
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
      { do: 'Read the baseline before clicking anything.', see: <>Sorting ~85%, poem loss ~1.38. Write both on the board. Everything after this is a comparison against them.</> },
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
        A base model of 87,456 parameters that sorts ascending at ~97% on held-out vectors. Every one
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
      { do: 'Start on “undertrained” and play a few moves.', see: <>The harness loop narrates every turn. In roughly 60% of positions the model’s top pick is a cell that is already taken; the harness rejects it and re-asks, shown as a retry chain ending in “caught it”.</> },
      { do: 'Untick the legal-move check and keep playing.', see: <>The illegal move stands and the game jams. Nothing else in the system noticed. The check is the only thing that was catching it.</> },
      { do: 'Switch to “well-trained” and play again.', see: <>The retry chain almost never appears. Same architecture, same parameter count: 24% optimal moves becomes 98%, blocking 18% becomes 92%.</> },
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
      { q: 'Is the well-trained one perfect?', a: <>No. An exhaustive search finds nine losing lines for it as O, at 98% optimal play. High accuracy and a specific exploitable flaw coexist.</> },
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
}
