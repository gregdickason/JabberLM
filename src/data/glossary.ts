/**
 * Every term the site uses, defined once, in the register of the "New to AI" page.
 *
 * The audit that prompted this found terms used before they were defined on nearly every
 * page — "vector", "weights", "prefill", "held-out", "superposition" — and no glossary
 * anywhere. This is the single definition; pages link into it (`glossary.html#logit`) rather
 * than re-explaining, and the book quotes from it so the two cannot drift.
 *
 * Rules for an entry: define it without using another undefined term, say where the reader
 * meets it on the site, and prefer the honest short answer over the complete one.
 */

export type Term = {
  id: string
  term: string
  also?: string // the other name people use for the same thing
  group: Group
  short: string // one sentence a non-technical reader can repeat
  more?: string // the extra half a developer wants
  see?: { label: string; href: string } // where it is live on the site
}

export const GROUPS = [
  'The basics',
  'Inside the model',
  'Training',
  'Making it useful',
  'Agents and tools',
  'Cost and serving',
  'Looking inside',
  'Limits',
] as const
export type Group = (typeof GROUPS)[number]

export const TERMS: Term[] = [
  // ---- The basics ---------------------------------------------------------
  {
    id: 'token',
    term: 'Token',
    group: 'The basics',
    short:
      'The unit of text a model actually reads. Usually a word-piece — "strawberry" arrives as three chunks, not ten letters. The models on this site use single characters, which is unusual and deliberate.',
    more: 'Token counts, not word counts, are what you are billed for and what a context window is measured in.',
    see: { label: 'the tokenizer demo', href: './explain.html?section=tokens' },
  },
  {
    id: 'prompt',
    term: 'Prompt',
    group: 'The basics',
    short: 'Everything you send the model on one turn. In a chat that includes the whole conversation so far, re-sent each time.',
    more: 'A "system prompt" is instructions placed ahead of the conversation to set behaviour and persist across turns.',
  },
  {
    id: 'next-token-prediction',
    term: 'Next-token prediction',
    group: 'The basics',
    short:
      'The one thing a language model does: score every possible next token, pick one, add it to the text, repeat. Almost everything else in this glossary is in service of that loop.',
    more: 'It is the job, not the hardware. The same transformer can be read as a single typed decision instead of a writer, and some recent models are trained only to do that — so "a language model predicts the next token" stays true while "every transformer does" does not.',
    see: { label: 'watch it choose', href: './explain.html?section=prediction' },
  },
  {
    id: 'parameter',
    term: 'Parameter',
    also: 'weight',
    group: 'The basics',
    short:
      'One of the adjustable numbers inside the model. Training is the process of nudging all of them. The model on this page has about 90,000; a frontier model is estimated to have hundreds of billions.',
    more: '"Weights" usually means the same numbers, especially when talking about storing or shipping them.',
  },
  {
    id: 'temperature',
    term: 'Temperature',
    group: 'The basics',
    short:
      'How adventurously the model picks among its options. Near zero it takes the most likely token every time and repeats itself; higher, it reaches for less likely ones and varies.',
    more: 'Set it to 0 and pin the model version when you need the same input to give the same output twice.',
    see: { label: 'the randomness demo', href: './explain.html?section=randomness' },
  },
  {
    id: 'greedy-decoding',
    term: 'Greedy decoding',
    group: 'The basics',
    short:
      'Always taking the single most likely next token. It sounds like the safest choice and is the reason a model falls into repeating itself: the rule is deterministic, so once the text re-enters a state it has been in before, the same continuation must follow, for ever.',
    more: 'Sampling in proportion to the likelihoods breaks the loop. Same weights, different reading of the same numbers — which is why repetitive output is usually a decoding setting rather than a badly trained model.',
    see: { label: 'watch it loop, then not', href: './explain.html?section=prediction' },
  },
  {
    id: 'hallucination',
    term: 'Hallucination',
    group: 'The basics',
    short:
      'A fluent, confident answer that is simply wrong. Not a malfunction: the model is predicting plausible text, and plausible text is what you get whether or not it has anything real to draw on.',
    see: { label: 'watch one happen', href: './explain.html?section=hallucination' },
  },
  {
    id: 'context-window',
    term: 'Context window',
    group: 'The basics',
    short:
      'How much text the model can look at in one go. Anything outside it has no influence at all — not a faded influence, none.',
    see: { label: 'the context demo', href: './explain.html?section=context' },
  },
  {
    id: 'open-weights',
    term: 'Open weights',
    group: 'The basics',
    short:
      'The trained numbers are published, so anyone can download and run the model themselves. Different from open source, which would also mean the training code and data.',
  },

  // ---- Inside the model ---------------------------------------------------
  {
    id: 'embedding',
    term: 'Embedding',
    also: 'vector',
    group: 'Inside the model',
    short:
      'A list of numbers standing for a piece of text, positioned so that things which behave alike sit near each other. Meaning becomes distance and direction, which is what makes search and recommendation work.',
    more: 'A "vector" is just that list of numbers. Similarity between two is usually measured with a cosine.',
    see: { label: 'the word map', href: './explain.html?section=embeddings' },
  },
  {
    id: 'attention',
    term: 'Attention',
    group: 'Inside the model',
    short:
      'The step where information moves between positions in the text. Each position decides how much to draw from each earlier position. It is the only place in the model where tokens see each other.',
    more: 'Every position emits a query (what am I looking for), a key (what do I offer) and a value (what I pass on). Comparing queries with keys decides who reads from whom.',
    see: { label: 'follow one forward pass', href: './learn.html?section=attention' },
  },
  {
    id: 'head',
    term: 'Attention head',
    group: 'Inside the model',
    short:
      'One of several attention mechanisms running side by side in a layer, each free to specialise. On this site you can find the single head a skill depends on and switch it off.',
    see: { label: 'ablate one', href: './lab.html?tab=head-ablation' },
  },
  {
    id: 'residual-stream',
    term: 'Residual stream',
    group: 'Inside the model',
    short:
      "The running total each position carries through the model. Every step reads from it and adds its contribution back, so it works like a shared notepad passed down the stack.",
  },
  {
    id: 'mlp',
    term: 'MLP',
    also: 'feed-forward network',
    group: 'Inside the model',
    short:
      'The step after attention, where each position processes what it just gathered on its own. If attention is talking to your neighbours, this is thinking about what they said.',
  },
  {
    id: 'layer',
    term: 'Layer',
    group: 'Inside the model',
    short:
      'One attention step plus one MLP step. Stack a few and you have the whole model; there is nothing else in there.',
  },
  {
    id: 'logit',
    term: 'Logit',
    group: 'Inside the model',
    short:
      'The raw score the model gives each possible answer, before it is turned into a probability. For a language model the answers are the next token; they do not have to be.',
    more: 'Swap the last matrix for a classification head and the logits are over your categories instead of over the vocabulary. Same word, same softmax, different set of things being scored.',
    see: { label: 'the output end', href: './learn.html?section=logits' },
  },
  {
    id: 'softmax',
    term: 'Softmax',
    group: 'Inside the model',
    short: 'The step that turns a set of raw scores into probabilities that add up to 1.',
    more: 'Exponentiate each score, then divide by the total. It appears twice in a transformer: inside attention, turning one position\'s scores over the others into shares, and at the output, turning logits into probabilities.',
  },
  {
    id: 'classification-head',
    term: 'Classification head',
    also: 'sequence classification, linear head',
    group: 'Inside the model',
    short:
      'The last matrix of a transformer, replaced so that it scores a fixed set of categories instead of the whole vocabulary. The body is unchanged; only the output end and the training loss differ.',
    more: 'It reads one pooled position — a special first token in an encoder, the last token in a decoder-only model, since only that one has seen the whole input — and is trained on "which category was right" rather than "which token came next". It is small (model width × number of categories) and old: this is what BERT was fine-tuned with from 2018. One category and a squared error instead makes it a regression head, which is exactly what a reward model is.',
    see: { label: 'swap the last matrix', href: './learn.html?section=logits' },
  },
  {
    id: 'encoder',
    term: 'Encoder',
    also: 'encoder-only, BERT-style',
    group: 'Inside the model',
    short:
      'A transformer built to read rather than to write: every position may look at every other, in both directions, and the output is a representation rather than a next token.',
    more: 'Dropping the causal mask is the whole difference, and it costs the ability to generate — a position that can see the future cannot be asked to predict it. What you gain is a better representation for judging a whole piece of text, which is why encoders with a classification head still win on routing and scoring work. Every model on this site is the other kind, decoder-only.',
  },
  {
    id: 'transformer',
    term: 'Transformer',
    group: 'Inside the model',
    short:
      'The architecture behind essentially every current language model: layers of attention and MLP, repeated. The models on this site are real transformers, just very small ones.',
  },

  // ---- Training -----------------------------------------------------------
  {
    id: 'pretraining',
    term: 'Pretraining',
    group: 'Training',
    short:
      'The long first stage: read an enormous amount of text, predicting the next token, until the model is fluent. Produces a base model, which continues text but does not yet answer questions.',
  },
  {
    id: 'loss',
    term: 'Loss',
    group: 'Training',
    short: 'One number for how wrong the model just was. Training is the business of making it smaller.',
  },
  {
    id: 'gradient',
    term: 'Gradient',
    group: 'Training',
    short:
      'For each parameter, which way to nudge it to make the loss smaller, and how hard. Backpropagation is the method for working all of them out at once.',
  },
  {
    id: 'held-out',
    term: 'Held-out data',
    also: 'unseen data, validation set',
    group: 'Training',
    short:
      'Examples kept out of training so they can be used to test whether the model learned the rule or just memorised the answers. Every accuracy figure on this site is measured on held-out data, and says how many examples it used.',
  },
  {
    id: 'overfitting',
    term: 'Overfitting',
    group: 'Training',
    short:
      'When a model gets better on the examples it trained on while getting worse on everything else. It has memorised rather than generalised.',
  },
  {
    id: 'grokking',
    term: 'Grokking',
    group: 'Training',
    short:
      'When performance on unseen examples sits flat for a long time and then suddenly jumps, because the model switches from memorising to using the actual rule. You can watch it happen live here.',
    see: { label: 'watch it grok', href: './lab.html?tab=advanced-grokking' },
  },
  {
    id: 'sft',
    term: 'Instruction tuning',
    also: 'supervised fine-tuning, SFT',
    group: 'Training',
    short:
      'Training a base model on examples that pair an instruction with a good response, so it answers rather than continues. This is the step that turns a text predictor into an assistant.',
    see: { label: 'the same words, two models', href: './explain.html?section=instruction' },
  },
  {
    id: 'rlhf',
    term: 'RLHF',
    also: 'reinforcement learning from human feedback',
    group: 'Training',
    short:
      'After instruction tuning, people rank competing answers and the model is nudged toward the preferred ones. Where tone, refusals and house style come from. It shapes behaviour, not accuracy.',
    more: 'RLAIF replaces the human rankers with another model following a written rubric. DPO reaches a similar result without a separate reward model. Worth knowing the cost: raters can see confidence more easily than correctness, so this stage reliably trades away a model\'s honest sense of its own uncertainty in exchange for being helpful — a good bargain with a person in the loop, and the wrong one for software deciding alone.',
  },
  {
    id: 'rlvr',
    term: 'RLVR',
    group: 'Training',
    short:
      'Learning from a checker instead of from answers: the model tries, an automatic verifier scores the attempt, and good attempts are reinforced. Works where answers are checkable, like maths and code.',
    see: { label: 'train one from a reward', href: './lab.html?tab=reward-learning-rlvr' },
  },
  {
    id: 'fine-tuning',
    term: 'Fine-tuning',
    group: 'Training',
    short:
      'Adapting an already-trained model to a task with a small amount of extra training, rather than starting over. Vastly cheaper than pretraining.',
  },
  {
    id: 'lora',
    term: 'LoRA',
    group: 'Training',
    short:
      'The common way to fine-tune: freeze the original model and train a small add-on layer over it. You ship one big model once and a small adapter per specialty.',
    see: { label: 'flip an adapter on and off', href: './lab.html?tab=lora-fine-tuning' },
  },
  {
    id: 'catastrophic-forgetting',
    term: 'Catastrophic forgetting',
    group: 'Training',
    short:
      'Teaching a model something new can erase something it already knew. The fix is to keep showing it the old skill while it learns the new one.',
    see: { label: 'break it, then fix it', href: './lab.html?tab=forgetting' },
  },
  {
    id: 'distillation',
    term: 'Distillation',
    group: 'Training',
    short:
      "Training a small model to copy a big one's whole pattern of answers, not just its final choice. How a cheap model inherits an expensive one's skill.",
    see: { label: 'distil one live', href: './lab.html?tab=distillation' },
  },
  {
    id: 'eval',
    term: 'Eval',
    group: 'Training',
    short:
      'A repeatable test of whether a model is good enough at your actual task, scored on examples it has not seen. If a vendor cannot show you one for work like yours, you do not have a number.',
  },

  // ---- Making it useful ---------------------------------------------------
  {
    id: 'rag',
    term: 'RAG',
    also: 'retrieval-augmented generation',
    group: 'Making it useful',
    short:
      'Find the relevant document first, paste it into the prompt, and let the model answer from it. The standard fix for hallucination on facts the model was never taught.',
    more: 'The rule of thumb: knowledge you retrieve, skill you train in.',
    see: { label: 'retrieve and ground', href: './explain.html?section=rag' },
  },
  {
    id: 'knowledge-graph',
    term: 'Knowledge graph',
    group: 'Making it useful',
    short:
      'Facts stored as connections — this person works at that company — so questions can be answered by walking the links, including chains a plain text search cannot follow.',
  },
  {
    id: 'chain-of-thought',
    term: 'Chain of thought',
    group: 'Making it useful',
    short:
      'Letting the model write its working before its answer, which improves results on problems that need several steps. Reasoning models are this behaviour trained in rather than asked for.',
    see: { label: 'the reasoning loop', href: './harness.html?section=reasoning-loop' },
  },
  {
    id: 'prompt-engineering',
    term: 'Prompt engineering',
    also: 'context engineering',
    group: 'Making it useful',
    short:
      'Deciding what goes into the prompt: instructions, examples, retrieved documents, and what order they appear in. Since the model can only use what is in front of it, this is most of the work.',
  },

  // ---- Agents and tools ---------------------------------------------------
  {
    id: 'harness',
    term: 'Harness',
    group: 'Agents and tools',
    short:
      'The ordinary code around a model: it reads what the model produced, checks it, runs the tool it asked for, and decides what the model sees next. Most of a system’s reliability lives here rather than in the model.',
    see: { label: 'watch one work', href: './harness.html?section=tools' },
  },
  {
    id: 'tool-call',
    term: 'Tool call',
    also: 'function calling',
    group: 'Agents and tools',
    short:
      'The model, instead of answering, emits a request to run a specific function with specific arguments. Real code runs it and the result is authoritative. A model’s answer is a guess; a tool’s output is a computation.',
  },
  {
    id: 'agent',
    term: 'Agent',
    group: 'Agents and tools',
    short:
      'A model in a loop: it acts, the result of that action is fed back to it, and it chooses the next action until it decides it is finished. The loop is the whole difference between a tool call and an agent.',
    see: { label: 'the loop', href: './harness.html?section=loop' },
  },
  {
    id: 'prompt-injection',
    term: 'Prompt injection',
    group: 'Agents and tools',
    short:
      'An attack that works because an agent cannot tell data from instructions. Text arriving from a fetched page or a looked-up document can issue the model its next command.',
    more: 'Treating tool output as typed data defeats a planted instruction but cannot make a poisoned value true, so consequential actions still need explicit authorisation.',
    see: { label: 'hijack an agent', href: './harness.html?section=injection' },
  },
  {
    id: 'check-layer',
    term: 'Check layer',
    group: 'Agents and tools',
    short:
      'The part of the harness that validates what the model proposed before anything acts on it. On the capstone you can switch it off and watch the game break.',
    see: { label: 'switch it off', href: './capstone.html?section=play' },
  },

  // ---- Cost and serving ---------------------------------------------------
  {
    id: 'inference',
    term: 'Inference',
    group: 'Cost and serving',
    short:
      'Running a trained model to get an answer. Training is a one-off cost; inference is the bill you pay forever.',
  },
  {
    id: 'kv-cache',
    term: 'KV cache',
    group: 'Cost and serving',
    short:
      'A store of the work already done on the earlier part of the text, so each new token does not force a re-read of everything before it.',
    more: 'Reading the prompt (prefill) happens once and in parallel; generating the answer (decode) happens one token at a time and cannot be parallelised. That asymmetry is why output tokens cost more than input tokens.',
    see: { label: 'the cost sliders', href: './explain.html?section=inference' },
  },
  {
    id: 'quantisation',
    term: 'Quantisation',
    group: 'Cost and serving',
    short:
      'Storing the model’s numbers with less precision so it takes less memory and runs faster. Quality holds up surprisingly far, then falls off a cliff.',
    see: { label: 'watch the cliff', href: './explain.html?section=inference' },
  },
  {
    id: 'moe',
    term: 'Mixture of Experts',
    also: 'MoE',
    group: 'Cost and serving',
    short:
      'A model whose layers hold several sub-networks, with a router picking a couple per token. You get the capacity of a big model while paying for a slice of it.',
    see: { label: 'route some tokens', href: './lab.html?tab=mixture-of-experts' },
  },
  {
    id: 'speculative-decoding',
    term: 'Speculative decoding',
    group: 'Cost and serving',
    short:
      'A small model guesses the next few tokens and the big model checks them all at once, keeping what it agrees with. The output is identical to running the big model alone, just reached with fewer of its turns.',
    see: { label: 'draft and verify', href: './lab.html?tab=speculative-decoding' },
  },

  // ---- Looking inside -----------------------------------------------------
  {
    id: 'interpretability',
    term: 'Interpretability',
    group: 'Looking inside',
    short:
      'Working out what a trained model has actually learned by examining its insides, rather than judging it only by its answers. Labs do it to audit models, steer them and catch behaviour that testing would miss.',
  },
  {
    id: 'ablation',
    term: 'Ablation',
    group: 'Looking inside',
    short:
      'Switching off one part of the model to see what stops working. If a skill collapses, that part was carrying it.',
    see: { label: 'break a skill', href: './lab.html?tab=head-ablation' },
  },
  {
    id: 'superposition',
    term: 'Superposition',
    group: 'Looking inside',
    short:
      'Models pack more concepts than they have places to put them, so a single neuron ends up carrying pieces of several unrelated ideas. It is why you usually cannot read meaning off one neuron.',
    see: { label: 'see it happen', href: './lab.html?tab=neurons' },
  },
  {
    id: 'sae',
    term: 'Sparse autoencoder',
    also: 'dictionary learning, SAE',
    group: 'Looking inside',
    short:
      'A technique for untangling those overlapping concepts into a longer list of cleaner ones, so features can be named and tracked.',
    see: { label: 'train a dictionary', href: './lab.html?tab=dictionary-sae' },
  },
  // ---- Limits -------------------------------------------------------------
  {
    id: 'fixed-compute-budget',
    term: 'Fixed compute budget',
    group: 'Limits',
    short:
      'A model does the same amount of work on every question, however hard the question is. One pass costs what it costs, set by the length of the input and the size of the model, and difficulty does not enter into it.',
    more: 'So anything needing more computation than one pass can hold must be split into more passes, or handed to something outside the model whose effort grows with the problem. That is the argument for a harness.',
    see: { label: 'watch one pass run out', href: './lab.html?tab=what-fits' },
  },
  {
    id: 'proper-scoring-rule',
    term: 'Proper scoring rule',
    group: 'Limits',
    short:
      'A way of scoring predictions where the best score is earned by stating the probability you actually believe. Overclaim and it punishes you; hedge everything and it punishes you too.',
    more: 'Cross-entropy, the loss these models are trained on, is one — which is why pre-training produces probabilities that roughly track reality without anyone asking. Scoring against a model of human approval instead is not proper, and that is where honest uncertainty gets lost.',
    see: { label: 'what happens when it is lost', href: './lab.html?tab=calibration' },
  },
  {
    id: 'reward-model',
    term: 'Reward model',
    group: 'Limits',
    short:
      "A second model trained to predict which answer a human would prefer, used to score the first one during preference tuning. It stands in for a human rater so training can run at scale.",
    more: 'It is also the weak point. A rater can judge fluency and confidence far more easily than correctness, so those are what it learns to reward, and a capable model optimising against it will find and exploit that gap.',
  },
  {
    id: 'calibration',
    term: 'Calibration',
    group: 'Limits',
    short:
      'Whether a stated confidence matches how often the answer is actually right. A model that says 90% and is right 90% of the time is calibrated; one that says 90% and is right half the time is not, however useful it is otherwise.',
    more: 'Worth separating three things that all get called calibrated: does the number vary at all, does it rank (higher when the answer is better), and does 0.9 literally mean nine times in ten. A model can pass any of those and fail the others.',
    see: { label: 'measure it on a real model', href: './lab.html?tab=calibration' },
  },
  {
    id: 'typed-decision',
    term: 'Typed decision',
    also: 'constrained output, structured output',
    group: 'Limits',
    short:
      'Fixing the set of answers a model may give before it answers — one of these five categories, a score out of ten, yes or no — so anything outside the set is impossible rather than merely unlikely.',
    more: 'It removes malformed answers, which is a real gain, and says nothing about wrong ones. The case no schema reaches is the answer that is allowed and simply worse — the well-trained agent picks one in about 2% of positions, and no way of writing the schema excludes it, because the whole question is which of the allowed answers is right. Note also that fixing the answers is not the same as building a classification head: read a few of a language model\'s vocabulary scores and you get the same shape without the guarantee being structural.',
    see: { label: 'watch an allowed answer be the wrong one', href: './capstone.html?section=play' },
  },
  {
    id: 'autoregressive',
    term: 'Autoregressive',
    group: 'Limits',
    short:
      'Producing an answer one piece at a time, each piece conditioned on the pieces already produced. It is how language models generate text, and it is why a long answer costs more than a short one.',
    more: 'Not every transformer is used this way. Read a single forward pass as a score over a fixed set of options and the same network makes one typed decision instead of writing.',
  },
  {
    id: 'system-1-2',
    term: 'System 1 and System 2',
    group: 'Limits',
    short:
      "Kahneman's names for fast automatic judgement and slow deliberate reasoning. Borrowed by the field for models that answer in one shot versus models that work through steps before answering.",
    more: 'This site has both: the tic-tac-toe agent decides a move in a single pass, and the adder works one column at a time through a loop. The second is slower, costs more, and reaches problems the first cannot.',
    see: { label: 'the slow one', href: './lab.html?tab=what-fits' },
  },
  {
    id: 'epiplexity',
    term: 'Epiplexity',
    group: 'Limits',
    short:
      'The structure in a piece of data that a learner with a given amount of compute can actually extract. It is a property of the pair — this data, that observer — rather than of the data on its own.',
    more: 'It is the answer to a problem in classical information theory: running a deterministic rule is supposed to add no information, yet synthetic data, self-play and simulation plainly help a bounded model. They add nothing to an unlimited observer and a great deal to a real one.',
    see: { label: 'see it separate', href: './lab.html?tab=structure-vs-noise' },
  },
  {
    id: 'time-bounded-entropy',
    term: 'Time-bounded entropy',
    group: 'Limits',
    short:
      'The part of a signal a bounded observer cannot predict, whether or not it is truly random. A deterministic sequence it has no way to crack counts as noise to it, and looks exactly like noise.',
    more: 'Which is why a model reporting that something looks unstructured tells you about the model, not about the thing.',
    see: { label: 'rule 30 versus random', href: './lab.html?tab=structure-vs-noise' },
  },
  {
    id: 'steering',
    term: 'Steering',
    group: 'Looking inside',
    short:
      "Pushing a chosen direction into the model's activations while it runs, to bend what it is disposed to say. Evidence that a feature causes behaviour rather than merely accompanying it.",
    see: { label: 'steer one', href: './lab.html?tab=steering' },
  },
]

export const byGroup = (g: Group) => TERMS.filter((t) => t.group === g)
