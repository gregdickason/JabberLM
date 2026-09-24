# Build decisions log — site work for the book/blog companion (10 Sept 2026)

Ambiguous calls made while building, so they can be reversed knowingly. Each says what the
choice was, what else was on the table, and why this side won.

---

**1. Scroll-spy uses `replaceState`, not `pushState`.**
The roadmap asked for `?section=` + `pushState` on the scroll-spy so every section counts as a
pageview. Implemented as `replaceState` while scrolling and `pushState` only on a deliberate
contents click. A history entry per section scrolled past would make the back button walk up
the page one section at a time, which is a worse thing to do to a reader than the extra
analytics row is worth. Deep-link arrivals are unaffected: the beacon reads `?section=` off
the load URL, so a blog post's "Try it →" is still counted. See `src/lib/useSectionRoute.ts`.

**2. Section ids are short and hand-set; old slug anchors keep working.**
Every section now carries a short id (`#cost`, `#loop`, `#play`). The long auto-slugged anchors
(`#loop-it-and-its-an-agent`) are kept working by an alias *map* resolved in the routing hook
(`src/lib/legacyAnchors.ts`, each page declaring `{ 'old-slug': 'new-id' }`), not by emitting
duplicate anchors into the DOM. The first attempt did emit hidden anchor spans and was wrong:
an anchor has to sit at the section it names, so a component rendering them in one place would
have scrolled every legacy link to the same spot.

**3. `?section=` beats `#hash` when both are present.** Arbitrary, but it has to be one of
them; the query form is the canonical one we publish, so it wins.

**4. Prefill silently falls back rather than erroring.**
A bad `?prompt=`/`?list=` shows the demo's own default instead of an error state. A reader who
follows a mistyped link from a post should land on a working demo, not a diagnostic. Values
are trimmed, length-capped and control-stripped (`src/lib/urlParams.ts`).

**5. The stats script regenerates structure only, not measured numbers.**
`npm run stats` re-derives params/dims/vocab from the JSON bundles. Accuracy figures stay
hand-maintained with a `measuredBy` script name, because only a person can say what a number
was measured on. The alternative — running every eval in the stats script — would make it a
multi-minute job nobody runs.

**6. `scripts/gen-stats.mjs` is plain node, not vite-node.**
Every `gen:*` script shells out to `npx --yes vite-node`, which cannot resolve in this
environment (pre-existing; `vite-node` is not in `node_modules/.bin`). The stats script only
reads JSON, so it follows `build-guide.mjs` and runs on plain node. The model-training scripts
were left alone.

**7. The chat/instruction-tuning gap is filled with two models we already ship.**
Explain gains "Why it answers instead of continuing" between hallucination and tokens. The plan
was to fake it by framing one model's prompt as `Q: … A:`; what shipped is better and real. The
three-skill model (90,336 params, trained on plain text) and the tool-calling model (88,464
params, same architecture, trained on instruction→response pairs) get the same instruction side
by side. Verified before writing the copy: sent `total of 6 9 2`, the plain-text model continues
with ` => 2 6 9` — a sorted list, confidently answering a question nobody asked — and the tuned
one emits ` => sum(6 9 2) = 16`. That contrast is the pretraining/SFT distinction with no
hand-waving. The honest caveat, which the lesson states, is that these are two separately
trained models rather than one model before and after tuning.

**8. The glossary is one page with per-term anchors, not tooltips everywhere.**
Cheaper to maintain and linkable from the book. First uses on the teaching pages link into it.
A tooltip layer over every term would need a term-detection pass over all copy and would drift.

**9. Reading-time labels raised to measured values.**
Explain 10 → 20 min, learn 15, capstone 10 → 20, harness 10 → 12. The audit measured explain at
3,000+ words plus fourteen widgets. Under-promising the time made the page feel like a failure
to finish; the honest number lets a reader plan.

**10. The adder's "200 facts" claim was corrected, not deleted.**
The page said the model was taught "exactly one thing: the addition table. 200 facts." The
corpus also holds 6,000 whole sums and 6,000 traces up to 4 digits. The corrected copy keeps
the punch and gains a stronger point: it was trained on whole sums and still cannot do them in
one pass, which is precisely why the loop matters.

