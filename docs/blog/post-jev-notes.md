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


---

# Review round (20 September 2026)

An external review of the draft found three real problems. Two were in the prose; **one was a
defect in shipped code**, and it was right.

## 1. The measurement was wrong (code)

The tab scored **top-1 probability** against "was the top-1 move in the optimal set". Measured:
**46.8% of the 4,520 states have more than one optimal move** (mean 1.96, up to 9). A model that
correctly splits its belief across three equally good moves shows 0.33 and is then scored correct,
which manufactures the appearance of under-confidence out of nothing.

Measured both ways on the strong model:

| stated | top-1 measure | mass-on-optimal-set measure |
|---|---|---|
| ~26% | 92% optimal (looks wildly shy) | 12% optimal (slightly over-confident) |
| ~45% | 94% optimal | 61% optimal |
| ~65% | 99% optimal | 98% optimal |
| ~96% | 100% optimal | 100% optimal |

So "badly under-confident, says 30% and is right 96%" **does not survive** and has been removed
from the tab, the post, `CLAUDE.md` and `GUIDE.md`. The tab now plots both curves, because which
measure is correct depends on whether you are testing a *ranking* claim or a *probability* claim —
and that turned out to be a better lesson than the one it replaced. `MEASURED.ttt.confidence.ties`
records the tie statistics; the header comment in `CalibrationSection.tsx` records the error.

**What survives unchanged:** the weak model's constant confidence (17.4158%–17.4225%), which no
scoring choice explains, and the strong model's ranking gap (71.5% vs 48.1%), which ties would if
anything *understate*.

## 2. The occupied-cell example proved the wrong thing (code + prose)

An occupied cell is **illegal**, and legality is exactly what a schema can encode — offer only the
empty cells and the 60% vanishes. Citing it as the limit of schemas invited "you wrote a bad
schema". There are three failures and only the first is cured for free:

- **malformed** — impossible by construction;
- **illegal** — encodable, if you bother; we deliberately do not, so the check layer has work;
- **legal but worse** — the strong agent, ~2% of positions. No schema can ever exclude this.

The third is the real evidence and now leads, in the capstone copy, the post and `CLAUDE.md`.

## 3. The questions were partly answered already (prose)

Checking TypeSafe's own write-up rather than the coverage changed the piece substantially:

- They say of the 0% figure: *"Our number is not empirical. Schema matching is guaranteed, thus we
  can confidently add 0% into the plots."* They are not claiming correctness, and they say so.
  Attacking that number would have looked like not reading the source. The post now credits it.
- Their calibration claim is *"Calibrated: higher confidence means higher accuracy"* — a **ranking**
  claim, not "0.9 means nine times in ten". So the draft's headline question was aimed at a claim
  they had not made. The sharpened question is what that means when several answers are acceptable.
- The method is **Reinforcement Learning for Calibrated Decisions (RLCD)**, so calibration is what
  they optimised for. Testing it is fair rather than a gotcha.
- Their workflow benchmark uses *"the average of GPT-6 Astra and Fable 5.1 as the reference
  answer"*, so the ~68% is agreement with two frontier models rather than ground truth. That is now
  one of the three questions, and it is the most substantive one.

## Verified rather than asserted

- **4,520** is the count of *non-terminal* reachable positions. Walked the tree: 5,478 reachable,
  958 terminal, 4,520 non-terminal. The post now says non-terminal so it can be checked.
- The weak model's 17.4% sits well above uniform (1/9 = 11.1%) while still being constant, which is
  a strange shape and worth a sentence if the post ever grows.

## Still open for Greg

- **Disclosure.** The reviewer notes that a public post from a legal-AI CTO questioning a new
  vendor's claims can read as competitive positioning whatever the intent. One line saying JabberLM
  is a personal project would keep the "genuine questions" framing believable. Not added, because
  it is his call how to word it.
- The earlier edits "for the weakly trained model" and "the Jev guys" are both gone: both models
  are now introduced at the top of that section, and the register no longer needs the nickname.

---

# Framing round (20 September 2026)

A second conversation sharpened the thesis, and the post was restructured around it.

**The mechanism is old; the calibration claim is the new part.** Reading a model's scores over
just the allowed answers and softmaxing over those is how multiple-choice benchmarks have been
scored for years. ~~Architecturally Jev is a classifier.~~ **SUPERSEDED 25 September 2026 — see
`post-jev-sources.md`.** TypeSafe's own docs show a `criteria` map of option name to natural-language
description, supplied per request, so the answer slots are bound to meaning by text rather than by
training. That is not a classification head. The supporting claim that the leading open clone is a
BERT-family encoder also fails against the community Decision Index, where Laya scores 5.5 to Jev's
51.7 and the best reproduction is a 27B autoregressive fine-tune. The post now leads with that, and with the
fact that JabberLM has been running the naive version of exactly that mechanism for weeks —
`readCells` is one pass, nine cells, a softmax. That is a stronger opening than the schema argument
because it is generous, verifiable and hard to dismiss, and it makes the calibration question the
obvious one rather than a pivot.

