# Spike: masked diffusion as a second decoding paradigm

**Status: spike measured, demo NOT built, and the measurement is the reason.** Written 12 October
2026. The engine work shipped; the weights did not (gitignored — no page loads them). Regenerate with
`npm run gen:diffusion-sort` (`SEED=1337`, and `SEED=2024 FILE=diffusion-sort-seed2024.json` for the
second arm), then `node node_modules/vitest/node_modules/vite-node/vite-node.mjs
scripts/measure-diffusion.ts`.

## Why this was worth doing at all

Not because diffusion was missing — plenty is missing, deliberately. Because the site was **asserting
the opposite of it**. The `autoregressive` glossary entry read: left-to-right generation "is how
language models generate text, and it is why a long answer costs more than a short one." Its `more`
field then offered exactly one alternative to writing — read the forward pass as a typed decision —
so the site's position was *you can generate in order, or not generate at all*. There was no third
door, and there is one.

Two things made that an error rather than a gap. The repo already **publishes** a table containing
`JoshuaSP diffusiongemma`, technique **diffusion**, in `docs/blog/post-jev-sources.md:84` — worst
calibration on the board (ECE 0.215) with the highest stated confidence (0.896) — and nothing in the
corpus says what the word means. And a vendor now sells the thing: Inception's own front page
(fetched 12 October 2026) says "**All other LLMs generate text one token at a time.** Mercury
diffusion LLMs (dLLMs) generate tokens in parallel." Their throughput and cost figures are
**vendor-reported and not independently checked here**, so they are not quoted as measurements.

This is decision 41/43's failure mode again: a confident claim about how models work, made from
inference rather than from a source. Same fix — read the source, correct the sentence.

## What the engine needed: nothing

The honest surprise, and the reason the spike was cheap:

- **`weightedNLL` already *is* the masked-diffusion loss.** LLaDA's pre-training objective (Nie, Zhu
  et al., *Large Language Diffusion Models*, arXiv 2502.09992, Eq 3) is
  `−E[(1/t) Σ 1[xₜⁱ=M] log p(x₀ⁱ|xₜ)]` with `t ~ U[0,1]` — per-position cross-entropy, computed only
  where the input was masked, weighted `1/t`. `weightedNLL(logits, tokens, weights)` is exactly that
  shape, so **no new op and no new gradient check**.
- **`flags.causalMask: false` already gives bidirectional attention** — normally the hard part.
- **`Model.forward` already returns logits at every position**, which is what simultaneous
  multi-position decoding needs. The site already leans on this for speculative decoding.
- `Trainer.sftMaskedStep` was a near-exact template; `SpecResult` was the template for a decode trace
  that reports its own cost.