**11. New embeds reuse page components; no component was forked.**
Per CLAUDE.md's rule, the prose stays on the page and the demo is the shared part. Six of the
seven needed no change at all — they were already standalone components the page merely wrapped.
The seventh, the flaky-harness demo, was assembled inline inside `HarnessApp`, so it moved to
`src/harness/demos.tsx` as `FlakyDemo` and the page now renders it under its own prose, the same
split the other harness demos already had. No frame was measured in a browser (the extension was
not connected), so all seven sizes need the visual check in step 5 of the test walkthrough.

**12. The series page lists posts from a single registry.**
`src/data/series.ts` holds the post list; `series.html` renders it and the teachers page links
it. One registry so a post's title, status and Try-it link cannot disagree between surfaces.
Posts not yet written are listed as planned, so the page is honest on day one.

---

## Still open after this build

Listed here so the next session does not have to re-derive them from the evaluation.

- **Embed frame sizes are unverified in a browser.** The Chrome extension was not connected, so
  the seven new frames in `src/embed/demos.ts` were sized from their components' content rather
  than measured. Step 5 of `docs/TEST-WALKTHROUGH.md` is the check.
- **No `og:image` per demo or per tab.** Every shared link still previews with the one site-wide
  card, so each post's "Try it →" looks identical in a social preview. Needs a screenshot script.
- **The playground sidebar still has no tooltips.** Every knob (d_model, heads, d_ff, weight
  tying, grad clip, top-k, top-p) is a bare label; the explanations exist only in GUIDE §4.
- **No embed for grokking or the Step Through.** Both are in the series plan (posts 6, 7, 8) and
  both are awkward: grokking needs minutes of live training, and the Step Through is a modal.
  Posts 6-8 currently link to the page rather than carrying a frame.
- **Logit lens, attention-on-a-poem, and a capstone "edit the rule" exercise** were Tier 4 in the
  evaluation and are untouched.
- **The series schedule is unresolved.** Post 1 promised "twice a week to the end of September" on
  27 July. Twenty-six posts at two a week runs to late November. `src/data/series.ts` lists the
  posts without dates; the cadence line needs deciding before post 2 goes out.
- **`npx vite-node` cannot resolve in this environment**, so no `gen:*` model script was run and
  no model was retrained. `npm run stats` confirms the committed numbers match the shipped model
  files, which is the part that mattered here.

---

## Limits group (14 Sept 2026)

**13. The strong form of the complexity theorem is not stated anywhere in the copy.**
Sikka & Sikka argue a transformer *unavoidably* hallucinates on tasks above O(n³). The build
measured the counter-example before writing a word: with the adder, writing the working out
(chain of thought) scores 50% at one digit and 33% at two, against 33% and 0% for a single
pass. Extra passes demonstrably extend what fits. So every tab states the defensible version —
work per pass is fixed, passes are the only currency, the supply is finite — and the "what
fits" copy names the overclaim explicitly and says why it is wrong. Merrill & Sabharwal is
cited beside Sikka & Sikka on all three tabs.

**14. The automaton row width is 12, not 64, and that is load-bearing.**
First build used 64-cell rows in a 32-character context window and the demo said nothing: rule
110, rule 30 and random bits all sat together at ~0.77 held-out loss. The cause is structural
rather than a tuning problem — predicting a cell needs its three neighbours in the row above,
about `width + 1` characters earlier, so a row wider than the context window makes the rule
invisible and every corpus looks like noise. At width 12 in a 48-character window the
separation is clean (measured at 600 steps: 110 → 0.576, 30 → 0.772, random → 0.871). The
constraint is commented in `automata.ts`, in the section component, in GUIDE §9 and in
CLAUDE.md, because it will silently destroy the demo if someone widens the rows.

**15. Rule 30 is described as "much nearer the noise floor", not "at" it.**
The draft copy claimed rule 30 was indistinguishable from random. Measurement says otherwise:
0.772 against a 0.871 floor is a real gap. The honest version is better for the argument
anyway — there is a spectrum of extractability, and rule 30 would likely improve with a bigger
model or a longer run, which is precisely the observer-dependence the tab is about.

