# Jev: sources, and what the Decision Index actually shows

Written 25 September 2026. **This file exists because `post-jev-notes.md` contained no external
URLs at all** — every primary source was named and none was linked, on a site whose whole discipline
is traceable claims. Two claims in that file do not survive contact with the primary sources, and
they are corrected here.

## Sources

| What | URL | Kind |
|---|---|---|
| TypeSafe launch post | https://typesafe.ai/blog/introducing-system-one-models-and-jev | primary |
| TypeSafe docs, Choice primitive | https://docs.typesafe.ai/primitives/choice | primary |
| TypeSafe docs, models | https://docs.typesafe.ai/models | primary |
| TypeSafe team | https://typesafe.ai/team | primary |
| OpenRouter's Jev guide | https://openrouter.ai/docs/guides/community/jev | third party |
| LangChain, building a harness with Jev | https://www.langchain.com/blog/building-a-harness-with-jev | third party |
| TrueFoundry, what System One models actually are | https://www.truefoundry.com/blog/typesafe-ai-jev | third party, sceptical |
| TechCrunch launch coverage | https://techcrunch.com/2026/09/18/a-new-kind-of-ai-model-from-a-chatgpt-inventor-is-thrilling-developers/ | third party |
| Jev Decision Index (community leaderboard) | https://huggingface.co/spaces/multimodalart/jev-decision-index | third party, unofficial |
| Tev1-4B-experimental | https://huggingface.co/togethercomputer/Tev1-4B-experimental | primary (model card) |
| GLiNER2.5-Decide | https://huggingface.co/fastino/GLiNER2.5-Decide | primary (model card) |

**Do not cite** `aiintoai.vercel.app`'s "deep report". It asserts 24 layers, finite-state-machine
logit enforcement and placeholder-token parallel decoding, which contradicts both TypeSafe's own
`criteria` design and the fact that output tokens are free. It reads as generated filler.

## Open items now closed

- **Founder is Diogo Almeida**, co-founder and CEO, ex-OpenAI, co-inventor of RLHF and InstructGPT.
  The transcript's "Tiago" was a transcription error. Co-founders Erik Gafni and Sasha Sheng.
- **Launch was 15 September 2026**, $40M seed led by DCVC. The notes carried both 15 and 16.
- **"Up to 255 options"** is TypeSafe's own figure, from the launch post and the Choice primitive
  page. It was unsourced in the notes.

## What TypeSafe actually document

A `Choice` question supplies its options in a **`criteria` map**: option name to a natural-language
description. Their words:

> "The option names and their descriptions are both sent to the model, so write descriptions that
> separate the options from each other."

So the meaning of each answer slot is carried by **text in the request**, not by training. That is
the whole difference from a classification head, whose slots mean what training taught them.

| Documented | Value |
|---|---|
| Options per Choice | up to **255**; above that, score independently then choose |
| Questions per request | up to **64**, all against one `state` |
| Isolation | "evaluated in parallel and in isolation against the same state in one go" — one answer never becomes context for another, so **Jev cannot chain** |
| Context | 32k for state + longest question; 64k total budget |
| Output tokens | **free** — there are none |
| `confidence` | "computed from how `probabilities` is spread" — **not an independent second signal** |
| Training | **RLCD**, Reinforcement Learning for Calibrated Decisions, on synthetic data |

Undisclosed anywhere: architecture, parameter count, tokeniser, context of the training data.
Leave those as unknown rather than filling them from the unreliable report.

**Our inference, marked as such:** "in parallel and in isolation" plus "questions cost tokens" plus
"one pass" is most simply built as a block-diagonal attention mask, each question attending to the
state but not to the other questions. TypeSafe do not say this.

## The two corrections

### 1. "Architecturally Jev is a classifier" was wrong

A classification head is `d_model × K` with the slots bound to meaning by training. Jev takes a new
answer set per request with the meanings supplied as prose. Those are different machines. The
constrained *output* is old; an arbitrary per-request schema trained for calibration is not BERT
plus a linear layer.

### 2. "The strongest open clone is an encoder from the BERT family" does not survive

This was the load-bearing evidence for "the shape is old", and the Decision Index contradicts it.
The index is a 40-benchmark, chance-corrected panel across five areas, where 0 is random guessing
and 100 is perfect. Snapshot taken 25 September 2026 from the Space's `data/index.json`.

