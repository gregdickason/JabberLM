# Words as coordinates — how meaning becomes maths

*Post 3 of a series climbing from the smallest language model that does anything useful to the
ones in the headlines, one rung at a time, each with something you can run in your browser.*

---

A computer has no idea what *ocean* means. It does arithmetic, and nothing else. So the first
problem in building a language model is how to turn a word into numbers without throwing the
meaning away.

The answer is geometry, and you can check it yourself in a minute.

## Every word gets a position

Give a word a list of numbers and you have given it a position in space. Two numbers would put it
on a map, three would put it somewhere in a room, and real systems use dozens or hundreds, which
is impossible to picture and works the same way.

Nobody places them by hand. The positions are learned from ordinary text on one principle:
**words that keep the same company end up in the same neighbourhood.** *Ocean* and *sea* turn up
in similar sentences, so they sit close together. *Ocean* and *king* do not, so they do not.

> **Predict first.** Which words do you think sit nearest *ocean*? And if you take the position of
> *king*, subtract *man* and add *woman*, do you land anywhere sensible, or somewhere random?

**Try it →** the demo below is the one from the site, embedded whole. Or open it full-size at
[jabberlm.com/explain?section=embeddings](https://jabberlm.com/explain?section=embeddings).

<iframe src="https://jabberlm.com/embed?demo=embeddings&word=ocean&analogy=king,man,woman"
        width="100%" height="740" style="border:0"
        title="JabberLM — word vectors: nearest neighbours, analogies, and a 2-D map"></iframe>

What comes back: nearest to *ocean* is *sea* at 0.88, then *seas* at 0.85, then *coast*. That is
similarity on a scale where 1 would mean identical. Now the arithmetic. King
minus man plus woman lands on **queen**, scoring 0.86. Paris minus France plus Italy lands on
**Rome**, at 0.84 — that one is
[`?analogy=paris,france,italy`](https://jabberlm.com/embed?demo=embeddings&analogy=paris,france,italy)
if you want to watch it happen.

The second is worth sitting with. Nobody taught this thing about royalty or capital cities. Those
directions fell out of the text on their own.

## What is actually happening

Each word here is 50 numbers. Closeness is the angle between two positions rather than the
distance, which is why the scores land between 0 and 1. *King* and *queen* score 0.78. *King* and
*ocean* score 0.23.

And because positions can be added and subtracted, a relationship becomes a **direction you can
travel along**. The step from *man* to *woman* is roughly the same step as the one from *king* to
*queen*.

## Why this matters at work

This is the engine under semantic search. It is why a search for "how do I cancel" finds a page
titled "ending your subscription" with not one word in common, and it is the retrieval half of
every system that answers questions from your own documents.

It is also where a particular kind of bias comes from. These positions are learned from human
writing, so whatever associations that writing carries end up in the geometry, and then in
everything built on top of it.

**Being straight with you:** no model runs in this demo. The vectors are a 1,429-word slice of a
public set called GloVe, worked out in advance. Modern systems go further and compute a word's
position *in context*, so *bank* sits somewhere different in a sentence about rivers.

Next week: what happens when a model has to choose what comes next, and why always choosing the
most likely thing is the wrong answer.

---

*Where we are on the size ladder: this post steps sideways off it. Word vectors are a component,
not a model, and every model on the ladder has them. Our own 90,000-parameter one included — its
nine digits arrange themselves into a number line, in order, with nobody asking them to. Same
idea, no dictionary required.*