**16. Forward-versus-reversed uses `JABBER_POEMS`, not a repeated `JABBERWOCKY`.**
The first attempt repeated one 700-character poem to length. Both directions memorised it and
reversed came out *easier* (0.158 vs 0.264) — an artefact, not an ordering effect. On the
90,000-character non-repeated corpus the effect is real and stable: forward 1.789, reversed
2.090 at 900 steps. Had it not reproduced, the feature was going to be cut rather than shipped
with a claim the site could not support.

**17. The verifier tab measures discrimination, and leads with the trap.**
The spec asked for verification accuracy against width. Measured, that is degenerate: this
model accepts a wrong answer 0% of the time at every width and by every method, so its
error-catch rate is a flat 100%. Rather than drop the tab, the flat line became the lesson —
a checker that rejects everything catches every error and is worth nothing — with the gap
between accepting a truth and accepting a lie plotted as the only informative quantity. This
is the LLM-as-judge failure mode, and it is a stronger result than the one specified.

**18. Widths, samples and step budgets, all measured rather than guessed.**
`what fits` and `verifier's budget` sweep 6 and 8 sums per width (12-second and 7-second
sweeps in node, chunked one width per animation frame so the table fills progressively).
`structure vs noise` caps at 1,000 steps with a plateau gate at epsilon 0.03; three runs at
600 steps took 66 seconds in node, so the on-page estimate is "give it a minute". The spec
guessed 1,500 steps, which would have been closer to three minutes with the ordering runs on.

**19. `verifier's budget` slug required changing the tab slug function.**
The label contains an apostrophe, which the lab's slug function turned into a separator
(`verifier-s-budget`). The explain page's slug already stripped apostrophes, so the two were
inconsistent; the lab's now matches. No existing tab contains an apostrophe, so no published
slug changed — asserted by a test.

**20. Frame sizes for the two new embeds are unmeasured.**
No browser was available, so `what-fits` (62×46rem) and `verifiers-budget` (62×34rem) were
sized from their content. Both need the visual check in the test walkthrough. The training tab
is deliberately not embeddable: a frame that needs a minute of training is workshop material.

**21. The repeating "the stood the stood" output is greedy decoding, not an undertrained model.**
Reported from the live site as a model that needed more training. Measured before changing
anything: the same weights, same prompt, at temperature 0 give "…the stood the stood the stood",
and at temperature 0.5 give "snicker-snack, / And burbles trang shere were septers trurn the
world finds disprace" — good Jabberwocky. The model was fine. `NextTokenDemo`'s "Let it write a
bit" took the argmax every step, which is deterministic and must loop once the text re-enters a
state it has seen. No retraining was done, and none was warranted.

The fix makes the failure the lesson instead of hiding it. The demo now offers both decoding
rules side by side ("Keep taking the top bar" / "Choose in proportion instead"), detects the
groove, quotes the repeating block back to the reader, and says plainly that this is not the
model being small. The teachers' lesson for `next-token` already framed it this way; the page
copy simply had not. §1 now sets the choice up and §2 picks the thread up, so the two sections
join rather than repeat.

`repeatingTail`/`readable` live in `src/lib/repetition.ts` with unit tests, including the real
greedy output as a fixture. `readable` rotates a block caught mid-word ("d the stoo") to start at
a word boundary ("the stood ") so the quote reads the way a person would say it.

---

## Calibration tab and the Jev dispatch (20 Sept 2026)

**22. The measurement contradicted the plan, and the plan lost.**
The brief predicted the undertrained tic-tac-toe agent would be over-confident. It is not. Swept
over all 4,520 reachable states, its confidence in its own chosen cell ranges from **17.4158% to
17.4225%** — a spread of 0.0068 of a percentage point, and **one distinct value at four decimal
places**. It is not a poor estimate. It is a constant that was being rendered on screen as though
it were a measurement, and had been for weeks.