| model | technique | kind | skill | ECE | acc | stated conf | params |
|---|---|---|---:|---:|---:|---:|---:|
| Jev (reference) | proprietary | — | **51.7** | 0.074 | 0.739 | 0.811 | — |
| AutoJev-27B | autoregressive | full fine-tune | **50.9** | 0.018 | 0.730 | 0.738 | 27.8B |
| Decider chat · Qwen3.6-27B | autoregressive | inference technique | **46.1** | 0.021 | 0.697 | 0.685 | 27.8B |
| JoshuaSP diffusiongemma (open-jev) | diffusion | inference technique | **44.2** | 0.215 | 0.680 | 0.896 | 25.8B |
| JevK5 | autoregressive | LoRA | **36.4** | 0.027 | 0.647 | 0.674 | 4.7B |
| Tev1-4B-experimental | autoregressive | full fine-tune | **26.3** | 0.104 | 0.634 | 0.739 | 4.7B |
| GLiNER2.5-Decide | GLiNER2 | full fine-tune | **10.0** | 0.088 | 0.434 | 0.506 | 0.5B |
| Decision 1.0 Kai | encoder | head / adapter | **7.0** | 0.185 | 0.358 | 0.542 | 0.3B |
| Laya | encoder | full fine-tune | **5.5** | 0.140 | 0.377 | 0.517 | 0.4B |
| Verdict | GLiClass | full fine-tune | **1.8** | 0.154 | 0.369 | 0.523 | 0.2B |
**Laya, the encoder the notes called the leading clone, is near the bottom at 5.5.** What actually
reproduces Jev is a large autoregressive fine-tune. AutoJev-27B matches it on skill (50.9 against
51.7) and is **four times better calibrated** (ECE 0.018 against 0.074). Of the 51 entrants, 38 are
autoregressive; the encoder and GLiNER families occupy the bottom of the board.

**Read the caveat with the table.** The Decision Index is a broad general-capability panel, so a
340M specialist losing to a 27B generalist on it is exactly what Sidebar 7A already teaches and is
not evidence that encoders are bad at routing. On its own narrow in-domain benchmark,
`fastino/fast-decisions`, GLiNER2.5-Decide scores **60.2%** against **57.6%** for JevK5 — the
specialist wins on its own ground and loses five to one on breadth. That is the honest shape of the
result, and it is the more interesting one.

It is also a community-maintained, explicitly unofficial leaderboard of self-reported runs. Treat
the ordering as indicative, not as a controlled comparison. Latency especially: Jev is measured
over HTTP and the reproductions run on local GPUs, and the Space says so.

### Jev's own reliability curve, from the same data

ECE 0.074, accuracy 0.739 against a mean stated confidence of 0.811, so it is **overconfident**, and
the shape is the familiar one: honest at the top, optimistic through the middle.

| said | actually | share of answers |
|---:|---:|---:|
| 0.55 | 0.48 | 8% |
| 0.64 | 0.52 | 8% |
| 0.75 | 0.59 | 9% |
| 0.85 | 0.71 | 10% |
| 0.98 | 0.93 | 54% |

This is the same measurement the lab's calibration tab performs on our own agents, on the same axes.
Worth saying plainly: **calibration is the claim, it is now measurable in public, and Jev does not
top its own leaderboard on it.** An open 27B fine-tune does.

## Numbers used in `post-jev-calibration-linkedin.txt`

Every figure traced. Source for all of them is `data/index.json` from the Decision Index Space,
snapshot 25 September 2026, except where noted.

| Claim in the post | Figure | Where it comes from |
|---|---|---|
| "51 open reproductions" | 51 entrants with a score | `models[]`, filtered to those with `scores.balanced_skill` |
| "best accuracy on the board at 73.9 percent" | Jev acc 0.7393; best open is AutoJev 0.7295 | `jev.calibration.acc`, checked against every entrant |
| "on calibration it comes third" | 3 of 18 entrants scored on the same n beat Jev's ECE | AutoJev 0.0178, Decider 35B-A3B 0.0226, Jevfire 0.0521, vs Jev 0.0740 |
| "the same 72,594 scored decisions" | `calibration.n` = 72,594 for both Jev and AutoJev | verified equal before the comparison was written |
| "0.018 against Jev's 0.074" | AutoJev ECE 0.0178, Jev 0.0740 | `calibration.ece` |
| "almost exactly the same skill" | 50.94 vs 51.67 | `scores.balanced_skill` |
| "says 75 percent, right 59 percent" | bucket 0.7+: stated 0.747, actual 0.590 | `jev.calibration.rel` |
| "Laya scores 5.5 where Jev scores 51.7" | 5.51 vs 51.67 | `scores.balanced_skill` |
| "40 to 200 times faster and cheaper" | TypeSafe's own claim | attributed as theirs, as in the first post |

**Fairness checks done before writing, and worth repeating for any future version.**

1. *Is the ECE comparison like for like?* Yes for AutoJev: same `calibration.n` (72,594) over the
   same 32 benchmarks, and `gaps.share` is 0.0, so it answered everything. **Not** like for like for
   Xor and reflex 27B, whose ECE is computed over 32,693 decisions — those have lower ECE than
   AutoJev and were deliberately left out of the post for that reason.
2. *Does a model look better calibrated by refusing the hard ones?* Checked. AutoJev has no answer
   gaps. The `coverage` figure of 0.76 that most entrants carry is benchmark coverage (32 of 42),
   not a refusal rate.
3. *Is the accuracy claim in TypeSafe's favour stated?* Yes, and first. Jev leads the board on it.
4. *Is the product comparison fair?* No, and the post says so: 27B against a model sold on speed and
   cost is not a like-for-like product comparison, only a like-for-like calibration one.
