# Dispatch notes — "A model that does not predict the next token"

## What this is

A dispatch rather than a rung: written because Jev launched on 16 September 2026, published out of
sequence. Post 1 promised exactly this — *"When a headline breaks — a new model, an incident — we
use it as the way in, then show you the mechanism underneath."* `src/data/series.ts` now has a
`kind: 'dispatch'` field so the series page can show it with a date instead of a ladder number.

Two files, as with post 3: `post-jev-typed-decisions.md` for the book, `post-jev-linkedin.txt`
plain text and copy-paste ready (513 words, 2,847 of LinkedIn's 3,000 characters, no Markdown, one
link held for the first comment).

## First comment

> The calibration measurement: https://jabberlm.com/lab?tab=calibration
>
> Switch between the two agents. The undertrained one's confidence is the same number on every
> board; the well-trained one's actually varies and ranks, and is still badly wrong as a
> probability. The tic-tac-toe agent itself is at https://jabberlm.com/capstone

## Every number in the post, and where it came from

All measured this session by sweeping all 4,520 reachable decision states with the same
logit-reading the capstone uses (`readCells`), scoring against the same minimax oracle the agent
was trained on. Recorded in `MEASURED.ttt.confidence` and `MEASURED.multitaskSortConfidence`.

| claim | measured |
|---|---|
| picks an occupied cell in 60% of positions | legal 40.2%, so illegal 59.8% — and it reproduces the shipped `MEASURED.ttt.weak.legal` of 40 exactly, which validates the method |
| confidence ranges 17.4158% to 17.4225% | min 17.4158%, max 17.4225%, spread 0.0068pp, **1 distinct value at 4dp across all 4,520 boards** |
| well-trained says 71.5% / 48.1% | mean stated confidence when its move was optimal 71.5%, when not 48.1% (n 4,425 / 95) |
| at a stated 30% it is right ~96% | the 30.0–32.5% bucket: n 51, mean stated 31.4%, optimal 96.1% |
| 4,520 positions | `allDecisionStates().length` |
| Jev accuracy 67.8% | TypeSafe's own published figure, via DataCamp's write-up. Against GPT-5.6 Terra 67.9%, Sol 74.1%, Opus 5 73.1% |
| "0% structured output error rate" | TypeSafe's own wording, quoted not paraphrased |

Also measured but only used on the lab page: the three-skill model is 98.0% confident on held-out
sorts it gets right and 93.9% confident on the ones it gets wrong (n 132 / 13).

## The finding that changed the plan

The plan predicted the undertrained model would be **over**-confident. It is the opposite and more
interesting: its confidence is a **constant**. One value, to four decimal places, across every
board. It is not a bad estimate, it is not an estimate — the number carries no information about
the position while being rendered exactly as though it did.

The strong model then separated two things the plan had treated as one. It **ranks** well
(71.5 vs 48.1) and is **badly calibrated** (says 30, is right 96). So "calibrated" had to be split
into three questions — does it vary, does it rank, does it mean what it says — which is now the
tab's spine and the post's.

## One existing claim this complicates

`src/teachers/lessons.tsx` (hallucination lesson) says: *"A confabulated answer and a correct one
are produced by the same process at the same confidence."*

The sort measurement says that is very slightly too strong: 98.0% when right against 93.9% when
wrong is a real gap. It is also far too small to act on, and the failure people actually meet is a
model 94% sure and mistaken. **Left unedited for now** — the sentence is about the language model
generating text, and 4 percentage points does not rescue it — but flagged here because the site now
holds a measurement that bears on it, and a future editor should know that before sharpening it
further.

## Tone

Greg's call: name the claim, show our own numbers, rebut humbly with genuine questions. The
questions in the post are real ones — none is rhetorical, and each has a specific answer TypeSafe
could give. Nothing is asserted about Jev that is not quoted from its own material or its
published benchmark table.

The anchor that makes the humility honest rather than performative is the verifier's-budget tab:
we shipped a metric that reads 100% and is worthless, so we recognise the shape of "0% error rate"
from having built one.