The strong model then split a distinction the plan had treated as one thing. It **ranks** honestly
(71.5% mean confidence when its move is optimal against 48.1% when it is not) and is **badly
calibrated** (at a stated 30% it plays the optimal move ~96% of the time — under-confident, not
over). So the tab is built around three questions rather than one: does the number vary, does it
rank, does 0.9 mean nine times in ten. That is a better lesson than the one commissioned.

Full sweep recorded in `MEASURED.ttt.confidence`. The method reproduces the shipped
`MEASURED.ttt.weak.legal` of 40% exactly, which is what validates it.

**23. The tab sweeps every 5th state, not all of them.**
A full 4,520-state sweep is ~17s per model in the browser, too slow for a mount sweep. A
deterministic stride of 5 gives 904 states in a few seconds, chunked per animation frame like
`what fits`. The copy quotes the full-sweep figures from `MEASURED` and says on the page that the
on-screen sweep is a sample.

**24. A second measurement that is not on the tab but changed what the copy may claim.**
The three-skill model on held-out sorts is 98.0% confident when right and 93.9% when wrong
(n 132/13). So confidence does carry a signal for the language model too — a real one, and far too
small to act on. This slightly complicates `lessons.tsx`'s *"A confabulated answer and a correct one
are produced by the same process at the same confidence."* Left unedited, because that sentence is
about generated text rather than a classifier and four percentage points does not rescue it, but
recorded here so a future editor does not sharpen it further without knowing.

**25. Naming a vendor, which the site had not done before.**
Greg's call, and the register is his: name the claim, show our own numbers, rebut humbly with
genuine questions. Every question in the dispatch is answerable and none is rhetorical. Nothing is
asserted about Jev that is not quoted from TypeSafe's own material or its published benchmark
table. What keeps the humility honest is that we shipped a worthless 100% metric ourselves in the
verifier's-budget tab, so we recognise the shape of "0% structured output error rate" from having
built one.

**26. Dispatches are a new post kind, deliberately off the ladder.**
`src/data/series.ts` gains `kind: 'dispatch'` and a date. The series is a ladder and a topical post
is not a rung, so it renders with a dot and a date rather than a number. Post 1 promised to use
headlines as a way in; this is the mechanism for doing that without corrupting the sequence.

**27. The calibration tab shipped with a measurement error, and the fix is left visible.**
An external review caught it. The tab scored top-1 probability against "was the top pick in the
optimal set", and concluded the strong model was badly under-confident. It is not: **46.8% of the
4,520 states have more than one optimal move**, so a model correctly splitting its belief across
three equally-good moves reads 0.33 and is scored right. Measured both ways, the same model goes
from "stated 26% → 92% optimal" (looks wildly shy) to "mass 26% → 12% optimal" (slightly
over-confident). Both curves are now on the chart, and the copy says the tab got it wrong, because
the correction is a better lesson than the original claim: the model did not change, the scoring
rule did, and the verdict flipped.

What survived: the weak model's constant confidence, which no scoring choice explains, and the
ranking gap, which ties would understate rather than inflate.

**28. Citing illegal moves as the limit of schemas was the wrong argument.**
Also from the review, also right. An occupied cell is illegal, and legality is precisely what a
schema can encode — offer only the empty cells and the 60% disappears. The unanswerable case is
**legal but worse** (the strong agent, ~2% of positions), which no schema can exclude because the
question is which allowed answer is right. Capstone copy, the post and CLAUDE.md now lead with
that and keep the occupied cells as the secondary, deliberately-unfixed illustration.

**29. Read the vendor's own material, not the coverage.**
The draft attacked a 0% structured-output error rate. TypeSafe's own post says of it: *"Our number
is not empirical. Schema matching is guaranteed."* They also claim calibration as *"higher
confidence means higher accuracy"* — a ranking claim, not a probability one — so the draft's
headline question was aimed at something they had not said. Three of the four questions were
rewritten. The strongest surviving one came from their own benchmark note: the reference answer is
the average of two frontier models, so ~68% is agreement rather than correctness.

**30. Why preference tuning costs calibration, in two registers.**
The site asserted in several places that a model's confidence is not evidence, and the talk supplied
the mechanism, so it is now explained rather than asserted. Split deliberately by audience, and the
two must not drift apart:

