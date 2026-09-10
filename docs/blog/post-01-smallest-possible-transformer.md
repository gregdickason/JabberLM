# The Smallest Possible Transformer

*Post 1 of a series. Twice a week between now and the end of September, we'll climb from the
smallest language model that does anything useful all the way to the largest ones making
headlines — one rung at a time, each with something you can poke live in your browser.*

---

## In the news

This month an AI agent did something that would have sounded like science fiction two years
ago: left to run on its own, it chained together a sequence of tool calls and **worked its way
through two separate systems with no human in the loop** — *([link the article])*. Nobody handed
it an exploit or a script. It planned, acted, read the result, and acted again.

It's easy to read a story like that and feel the machine has become unknowable — a trillion
numbers humming in a data centre, a black box by definition.

So let's do the exact opposite. Let's start with a language model so small you can see **all the
way through it** — every number on the screen one you can trace back to the arithmetic — and build
up, week by week, until that headline stops being magic and starts being *mechanism*.

## Meet JabberLM

JabberLM is a real, complete transformer — the same family of architecture behind ChatGPT, Claude
and Gemini — with one difference: it's **tiny**. About **90,000 parameters**. Frontier models are
estimated to run into the **hundreds of billions, even trillions** (the labs don't publish exact
figures). That's roughly a **ten-million-fold** difference in size.

Being this small lets it do things no big model can:

- It **runs entirely in your browser.** No GPU, no cloud, no API key. Open a tab and it's there.
- It was **trained in about 30 minutes** of plain single-threaded JavaScript on a laptop (a
  MacBook Air). You can retrain it yourself and watch the loss fall in real time.
- It's **character-level** — it reads text one letter at a time — which, as we'll see next week,
  makes it the honest counter-example to a lot of things big models quietly get wrong.
- Every internal number — every attention weight, every gradient, every logit — is **on the
  screen**, there to inspect.

And here's the thing it does that makes this whole series work: this ~90,000-parameter model can
just about **sort three numbers**.

Type `sort 6 9 2` and it answers `2 6 9`. Not by looking it up — it generalises to lists it has
never seen. That is a genuinely *learned procedure*, running in a model small enough to fit inside
this paragraph's worth of description.

## One model, three lessons

The bundled model does three things at once, and the contrast between them is the entire point:

- **Poems.** Ask it for Jabberwocky-style verse and it obliges — fluent, atmospheric, and
  **memorised**. It learned the *style*, not any meaning.
- **Algebra.** Ask it to solve something like `x + 3 = 7` and it answers confidently — and often
  **wrong**. The arithmetic simply won't *fit* in a model this size, so it **hallucinates**:
  fluent, plausible, incorrect.
- **Sorting.** This one it **genuinely learned** — a rule that works on inputs it never trained on,
  and it snaps into place in a sudden jump we'll watch happen live (it's called *grokking*).

Memorisation, hallucination, generalisation — three of the most important ideas in modern AI, in
one model you can pull apart. Most of what people argue about online — *"is it reasoning or just
autocomplete?"*, *"why does it make things up?"* — is visible right here, at a scale you can
actually check.

## The ladder we're going to climb

Here's the promise of the series: it's **one mechanism — predicting the next token — the whole way
up.**

- **~1,400 params:** barely enough to learn a single letter.
- **~17,000 params:** a "draft" model that proposes words for a bigger one to check.
- **~90,000 params:** our star — sorts, hallucinates, and (later) uses tools.
- **~145,000 params:** a "mixture of experts" — many small brains in one.
- **~10¹¹–10¹² params (estimated):** the frontier — models that chain tools together to act in the
  world, for better and, as this month showed, for worse.

Same idea, scaled up roughly ten-million-fold. Nothing gets bolted on at the top whose seed you
can't already see at the bottom. That autonomous agent working through two systems? By the end of
this series you'll have watched the *exact loop* that makes it possible — on a model small enough
that we can also show you how to break it, and how to defend it.

## How this will go

Twice a week, one concept, three or four key points, and a live demo you can try yourself:

1. **We start small and honest.** Everything is grounded in a model you can inspect — no
   hand-waving, no "trust me."
2. **We climb the ladder.** Tokens, attention, training, hallucination, interpretability,
   fine-tuning, tools, agents — each post a rung, each tied to where it sits on the size spectrum.
3. **We weave in the news.** When a headline breaks — a new model, an incident, an "AI can't count"
   story — we use it as the way in, then show you the mechanism underneath.
4. **It all lands a book.** The series is the companion to *[book title]*, out at the end of
   September — the full journey from tokens to agents to the harder questions about intelligence.

**Try it now →** Open **[jabberlm.com](https://jabberlm.com)**, type `sort 6 9 2`, and watch a
90,000-parameter model do something real. Then come back Friday, when we look at the first thing
that separates how a model reads from how you do: it doesn't see letters. It sees **tokens** — and
that single fact explains a surprising amount of what AI gets wrong.

---

*Where we are on the size ladder: **~90K parameters** — sorts three numbers, writes memorised
verse, hallucinates arithmetic. Something like ten million times smaller than the models in the
headlines. We climb from here.*

*(Frontier-model sizes here are informed estimates — the labs don't disclose exact parameter
counts. We'll flag every estimate as an estimate; honesty about what we don't know is the whole
spirit of this project.)*
