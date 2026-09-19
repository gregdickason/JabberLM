/**
 * The blog series that becomes the book — one registry, so a post's title, status and
 * "try it" link cannot disagree between the series page, the teachers page and the posts.
 *
 * Posts not yet written are listed as `planned`. That is deliberate: a reader arriving from
 * post 2 should be able to see where the series is going, and an honest empty slot is better
 * than a page that pretends the series is finished.
 *
 * `tryIt` is the deep link the post's "Try it →" uses. Every one must resolve today — either a
 * `?section=`/`?tab=` address on this site, or an embed. If a post needs a demo that does not
 * exist yet, leave `tryIt` undefined rather than pointing at a page that cannot deliver it.
 */

export type PostStatus = 'published' | 'draft' | 'planned'

export type Post = {
  n: number
  part: 1 | 2 | 3 | 4 | 5
  title: string
  idea: string // the one thing this post is for
  status: PostStatus
  url?: string // where the post lives, once published
  tryIt?: { label: string; href: string }
  embed?: string // embed id, when a post can carry the demo inline
}

export const PARTS: Record<number, string> = {
  1: 'What a language model is',
  2: 'How it learns',
  3: 'Looking inside',
  4: 'From model to product',
  5: 'Intelligence',
}

export const POSTS: Post[] = [
  {
    n: 1,
    part: 1,
    title: 'The smallest possible transformer',
    idea: 'One mechanism the whole way up — and three lessons in one 90K model: memorise, hallucinate, generalise.',
    status: 'published',
    tryIt: { label: 'sort 6 9 2 in the playground', href: './?dataset=sort' },
  },
  {
    n: 2,
    part: 1,
    title: "It doesn't see letters",
    idea: 'Tokens, and why the biggest models miss the r\'s in strawberry.',
    status: 'planned',
    tryIt: { label: 'the tokenizer demo', href: './explain.html?section=tokens' },
    embed: 'tokenizer',
  },
  {
    n: 3,
    part: 1,
    title: 'Words as coordinates — how meaning becomes maths',
    idea: 'Meaning as geometry: similar words sit close, and directions carry meaning. King minus man plus woman lands on queen, and nobody taught it about royalty.',
    status: 'draft',
    tryIt: { label: 'the word map', href: './explain.html?section=embeddings' },
    embed: 'embeddings',
  },
  {
    n: 4,
    part: 1,
    title: 'The reflex',
    idea: 'Next-token prediction as a weighted roll of the dice — and why a confident answer is a prediction, not a fact.',
    status: 'planned',
    tryIt: { label: 'watch it choose a character', href: './explain.html?section=prediction' },
    embed: 'next-token',
  },
  {
    n: 5,
    part: 1,
    title: 'What it can see',
    idea: 'Attention is the only step where information moves between tokens — and the context window is a hard edge, not a fade.',
    status: 'planned',
    tryIt: { label: 'the attention walk', href: './learn.html?section=attention' },
    embed: 'attention',
  },
  {
    n: 6,
    part: 1,
    title: 'The rest of the block',
    idea: 'MLP, residual stream, layers, logits. Stack attention and MLP a few times and that is the whole model.',
    status: 'planned',
    tryIt: { label: 'step through a forward pass', href: './learn.html?section=logits' },
  },
  {
    n: 7,
    part: 2,
    title: 'Learning by being wrong',
    idea: 'Loss, gradients and the update rule — every number nudged a little, a few thousand times.',
    status: 'planned',
    tryIt: { label: 'train one and watch the loss fall', href: './?tour=1' },
  },
  {
    n: 8,
    part: 2,
    title: 'The moment it gets it',
    idea: 'Memorising versus generalising, and the sudden jump when a model stops looking things up and starts using the rule.',
    status: 'planned',
    tryIt: { label: 'watch it grok', href: './lab.html?tab=advanced-grokking' },
  },
  {
    n: 9,
    part: 2,
    title: 'Why it makes things up',
    idea: 'It was trained on algebra and still cannot do algebra. Hallucination is the reflex running with nothing real to draw on.',
    status: 'planned',
    tryIt: { label: 'watch one happen', href: './explain.html?section=hallucination' },
    embed: 'hallucination',
  },
  {
    n: 10,
    part: 2,
    title: 'Knowledge you retrieve, skill you distil',
    idea: 'The split that decides what to train in and what to look up.',
    status: 'planned',
    tryIt: { label: 'retrieve and ground an answer', href: './explain.html?section=rag' },
  },
  {
    n: 11,
    part: 3,
    title: 'Opening the box',
    idea: 'Heads specialise. Switch off the one that sorts and sorting dies, while the poems carry on.',
    status: 'planned',
    tryIt: { label: 'ablate a head', href: './lab.html?tab=head-ablation' },
    embed: 'head-ablation',
  },
  {
    n: 12,
    part: 3,
    title: 'Injury and recovery',
    idea: 'Retrain with the critical head locked off and the skill comes back somewhere else.',
    status: 'planned',
    tryIt: { label: 'injure it, then heal it', href: './lab.html?tab=injury-recovery' },
  },
  {
    n: 13,
    part: 3,
    title: 'Cleaner concepts',
    idea: 'Superposition, a dictionary of features, and steering as reaching into a representation.',
    status: 'planned',
    tryIt: { label: 'train a dictionary', href: './lab.html?tab=dictionary-sae' },
  },
  {
    n: 14,
    part: 3,
    title: 'Many brains in one',
    idea: 'Mixture of Experts: capacity you own, compute you rent per token.',
    status: 'planned',
    tryIt: { label: 'route some tokens', href: './lab.html?tab=mixture-of-experts' },
  },
  {
    n: 15,
    part: 4,
    title: 'How a model is made',
    idea: 'Pretraining versus fine-tuning, and why nobody retrains a giant for a new task.',
    status: 'planned',
    tryIt: { label: 'flip an adapter on and off', href: './lab.html?tab=lora-fine-tuning' },
    embed: 'lora',
  },
  {
    n: 16,
    part: 4,
    title: 'Teaching it to behave',
    idea: 'The step nobody mentions: why it answers instead of continuing, and what alignment does and does not fix.',
    status: 'planned',
    tryIt: { label: 'the same words, two models', href: './explain.html?section=instruction' },
    embed: 'instruction',
  },
  {
    n: 17,
    part: 4,
    title: 'Talking to it well',
    idea: 'The whole conversation is re-sent every turn. Everything called prompt engineering follows from that.',
    status: 'planned',
    tryIt: { label: 'the context demo', href: './explain.html?section=context' },
  },
  {
    n: 18,
    part: 4,
    title: 'Giving it tools',
    idea: "A model's answer is a guess; a tool's output is a computation.",
    status: 'planned',
    tryIt: { label: 'watch a tool call', href: './harness.html?section=tools' },
    embed: 'harness-tools',
  },
  {
    n: 19,
    part: 4,
    title: "Loop it, and it's an agent",
    idea: 'What the loop adds — and the hole it opens, where tool output becomes the next instruction.',
    status: 'planned',
    tryIt: { label: 'hijack an agent', href: './harness.html?section=injection' },
    embed: 'prompt-injection',
  },
  {
    n: 20,
    part: 4,
    title: 'Reasoning in a loop',
    idea: 'A model that cannot add two 4-digit numbers adds two 25-digit numbers perfectly, one column at a time.',
    status: 'planned',
    tryIt: { label: 'the reasoning loop', href: './harness.html?section=reasoning-loop' },
    embed: 'adder',
  },
  {
    n: 21,
    part: 4,
    title: 'What fits in one pass',
    idea: 'A model does the same work on every question however hard it is, so hard work has to go somewhere else — and a second model checking the first inherits the same blind spot.',
    status: 'planned',
    tryIt: { label: 'where one pass runs out', href: './lab.html?tab=what-fits' },
    embed: 'what-fits',
  },
  {
    n: 22,
    part: 4,
    title: 'What it costs',
    idea: 'The smallest model that clears the bar, the cache, and the precision cliff.',
    status: 'planned',
    tryIt: { label: 'the cost levers', href: './explain.html?section=inference' },
    embed: 'quantisation',
  },
  {
    n: 23,
    part: 4,
    title: 'Play it, then look inside',
    idea: 'Two same-size agents, one lesson: training budget, not parameter count, was the lever.',
    status: 'planned',
    tryIt: { label: 'play the agent', href: './capstone.html?section=play' },
    embed: 'tictactoe',
  },
  {
    n: 24,
    part: 4,
    title: 'The concept nobody labelled',
    idea: 'Nobody told it which items are fragile. Its embeddings cluster by fragility anyway.',
    status: 'planned',
    tryIt: { label: 'the warehouse agent', href: './capstone.html?section=warehouse' },
    embed: 'warehouse',
  },
  {
    n: 25,
    part: 5,
    title: 'Emergence',
    idea: 'From a number line assembling itself to the argument about scale.',
    status: 'planned',
    tryIt: { label: 'structure, noise, and the observer', href: './lab.html?tab=structure-vs-noise' },
  },
  {
    n: 26,
    part: 5,
    title: 'The strange loop',
    idea: 'The agent loop pointed back at itself, and what Hofstadter would make of it.',
    status: 'planned',
    tryIt: { label: 'steer a representation', href: './lab.html?tab=steering' },
  },
  {
    n: 27,
    part: 5,
    title: "What we can and can't claim",
    idea: 'Prediction or understanding — argued with the mechanism in view, refusing both slogans.',
    status: 'planned',
  },
]

export const publishedCount = () => POSTS.filter((p) => p.status === 'published').length