- **explain §5, plain language.** A rater shown two answers usually cannot check which is correct,
  but can instantly see which sounds authoritative, complete and unhedged. Those are therefore what
  get rewarded. "I don't know" loses comparisons, so confident guessing is trained in, and the
  model's sense of its own uncertainty is flattened.
- **lab calibration tab, the mechanism.** Cross-entropy is a **proper scoring rule**: the
  loss-minimising move is to state the probability you actually believe, so pre-training yields
  roughly-calibrated probabilities for free. Scoring against a *reward model* of human approval is
  not proper — there is a gap between "looks right" and "is right" for a capable optimiser to
  exploit. Calibration measured worse after post-training than before, as reported for GPT-4.

**The honest counterweight is mandatory in both places, and is in both.** This is a trade, not a
loss: the same stage is what makes a model usable at all, and the original instruction-tuning work
reported *less* invention on closed-domain tasks. The copy must not drift into "RLHF makes models
dumber", which is not defensible — the defensible claim is that it trades calibration for
helpfulness, which is a good bargain with a person in the loop and the wrong one for software
deciding alone. Noted in CLAUDE.md so a future edit does not sharpen it.

Glossary gains **proper scoring rule** and **reward model**; the RLHF entry now carries the cost.

**31. A drift bug caught while doing it.** GUIDE §6's numbered list of the explain page had never
been updated when the instruction-tuning section was added, so it was missing an entry and
misnumbered from 5 onward against the live page. Fixed, and the new section documented. Worth a
check whenever a section is inserted: the guide lists them by hand.

**32. The calibration tab now opens from cache, and the cache is test-verified.**
It previously measured live on mount, one model at a time, so the reliability chart had one line
until a sweep finished and the other only after switching agents and waiting again. Full sweeps of
both agents over all 4,520 positions are now cached in `src/data/calibration.ts`, so both curves
are present on load. `src/data/__tests__/calibration.test.ts` recomputes them from the shipped
weights and fails on drift — including an explicit assertion that the undertrained agent still
returns an identical distribution on every example board, since the headline copy depends on it.

**33. The two measures are shown per-board, not just in aggregate.**
The statistical version (two curves on a reliability chart) did not land. There is now a worked
position: nine cells with the model's probability in each, the optimal ones outlined, and the two
readings side by side — **34.2%** on the move it picked, **99.8%** across the three equally-good
moves. Switching to the undertrained agent on the same panel shows the nine numbers not changing
between three unrelated boards, which is the most direct statement of the finding available.

**34. The tab's copy no longer narrates how we got here.**
An earlier version explained that a first attempt had been wrong and corrected in review. That
belongs in this log, not on a teaching page: a reader wants the outcome. The history is preserved
in entry 27 and in the dispatch notes.

**35. `src/types/node-fs.d.ts`, a deliberate three-line file.**
The calibration test is the first thing under `src/` to read a file from disk, and
`tsconfig.app.json` covers all of `src` with no `@types/node` installed, so `tsc -b` failed.
Adding node's full type surface to a browser app's config to satisfy a test is the wrong trade,
and importing the 1.3 MB model JSON directly would make TypeScript infer a structural type for a
megabyte of weights on every check. Declaring the single function used is the smallest honest fix.

---

## Embedded intelligence section (21 Sept 2026)

**36. The calibration embed is the worked position only.**
The embed was rendering the whole tab — selector, position panel, tiles, histogram and reliability
chart. A reliability diagram needs a paragraph of explanation to mean anything, and an embed has no
paragraphs by design. The frame now carries the agent selector, the worked position and one line of
orientation; the two aggregate charts stay on the lab page. Frame dropped from 64×52rem to 62×30.

**37. `gen:*` scripts work again, and this unblocked the whole section.**
Every generator shelled out to `npx --yes vite-node`, which cannot resolve in this environment — I
had logged that as a hard blocker. It is not: vitest ships vite-node, and
`node node_modules/vitest/node_modules/vite-node/vite-node.mjs` runs the scripts fine. All twelve
`gen:*` scripts plus `eval:tictactoe` now use that path. Training is slow — around 30 minutes for
2,500 steps at context 64 — so run them in the background.

