# The reflex

*Post 4 of a series climbing from the smallest language model that does anything useful to the
ones in the headlines, one rung at a time, each with something you can run in your browser.*

---

Ask a chatbot the same question twice and you can get two different answers. That is not a fault.
It is a choice somebody made, and once you see the choice you will read every AI answer
differently.

## A probability for everything

A language model does one thing. Given the text so far, it gives every possible next piece a
probability, and the probabilities add up to 1. It looks nothing up. It predicts what tends to
come next.

My demo model works one character at a time, from 77 possible characters. Give it
`'Twas brillig, and the ` and it says: *s* 17%, *c* 10%, *w* 10%, *t* 8%, and a long tail after
that. Nothing dominates, because plenty of words could come next in a poem.

Give it `sort 6 9 2 => ` and it puts 98.8% on *2*. Sorting is a skill it genuinely learned, and
you can see the confidence in the numbers.

That list of probabilities is the model's entire output. Everything else, chat, agents,
summaries, is that list, a choice from it, the chosen piece added to the text, and the question
asked again.

## Before you read on

Which piece should it choose?

The obvious answer is the most likely one, every time. So, if the model always takes its top pick,
what do you think the poem looks like? Is it the best poem this model can write?

Have a guess. The live version is on [JabberLM](https://jabberlm.com/explain?section=prediction),
with one button for each way of choosing. The answer is at the end.

## Why this matters at work

The setting that controls this is called temperature. At zero the model always takes its top pick;
higher, and it reaches further down the list. For anything that has to be consistent or audited,
such as policy wording, figures or standard replies, turn it down and keep a record of the model
version and the output.

But notice what a low temperature buys you: the same answer every time, not the right one. **A
fluent answer is a prediction, not a fact.** Last week I showed this model writing algebra that
[looks right 94% of the time and is right 8% of the time](https://www.linkedin.com/pulse/your-weight-spaced-model-looks-right-wrong-greg-dickason-0rsac/).
At temperature zero it is wrong the same way every time. The check still has to come from
somewhere other than the model.

## The answer

Always taking the top pick writes this:

`stone song, And stood the cross the stood the stood the stood the stood…`

It gets stuck. Choosing the top pick is deterministic, so once the text comes back to somewhere it
has been before, it has to say the same thing it said last time, and it never gets out. That is
not this model being small. Researchers showed the same loops in GPT-2, a model over a thousand
times larger, and it is one reason the chatbots you use choose in proportion rather than always
taking the top pick.

The same weights, choosing in proportion, write this instead:

`The quoggs shies conftercante deep, The snicker-creature roads ploud gre!`

Not Lewis Carroll, but alive. Nothing changed in the model. What changed was how its output was
read.

## This week's headline was a loop

Choosing in proportion makes the groove much rarer. It does not make it impossible.

The most-discussed AI result of recent weeks was a frontier model editing another model's
weights directly, with no training, and lifting its maths score sixfold. Underneath, it was a fix
for exactly this. The model being edited, a small open model called Qwen, was already choosing in
proportion, with an extra penalty for repeating itself. Even so, 93% of its answers on a maths
test ran until they hit the length limit, repeating the same text and rarely reaching an answer.

The edit found one direction in its weights that drove the loop and removed it. Afterwards, 33%
still hit the limit, and its score went from 7.9% to 48.1%. Critics have pointed out that most
of that gain is a model that stopped going round in circles long enough to finish.

Next week: how the model decides which earlier words matter for the next one, and why there is a
hard edge to how far back it can look.

---

*Where we are on the size ladder: **~90K parameters**, the same model as post 1. The reflex is
identical at every size; what grows is how good the probabilities are.*