**What was deliberately kept out.** An early instinct was to call Jev "a decision tree with Monte
Carlo weighting". Both halves are wrong and easy to refute: a tree's outputs are fixed at training
time, whereas Jev takes new questions and new answer sets per request (up to 255 options), which
needs learned language representations; and Monte Carlo needs a simulator, which exists for a
tic-tac-toe board and not for "is this ticket angry". The probabilities almost certainly come from
the network's own output distribution. Putting the guess in the post would have handed a reviewer
an easy win.

**The useful corollary**, which is now in the tab copy: Monte Carlo estimates are calibrated if the
simulator is right, whereas learned probabilities are only as calibrated as training made them.
That is precisely why the calibration test is the right one to run, and why TypeSafe going after it
explicitly is a reasonable thing to do rather than a marketing flourish.

**Site copy updated to match:** the capstone now says the same network read this way is a
classifier and that the technique is old, and the calibration tab notes that a model's scores are
trained to mean "how likely is this token next" rather than "how likely am I right" — which is why
calibration has to be pursued on purpose.

**Disclosure added** to the LinkedIn version at Greg's request, for one editing pass: *"JabberLM is
a personal side project for teaching, unrelated to my work."* Final wording is his.

Post is now 2,968 characters of LinkedIn's 3,000, including the disclosure.

---

# Thresholding round (20 September 2026)

Greg spotted that TypeSafe's own FAQ answers the question the post was circling. It asks **"Can
Jev still get things wrong?"** and answers yes: the shape of the answer is guaranteed, the
correctness is not; it cannot invent a category outside your list, but it can choose the wrong one
from inside it. Then it gives the operational advice — use the probabilities and confidence to set
the threshold at which your software acts on its own versus sends the case for review, higher for
higher-stakes decisions.

**We had only half-covered this.** The post credited them for saying the 0% figure was "not
empirical", which is the weaker of the two concessions. Publishing an argument that a schema
guarantees valid-not-correct, while they say precisely that in their FAQ, would have read as
though the post had not looked. Same failure the earlier review caught on the 0%; this one went one
level deeper.

**It improves the piece rather than weakening it.** The argument is no longer "they overclaim" —
they do not. It is: their design is sound, it rests entirely on the confidence number being good
enough to threshold on, and both of my mistakes are ways that number quietly fails to be. A
constant confidence cannot carry a threshold at all. A confidence whose apparent calibration flips
when you change the scoring rule leaves you unable to place the threshold even though nothing about
the model changed. The closing question is now the genuinely useful one: what would you tell
someone choosing their first threshold?

**Site copy follows.** The calibration tab now opens its conclusion with what the number is *for* —
deciding when to act without review — because that is what makes both failures matter rather than
being curiosities. The capstone says the same in one line.

## Verification status of the quote — RESOLVED