**38. The first classifier corpus was hand-written, and the model memorised it.**
64 messages, eight per route. Result: **100% on training, 12-25% held out**, and — the part that
matters — it was **98-100% confident while wrong**. "my jar arrived smashed" came back as *allergy*
at 98%.

That is a real finding and exactly the failure the rest of the site warns about, but it is the wrong
demo for a section arguing that this technology is commercially useful. A section claiming typed
decisions can route a business's post cannot be illustrated by one that cannot.

So the corpus is now **generated**: per-route templates crossed with a slot vocabulary, ~960
training messages. The held-out split is deliberately hard — unseen templates crossed with unseen
items, so a held-out message is novel in both its phrasing and its nouns. A unit test asserts every
template carries a slot, because the first version of the generated corpus silently produced eight
delivery messages (those templates had no `{item}`) and would have reproduced the original failure
in a new disguise.

**39a. The second corpus also failed, and the diagnosis is the demo's best material.**
The generated corpus held out unseen templates AND unseen items at once, and scored 33-45% — with
the model 93-100% confident while wrong. Rather than retrain blind, the trained model was measured
on the two kinds of generalisation separately:

| split | accuracy |
|---|---|
| known phrasing, **unseen product** | **97.9%** (n=240) |
| **unseen phrasing**, known product | 39.6% (n=240) |
| both unseen | 33.3% |
| training | 99.8% |

So the model generalises over the *noun* almost perfectly and over the *sentence* hardly at all.
The original split conflated the two and hid a near-perfect result behind a near-useless one.

The reason is worth stating: "i cannot find the bread at all" shares no words with any training
phrasing for a missing item, so recognising it is paraphrase, which a 90K character model cannot
do. That is a boundary, not a bug, and it is more instructive than a demo that simply works.

The demo now shows all three: eight unseen-product messages it gets right, five ambiguous ones it
should escalate, and **two unseen-phrasing ones it gets wrong, left on screen and marked**. No
retrain was needed — the shipped weights are the ones measured.

**39b. The confidence gap is what makes the threshold more than decoration.**
On the unseen-product split the model says 98% when right and 68% when wrong. That gap is the only
room a threshold has, and it is now the closing argument of both the demo and the capstone section.

**39c. The ambiguous messages stay hand-written.**
Five held-out messages sit across two routes on purpose — "the milk was warm when it arrived" is a
quality complaint and a delivery complaint. Templates cannot generate genuine ambiguity, and these
are the point of the demo.

