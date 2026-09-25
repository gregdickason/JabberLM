# Proposal: a learning path on decision models

**Status: proposal, nothing built.** Written 25 September 2026 after checking the open
reproductions of Jev. Evidence and sources in `docs/blog/post-jev-sources.md`.

## Why this earns a place

The site already teaches four of the five ideas this path needs, in pieces, in four places. What it
has never done is put them beside each other, and the confusion they cause is now the single most
common mistake in public commentary about decision models: calling them classifiers, or calling them
prompting tricks, when they are neither.

The open ecosystem has handed us the teaching material. Fifty-one reproductions, scored on one
panel, with calibration measured the same way our own lab tab measures it. **That is a natural
experiment we could not have run ourselves**, and it answers a question the site keeps asking.

## The spine: one question, four answers

*How do you make a model answer from a fixed set, and what does its confidence mean?*

| Rung | Shape | Built on | Already on the site |
|---|---|---|---|
| 1 | Train a head for the task | classification head | glossary + `learn §5` callout |
| 2 | Read a few vocabulary scores | masked read | the classifier and game agent, measured |
| 3 | Score each option against the text | cross-encoder | nothing |
| 4 | Train the probability itself | decision model | the new capstone table only |

The punchline is the fourth column of the capstone table, and it should be the path's thesis:
**only the last one is new, and it is a training claim rather than an architecture claim.**

## Five lessons

**1. The last matrix.** Extend what `learn §5` now says. The output end is the only part of the
stack that knows a vocabulary exists, so it is the only part you have to change. Demo: none needed,
the existing logits view already shows it.

**2. Four shapes, one question.** The capstone table, promoted to a lesson with the two rows we have
actually measured filled in from `MEASURED.maskedRead`. This is where the reader learns that "it can
only answer from the list" is true of all four and tells you nothing about which one you have.

**3. Where each one breaks.** We have this and it is the site's strongest material: the masked read
holds at 99.99% on anything sentence-shaped and collapses to 2% on forty identical letters. The
general lesson is that a guarantee you got by training is not a guarantee.

**4. Calibration is the product.** The lab tab already does reliability diagrams and ECE on our own
agents. Add Jev's published curve beside ours, on the same axes: ECE 0.074, and the familiar shape
of honest at the top and optimistic through the middle. Said 0.75, right 0.59.

**5. What the open reproductions proved.** The payoff, and the lesson that changed our own mind.
Fifty-one attempts. The encoder-plus-head family, which is what everyone including us said the thing
"really was", sits at the bottom. A large autoregressive fine-tune matches the commercial model and
is four times better calibrated. And the small specialist still wins on its own narrow task while
losing five to one on breadth, which is Sidebar 7A's trade in a new suit.

## Two things to be careful about

**Do not let it become a vendor post.** Rungs 1 to 3 are evergreen mechanism and should carry the
path. The leaderboard is the evidence for lesson 5 and will age; write it so it can be re-run rather
than restated, and date the snapshot on the page.

**Do not overcorrect.** We said Jev was a classifier and that was wrong. The opposite claim, that it
is a new kind of machine, is also wrong. The output shape is old. The schema-per-request is
uncommon. The training objective is the actual novelty and the only part nobody outside has
independently verified.

## What it would cost

Lessons 1 to 3 are copy against demos that already exist. Lesson 4 is a second series on a chart
that already exists, plus a cached data file in the style of `src/data/calibration.ts`. Lesson 5
needs a small fetch-and-cache step for the leaderboard so the numbers are reproducible rather than
retyped, and a decision about how often to refresh it.

No new model, no engine change, no training. The measurement discipline the site already has covers
all of it.

## The one thing I would test before writing a word

**Whether our own classifier is calibrated on the same axes as everyone else.** We have measured the
confidence gap between right and wrong answers, and the escaped mass, but never ECE or a reliability
curve on the grocery classifier — only on the game agents. If it turns out well calibrated, lesson 4
has a clean three-way comparison. If it does not, that is the more useful lesson and the path should
be built around it. Either way the copy should follow the measurement, as it did the last three
times.