The FAQ **question** was confirmed verbatim by fetching typesafe.ai. The **answer** is JS-rendered
and could not be fetched here, so it was flagged for checking. **Greg confirmed on 20 September
2026 that he copy-pasted the answer directly from the live page**, so the wording is verified at
source. Independent write-ups corroborate the substance ("cannot invent a category outside that
list", "guarantees the shape of the output, not its correctness", "a confidence score your code can
gate on").

Their answer, as published:

> Yes. Jev guarantees the shape of its answers, not that every decision is correct. If you provide
> a list of categories, it can't invent a category outside that list, but it can choose the wrong
> one. Uncertainty is a feature! You can use Jev's provided probabilities and confidence to set the
> threshold for when your software acts autonomously and when it needs further review: higher for
> higher-stakes decisions, lower when errors are less costly.

---

# Rewritten around the talk (20 September 2026)

Greg supplied the transcript of TypeSafe's founder's talk. The post is now built on that argument
rather than on our own measurement history, and it is a much better piece for it. Their case is
more interesting than the launch material, and it is one JabberLM happens to be able to illustrate.

## Their argument, as given

1. **The field holds two incompatible views.** One: AI is going extraordinarily well, every
   benchmark falling, autonomous operating time growing exponentially. Two: it is a bubble
   generating no value, and everything is a chat app. Everyone agrees only that the other side is
   mad.
2. **The divide is explained by one thing.** The tasks AI excels at are those whose goal is to
   *please a human in the loop*. The tasks it fails at — customer service decisions, apparently far
   easier — are those whose goal is to *remove* the human. **Assistance versus automation.**
3. **The cause is the training objective.** RLHF collects human preferences and optimises them.
   "Why do all LLMs require a human in the loop? We literally put them in the loop."
4. **So overpromising is structural, not a defect.** "No matter how wrong the models are, they will
   look right." A model that does not know errs toward what a human would rate well. Hence: do not
   use AI for decisions with stakes to your business.
5. **The software consequence, which is the "evolution of smart software" part.** SaaS has barely
   changed since 2019; the LLM era bolted a chatbot on the side, which is what you would predict
   from an assistance-native technology. We are automating the *writing* of software without making
   software *smarter*. "We used to think that software would get a lot smarter, not just cheaper to
   write." He treats Garry Tan's "golden age of just-in-time software" as double-edged.
6. **Three North Stars.** RLHF optimises human preference; RLVR optimises raw correctness;
   TypeSafe optimises **calibrated decision-making**. Explicitly not RLVR, and he says even the API
   shape differs.
7. **On hallucination (Q&A).** Pre-training is not the problem — pre-trained models are "incredibly
   intelligent". Hallucination is intrinsic to optimising human preference: an asymmetry in the
   reward model, GAN-like, rewards confident mode-dropping because a model's uncertainty is easy to
   spot and punish.

## Why this suits the site better than the launch framing

Point 4 is, almost word for word, what JabberLM's hallucination material already says — "a
confabulated answer and a correct one are produced by the same process at the same confidence" —
arrived at independently from a tiny model. Point 7 is the mechanism behind it. And the whole
argument terminates exactly where our calibration tab begins: if automation needs us to know when
to believe a model, the confidence number is the product, and ours is a constant.

So the post no longer argues with anyone. It takes their argument seriously and shows the piece of
it that a 130,000-parameter model can demonstrate.

## Two things Greg should know

**The Jevons connection is not in the talk.** He asked. The model is named for the Jevons paradox
and the launch coverage leans on it, but the talk makes a different and better argument: not "make
decisions cheap and people will use more of them" but "software should get *smarter*, not merely
cheaper to write". The explain page's inference-economics paragraph still stands on its own as
general teaching, but it should not be attributed to this talk.

**A name discrepancy, so the post names nobody.** The auto-transcript renders the speaker as "Tiago
Almeida"; TechCrunch and the other coverage say **Diogo** Almeida. Probably a transcription error,
but the post says "TypeSafe's founder" rather than risk misnaming someone in a piece whose whole
virtue is being careful with sources. Worth a ten-second check before publishing if you want to
name him, since the credentials are load-bearing in the opening.

## What changed in the post

The personal-confession structure is gone — no "humbled twice", no FIRST/SECOND headings. The
measurement error survives as one paragraph in the long version only, because it supports the
thresholding point, and is cut entirely from the LinkedIn version for space. The headline
measurement (17.4158%–17.4225%) carries the piece, as it should: it is the one fact here that
nobody else has.

LinkedIn version: 2,947 of 3,000 characters, disclosure included.

---

# Economic reframe (21 September 2026)

Greg rewrote the post around the economic argument, which is the right call for his audience, and
asked for a critique plus the BERT point checked. Both of his factual claims about the clone
ecosystem turned out to be true and sharper than he had them.

## Verified this session

| claim | status |
|---|---|
| "at least 6 clones in the last 2 days" | **Confirmed.** Six named within ~48 hours of the 15 Sept launch: Laya, Bespoke Nimble, Jevlike, Kev-0.5B, OpenJev, DiffusionGemmaJev. |
| "at least one uses an advanced form of the old BERT model" | **Confirmed and improved.** The leading one, Laya, is **ModernBERT-large, 421M params** — literally a modernised BERT. Jevlike is embedding-only; Bespoke Nimble is the outlier, a LoRA on a decoder (Qwen3.5-9B). |
| laya-mlx | **Real.** An Apple MLX port of Laya, which Greg has run locally. That is a much stronger credential than commentary and now appears in the post. |

The BERT detail does real work: the strongest open clone being an encoder from the BERT family is
the cleanest possible evidence that the *shape* is old and the calibration training is the new
part. It is also the same argument the site now makes on the capstone — scoring a fixed set of
allowed answers is how multiple-choice benchmarks have been done for years.

## What the critique changed

1. **"It also tells you the probability that it is right"** — removed. That is the strong
   probability claim, TypeSafe do not make it (theirs is "higher confidence means higher
   accuracy", a ranking claim), and it is precisely what our own measurement shows can be false.
   Asserting it in paragraph three gave away the one thing this post is uniquely placed to say.
2. **Half-quoting them, twice.** "Says it therefore cannot hallucinate" and the bare 0% both
   omitted their own qualifications. Both now carry the FAQ answer and the "not empirical" line.
   Credit for having read the source is worth more than the rhetorical win.
3. **The occupied-cell detail is gone**, replaced by the constant 17.4%. An occupied cell is
   *illegal*, and legality is exactly what a schema can encode — it is the weak example, as an
   earlier reviewer established. The constant confidence is the finding nobody else has.
4. **The business case now names its own dependency.** Routing low-confidence cases to a human is
   the whole economic argument, and it only works if the confidence is real. Saying so, immediately
   after showing a confidence that was not, is what makes the post more than commentary.
5. Speed and cost figures attributed as TypeSafe's own; "quicker and faster" fixed; "the Jev guys"
   dropped; disclosure restored; the long ECONOMIC VALUE block split into three; and the title
   question now gets answered in the last line.

## Files

`post-jev-linkedin_v1.txt` is the live version, 2,986 of 3,000 characters. The earlier draft is
kept as `post-jev-linkedin-v0-superseded.txt` — it is the calibration-first framing, still the
better skeleton for the book chapter, where there is no character limit and the measurement can
carry more weight.
