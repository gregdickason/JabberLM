# A model that does not predict the next token

*A dispatch, 20 September 2026. Off the ladder: the series climbs in order, and occasionally
something lands that is worth stopping for.*

---

A new model called **Jev** arrived this week that does not predict the next token. It does not
write at all.

You give it a question and a list of allowed answers, and it returns one of them in a single pass
with a confidence score.

Strip away the framing and the mechanism is not new. Run one forward pass, read the scores for just
the allowed answers, ignore the rest of the vocabulary, and softmax over what is left. That is
roughly how multiple-choice benchmarks have been scored for years. Architecturally this is a
**classifier**, a very capable one.

I know it is not new because I have been running the naive version of it for weeks without
noticing. The [tic-tac-toe agent](https://jabberlm.com/capstone?section=play) does exactly that:
one pass, read the scores for the nine cells, softmax. I had never thought to call it a typed
decision.

So the interesting claim is not the shape — and TypeSafe are clearer about this than most of the
coverage of them. Their FAQ asks **"Can Jev still get things wrong?"** and answers yes: it
guarantees the shape of its answers, not that every decision is correct. It cannot invent a
category outside your list, but it can choose the wrong one from inside it.

Their answer to that is the part worth testing. Use the confidence score to set a threshold: act
automatically above it, send for review below it, and raise the bar when the decision matters more.
Uncertainty as a feature rather than a defect. That is a sound design, and it is exactly the thing
both of my own mistakes made impossible.

That claim is narrower than the coverage around it suggests, and it is worth reading their own
words. They report a 0% structured output error rate and then say plainly: *"Our number is not
empirical. Schema matching is guaranteed, thus we can confidently add 0% into the plots."* They are
not claiming the answers are right. They are claiming the answers are well-formed, and saying
openly that this holds by construction rather than by measurement. That is more careful than most
launch material, and it deserves crediting before anyone argues with it.

So the load-bearing claim is the other one. Their model card says **"Calibrated: higher confidence
means higher accuracy"**, and they trained for it deliberately — Reinforcement Learning for
Calibrated Decisions — positioned against the known problem that the preference tuning which makes
a model helpful also damages its calibration. If correctness is not guaranteed, the confidence
score is what tells your software when to escalate. Unlike the 0%, that is testable.

That is a coherent thing to build and a coherent thing to sell. It is also, as it turns out, an
awkward thing to verify.

I have been running a model of the same shape on this site for weeks without thinking to call it
one. I went and tested it, and got humbled twice.

## What ours does

The [tic-tac-toe agent](https://jabberlm.com/capstone?section=play) does not write its move out as
text for something to parse. One forward pass, and the harness reads the scores for the nine cell
tokens and nothing else. One of a fixed set of answers, with a probability. A typed decision.

I ship two of them, one deliberately undertrained. Neither can return a malformed move.

The undertrained one picks a cell that is **already occupied in 60% of positions**. But that is the
weaker example and I want to be fair about it: an occupied cell is *illegal*, and legality is
exactly the sort of thing a schema can encode. I could have offered the model only the empty cells.
I chose not to, so the checking layer has something to catch.

The failure no schema reaches is the well-trained one. It returns a legal, perfectly well-formed
move that is simply **worse**, in about 2% of positions. Nobody can design that away, because the
question is which of the allowed answers is right — and that is the whole of what a schema cannot
express.

So there are three failures here, and only the first is cured for free: **malformed** (impossible by
construction), **illegal** (encodable, if you bother), and **legal but wrong** (never encodable).

## The confidence number is worse

That agent displays how confident it is in the cell it chose. I finally went and measured whether
the number means anything, across all 4,520 reachable positions.

It ranges from **17.4158% to 17.4225%**.

It is the same number every time. It does not vary with the board, because it is not looking at the
board. And it had been sitting on the screen for weeks looking exactly like a measurement.

The well-trained version is more interesting. Its confidence genuinely varies, and it ranks
honestly: **71.5%** when the move it is about to play is optimal, **48.1%** when it is not. That is
precisely the property TypeSafe claims, and mine has it — you could route the low-confidence cases
elsewhere and catch most of the mistakes.

You cannot set a threshold on the undertrained one. Every decision falls on the same side of
whatever line you draw.

Then I wrote that the well-trained one was *also* badly under-confident, because at a stated 30% it
plays the optimal move about 96% of the time. A reviewer pointed out that this was my own measurement error, and they
were right. Nearly half of tic-tac-toe positions have **several equally good moves**, so a model
that correctly splits its belief three ways shows 0.33 on each and is then marked correct. Score
the probability it placed across *all* the good moves and the same model is roughly honest.

The model never changed. The scoring rule did, and the verdict went from badly broken to broadly
fine. That is a problem for thresholding specifically: a threshold is a number, and after that I no
longer knew which number to pick.

## What I would like to know

Not a gotcha. I got this wrong twice on a model I built myself, and a reviewer had to tell me.

- **When several answers are acceptable, what does "higher confidence means higher accuracy" mean,
  and how was it scored?** Routing a ticket, grading a risk, choosing a next action: several
  answers are usually defensible, and that is exactly where my own measurement fell over.
- **The workflow benchmark uses the average of two frontier models as the reference answer.** Does
  68% mean agreement with those two, rather than correctness?
- **On the third of decisions that come out wrong, where does the confidence sit?** That is the
  number that decides whether escalation works, and it is the one I would put on the homepage.

Genuine questions. I would rather be corrected than right, and I now have the track record to prove
it.

**Try it →** the calibration measurement is live at
[jabberlm.com/lab?tab=calibration](https://jabberlm.com/lab?tab=calibration). Switch between the two
agents and watch a confidence number turn from a constant into something that means something —
though still not what it says.