**40. The classifier ships trained, and shrank from 1.99MB to 0.66MB doing it.**
"The model needs to ship trained, we won't train in browser." `ClassifierDemo` never trained — it
fetches and deserialises `public/classifier-model.json` — but checking that surfaced a real defect:
at 1.99MB (819KB gzipped) it was the largest file on the site despite having the fewest parameters
(89,184, against tic-tac-toe's 127,872 at 1.3MB). Two causes, both in `scripts/gen-classifier.ts`:
it never rounded weights (every other generator does, `ROUND_DP` defaulting to 4), and
`serialize(t, text)` embedded the full 173,440-character corpus, which `deserialize` uses only to
rebuild the tokenizer — and `CharTokenizer` sorts distinct characters, so the 37-character alphabet
is equivalent. Swept 4/5/6 dp: **4dp gives 0.66MB (208KB gzipped) with identical accuracy and
identical demo rows**, category for category and percentage for percentage. The generator now does
both, and `src/data/__tests__/classifier-model.test.ts` recomputes every quoted number from the
shipped file so the rounding cannot silently move one.

**41. The ambiguous messages do NOT escalate, and the copy now says so. (Measurement over plan.)**
Decision 39c and the copy built on it asserted that the five two-sided messages would come back
with a split belief and route to a person — "the escalation design working rather than failing."
Writing the test in decision 40 measured it for the first time. **Three of the five come back at
77%, 80% and 98% on one of the two readings and are routed automatically.** Only two escalate.

The cause is worth the words it takes, and it is the same cause as the 39.6% unseen-phrasing
result: the confidence reports how familiar the WORDING is, not how ambiguous the MEANING is. "The
milk was warm when it arrived" carries "arrived", which saturates the delivery templates, so the
model answers delivery time at 98% and never weighs the other reading. Confirmed by the pair of
confidence gaps, now both in `MEASURED.classifier`: on the unseen-PRODUCT split it says 98% when
right and 68% when wrong (thirty points of daylight); on the unseen-PHRASING split, 91% and 80%,
and no threshold separates those. A confidence score sorts best exactly where the model was
already competent.

Three options were on the table: tune the model until the ambiguous rows split, drop those rows, or
publish the result. Published it. It is a sharper lesson than the one planned — a fixed answer set
and a probability on each do not make a model know when it is out of its depth — it is the honest
half of the section's own commercial argument, and it is the same discipline that overturned the
rule-30 noise-floor claim and the "badly under-confident" calibration claim. Rewritten: the demo
copy, the capstone `#embedded` prose (which gained a paragraph arguing for permanent sampled review
of the automated route), the teachers lesson (steps 2, 4 and 6), GUIDE §11 and the CLAUDE.md
summary. The test asserts the 3-of-5 split and the >95% top row, so a retrain that changes the
story fails the build rather than quietly making the copy wrong.

**42. The masked read is not a classification head, and the difference is now taught and measured.**
Asked whether the site had anywhere to explain a classification head rather than describing what a
vendor does. It did not: BERT and encoders appeared in four places, all of them in `docs/`, none on
a live page — while the published LinkedIn post already tells readers the leading open clone is
ModernBERT-large with nowhere to send them. Chapter 15B of the book outline had reserved "encoder
scoring of fixed options" as a Deeper bullet and never cashed it.

The mechanism now sits on **`learn §5`**, extended in place rather than added as a new section —
inserting one would have renumbered §6-8 and `?section=logits` is linked from `series.ts`. A second
Callout makes the point that the final matrix is the only part of the stack that knows a vocabulary
exists, so swapping it for `d_model × K` turns the same network into a classifier. Glossary gains
`classification-head` and `encoder`; `logit` and `softmax` were both hard-wired to "next token" and
are not any more.

**And the measurement went the other way, which is why it was worth taking.** `readCells` and
`classify` keep the full vocabulary head and renormalise a softmax over the answer characters, so
the obvious worry is that dividing by a small remainder manufactures confidence. Measured with the
new `scripts/measure-escaped-mass.ts`: across all 1,440 in-format messages the mass landing outside
the eight answers is at most **0.47%**, and the argmax over the whole 37-character vocabulary is one
of the eight **every single time**. The weak tic-tac-toe agent's escaped mass is **0.65% and
constant on all 4,520 states**, which is the same fact as its constant confidence wearing a
different hat. So the mask is not hiding anything — and it is not buying anything either. "hello"
routes to *wrong item sent* at **97.9%** with nothing discarded at all. That confidence belongs to
the model, and the wording-familiarity problem from decision 41 is the whole problem.

The two approaches only part company **off-distribution**, and a visitor can reach it through the
demo's own text box: forty identical letters escapes **98%** of the model's belief and the demo
still prints a route at **58%**, computed from the remainder. That is the honest statement of the
difference, and it is what the copy says — with a head the guarantee is structural and free; here it
is a learned habit that cost training capacity and holds only while the input behaves. Three tests
in `classifier-model.test.ts` lock all of it.

Two existing errors were fixed in passing. `GUIDE.md` still said the classifier trained on **64**
messages, a leftover from the hand-written corpus that decision 38 replaced with 960. And the
glossary's `typed-decision` entry was the last holdout still leading with the occupied-cell argument
that decision 28 retired everywhere else; it now leads with legal-but-worse.

**Standing rule, worth repeating: never frame a classification head as new.** The site's position is
that the shape is old — BERT plus a linear layer, 2018, still how multiple-choice benchmarks are
scored — and that only the calibration training is the new part.