Two faithfulness notes. `t` here is discrete — the answer is five characters, so `t ∈ {0.2 … 1.0}`;
you cannot mask 2.3 positions. And the op divides by `seq`, so the constant differs from Eq 3 by
`answerLen/seq`; since `1/t = answerLen/nMask`, the result is the mean over masked positions times a
constant, which means the gradient scale does **not** drift with how many positions an example masked.
(`sftMaskedStep`'s flat weight of 1 does drift that way. Worth knowing if that step is ever revisited.)

## The measurement

Two models, same architecture (48/3/3/192, ctx 48), same task, same 145 held-out lists, same budget
(6000 steps, batch 32, lr 0.005 — the `gen:sort` defaults). The only differences: the objective, the
causal mask, and one extra vocabulary character for the mask (87,504 params against 87,456).

| decoder | rounds | accuracy | forwards / answer | non-permutation | confidence (mean / min) |
|---|---:|---:|---:|---:|---:|
| next-token, left to right | — | **98.6%** | 5 | 1.4% | — |
| masked diffusion, seed 1337 | 1 | **100.0%** | **1** | 0.0% | 1.000 / 1.000 |
| | 2 | 100.0% | 2 | 0.0% | 1.000 / 0.999 |
| | 3 | 100.0% | 3 | 0.0% | 1.000 / 0.999 |
| | 5 | 100.0% | 5 | 0.0% | 1.000 / 0.999 |
| masked diffusion, seed 2024 | 1 | **100.0%** | **1** | 0.0% | 1.000 / 0.999 |
| | 5 | 100.0% | 5 | 0.0% | 1.000 / 0.999 |

Both seeds, identical. The autoregressive baseline scores 98.6% under strict five-character exact
match and **99%** under the site's own `sortAccuracy()` helper (8 new tokens and a regex) — the gap is
a decoding convention, not the model, and both are on screen so nobody has to guess which was used.

## The finding, which is a negative result about the DEMO

**On sorting, the rounds dial does nothing.** One forward pass is as accurate as five. The demo this
spike was designed to produce — fast-and-inconsistent at one round, accurate-and-no-cheaper at five,
with the trade-off visible in between — **does not exist on this task**, and no amount of presentation
will make it.

The confidence column says why. At one round, with every answer position still masked and therefore
**no** sibling position to condition on, the model is already certain: mean 1.000, minimum 0.999. There
is nothing for a second round to add, because there was nothing it was unsure about. And the reason is
the task: the answer's five characters are two fixed spaces and three order statistics of the prompt —
the minimum, the median, the maximum. Each is computable from the question alone. Positions decided in
the same pass cannot take account of one another, and here they never needed to.

So the measurement did not merely fail to support the planned demo; it explains the failure, and the
explanation generalises into the thing actually worth teaching: **parallel decoding is free exactly
when the positions do not need to know about each other, and sorting was chosen years ago — for
unrelated reasons — to be a task where they do not.**

A smaller observation, recorded so nobody builds a story on it: the **order** of commitment is
essentially arbitrary. Every confidence is saturated at ≥0.999, so the ranking is decided in the fourth
decimal place, and the two seeds disagree about which position goes first (1337 commits offset 1
43% of the time; 2024 commits offset 3 35%). There is a mild tendency to commit the two **spaces**
first — 76% for one seed, 47% for the other, against 40% by chance — which is weak, seed-dependent,
and not worth a sentence of copy.

## What is NOT claimed

- **Not that diffusion is better.** 100% against 98.6% is two lists out of 145 on a task both
  effectively solve.
- **Not that it is faster.** It needs 5× fewer *sequential passes*, which is the real lever at scale
  and the same one speculative decoding pulls. But a pass here is a full bidirectional forward over
  the whole sequence and cannot use a KV cache, while the autoregressive baseline's five passes can.
  Forwards are not work. Wall-clock was not measured and should not be guessed at.
- **Not that it learns faster**, although it reached 93% by step 1000 and 100% by step 2000 of its
  6000. That comparison is **confounded and the claim is therefore not made**: `diffusionStep`
  supervises only the answer region, while the baseline's `stepBatch` spends most of its gradient
  predicting the un-guessable prompt — which is the entire reason `sftMaskedStep` exists. The fair
  arm would be autoregressive training with `sftMaskedStep` on the same lines, and it has not been run.
  (This is `tictactoeLM`'s F-15 again: steps are the wrong unit when what is supervised differs.)

## Recommendation

**Do not build a diffusion tab on sorting.** It would show a dial that does nothing and invite the
reader to conclude parallel decoding is simply free.

**The task that would show it is the adder**, and the reason is specific: the digits of a sum are
genuinely mutually dependent, because carries propagate from the low end. A one-round decode of a sum
should produce carry errors that more rounds repair — the exact curve sorting refused to produce. The
corpus, the oracle (`addOracle`) and the whole fixed-budget framing already exist in
`src/data/addition.ts` and the Limits group. **This is a prediction, not a measurement: it has not been
run.** If it holds, the demo has a real lesson and a natural home next to `what fits`. If it does not,
that is worth knowing too, and the cost is one more 19-minute training run.

## Shipped regardless of the demo

The corrections stand on their own, since they were wrong sentences rather than missing demos:
`autoregressive` and `next-token-prediction` in the glossary; new `diffusion-model` and `world-model`
entries; the autoregressive qualifier on `what fits` (which **strengthens** that tab's argument — a
diffusion pass costs the same fixed work, so only the narrower "one pass per token" assumption goes);
the scope declaration at `glossary.html#out-of-scope` and on the teachers page, which was
`site-evaluation.md` item 12 and had never been done; and the capstone's world-model paragraph.

## One thing for a person to settle

`MEASURED.sortOnly` in `src/data/modelStats.ts` says **97%** on 145 unseen lists. The shipped
`sort-model.json`, measured today with the site's own `sortAccuracy()` on `sortHeldOut()`, gives
**99%**. Left alone deliberately: `MEASURED` is hand-maintained precisely because only a person can
say what a number was measured on, and this may be a different checkpoint or a different sample.
Flagging, not editing.
