# Words as coordinates — how meaning becomes maths

*Post 3 of a series climbing from the smallest language model that does anything useful to the
ones in the headlines, one rung at a time, each with something you can run in your browser.*

---

A computer has no idea what *ocean* means. It does arithmetic, and nothing else. So the first
problem in building a language model is how to turn a word into numbers without throwing the
meaning away.

The answer is geometry, and you can check it yourself in a minute.

## Every word gets a position

Turn a word into a list of numbers and you have given it a position in space. Two numbers would put
it on a map, like longitude and latitude. Three would put it somewhere in a room, adding a height.
Real systems use dozens or hundreds, which is impossible to picture and works in exactly the same
way.

Mathematicians call that list a **vector**.

Nobody assigns those numbers by hand. They are learned from ordinary text, on a single principle:
**words that keep the same company end up in the same neighbourhood.** *Ocean* and *sea* turn up
in similar sentences, so they sit close together. *Ocean* and *king* do not, so they do not.

## Two questions, before you read on

Which words do you think sit nearest to *ocean*?

And can you do arithmetic with words? Take the position of *king*, subtract *man*, add *woman*.
Do you land anywhere sensible, or somewhere random?

Have a guess before you look. There is a live version on
[JabberLM](https://jabberlm.com/explain?section=embeddings), my demo site, where you can type your
own words and watch it work — and you are welcome to drop the same component into your own site or
training material. The answers are at the end of this post.


## Why this matters at work

This is the engine under semantic search. It is why a search for "how do I cancel" finds a page
titled "ending your subscription" with not one word in common, and it is the retrieval half of
every system that answers questions from your own documents.

It is also where a particular kind of bias comes from. These positions are learned from human
writing, so whatever associations that writing carries end up in the geometry, and then in
everything built on top of it.

One caveat about the demo: no model is running in it. The vectors are a 1,429-word slice of a
public set called GloVe, worked out in advance. Modern systems go further and compute a word's
position *in context*, so that *bank* sits somewhere different in a sentence about rivers.

## The answers

Nearest to *ocean* is *sea* at 0.88, then *seas* at 0.85, then *coast*. That is similarity on a
scale where 1 would mean identical.

And the arithmetic works. King minus man plus woman lands on **queen**, scoring 0.86. Paris minus
France plus Italy lands on **Rome**, at 0.84.

Nobody taught any of these models about royalty, or about capital cities. Those directions fell
out of the text on their own.

Next week: what happens when a model has to choose what comes next, and why always choosing the
most likely thing is the wrong answer.
