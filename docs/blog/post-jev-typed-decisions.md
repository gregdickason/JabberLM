# A model that does not predict the next token

*A dispatch, 20 September 2026. Off the ladder: the series climbs in order, and occasionally
something lands that is worth stopping for.*

---

A new model called **Jev** arrived this week that does not predict the next token. It does not
write at all.

You give it a question and a fixed list of allowed answers, and it returns one of them in a single
pass, with a probability attached. TypeSafe AI, the lab behind it, says it therefore **cannot
hallucinate**: the valid answers are fixed in the schema in advance, so an invalid one is
impossible. They report a 0% structured output error rate.

No quarrel with the engineering. It is a genuinely interesting design, and the constraint is real.
But I have been running a model of that shape on this site for weeks without thinking to call it
one, and what mine does is worth putting beside that claim.

## What ours does

The [tic-tac-toe agent](https://jabberlm.com/capstone?section=play) does not write its move out as
text for something to parse. One forward pass, and the harness reads the scores for the nine cell
tokens and nothing else. One of a fixed set of answers, with a probability. A typed decision.

It is impossible for it to return a malformed move.

In **60% of board positions**, the cell it picks is already occupied.

The schema did its job perfectly. Every answer was structurally valid. Most of them were nonsense,
and the game is only playable because ordinary code checks each move against the rules before
applying it. A schema constrains the *shape* of an answer. It has nothing to say about whether the
answer is true.

## The confidence number is worse

That agent displays how confident it is in the cell it chose. I finally went and measured whether
the number means anything, across all 4,520 reachable positions.

It ranges from **17.4158% to 17.4225%**.

It is the same number every time. It does not vary with the board, because it is not looking at the
board. And it had been sitting on the screen for weeks looking exactly like a measurement.

The well-trained version of the same agent is more interesting. Its confidence genuinely varies,
and it ranks honestly: **71.5%** when the move it is about to play is optimal, **48.1%** when it is
not. That gap is useful — you could route the low-confidence cases elsewhere and catch most of the
mistakes. But at a stated 30% it plays the optimal move about **96%** of the time. The number is
badly wrong as a probability while being genuinely useful as an ordering.

Which is worth separating, because "calibrated" gets used for three different things. Does the
number vary at all? Does it rank? Does 0.9 mean right nine times in ten? A model can pass any of
those and fail the others, and only the last is what the word literally claims.

## What I would like to know

Last month I built [a demo](https://jabberlm.com/lab?tab=verifiers-budget) of a checker that
catches 100% of wrong answers. It is worthless. It rejects correct answers just as eagerly, because
it is wrong about everything equally. A perfect-looking score, measuring nothing.

So when I see a 0% structured output error rate I recognise the shape, and I would genuinely like
to know:

- Does "cannot hallucinate" mean it cannot emit an **invalid** value, or cannot emit a **wrong**
  one? Those are very different promises, and only the first follows from a schema.
- The published accuracy is 67.8%. What does the confidence score do on the third of decisions that
  are wrong?
- When the set of valid answers includes ones that are wrong in the world — as our nine cells do —
  what catches it? If the answer is a checking layer, what did the schema buy?
- And does *calibrated* mean 0.9 is right nine times in ten? That is testable. It is the test I
  have just failed on my own model.

Genuine questions. I would rather be corrected than right.

**Try it →** the calibration measurement is live at
[jabberlm.com/lab?tab=calibration](https://jabberlm.com/lab?tab=calibration). Switch between the two
agents and watch a confidence number turn from a constant into something that means something —
though still not what it says.
