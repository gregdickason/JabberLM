# JabberLM — Evaluation of new-technique ideas (+ RMSD article)

**Reviewer:** Claude Opus 4.8 (1M context) · **Date:** 2026-07-18
**Prompt:** evaluate a batch of emailed ideas + the Applied Compute *Relevance-Masked Self-Distillation*
article in the context of JabberLM. Verdicts are grounded in a map of what the codebase already has.

## The RMSD article, briefly
Applied Compute's **Relevance-Masked Self-Distillation (RMSD)** fine-tunes a model on a new/out-of-distribution
behaviour **without catastrophic forgetting**. Two parts:
1. **Self-distillation** — the model is its own teacher (teacher sees a hinted prompt, student the plain one;
   student matches the teacher's token distribution via reverse-KL). More forgetting-resistant than plain SFT.
2. **Relevance masking** — train the loss on only a few tokens: top-T by student↔teacher logprob gap, then an
   **LLM judge** picks the S most task-relevant. Toy task: make Qwen3-4B say "pinapple" while keeping GSM8K/MMLU.

**JabberLM read:** the self-distillation-to-not-forget **core is very demonstrable**; the relevance-mask
**LLM judge is not** (no in-browser judge). We approximate "relevant tokens" with the old-task answer span and
say so plainly.

## Idea-by-idea verdict
| Idea (from the emails) | Verdict | Why |
|---|---|---|
| **Catastrophic forgetting + self-distillation / RMSD** | **★ Build (flagship)** | One demo answers four emails (self-distill, RMSD, "forgetting in SFT", "stop neglecting"). Perfect substrate; reuses `softCrossEntropy`/`distillStep`; it's the dark twin of the shipped LoRA demo. |
| **Speculative decoding** ("speculator decoder") | **★ Strong next** | Best *new* inference demo — tiny draft proposes, big target verifies in one pass, **identical output**, measurable speedup + a great accept/reject visual. Fits the inference-economics thread. |
| **Derisk ablations + held-out details** | **✓ Quick win** | Held-out is already well surfaced across lab sections. The one real risk: ablation sort-accuracy uses only **20 vectors** (a 5% wobble = 1 vector). Bump to ~60 + add an explicit "these are unseen" callout. |
| **LoRA minimum base** | **✓ Small follow-up** | Clean experiment: does the *tiny* (24/2/2) base sort well enough to be LoRA'd to descending? Teaches "LoRA needs a competent base — you can't adapt what isn't there." |
| **Other reward functions / RLVR** | **~ Real gap, higher risk** | Sort/algebra are *verifiable* → reward = "is it sorted?". Honest in-browser version = rejection-sampling / best-of-N / expert-iteration, **not** a full PPO loop. Current, valuable, but the most effort. |
| **"Training thoughts / spans"** | **folds in** | The algebra task already has reasoning spans (`7x+2=16 => 7x=14 => x=2`). Span-masked loss (train on answer vs full working) is the toy analogue of RMSD's relevance mask + reasoning-trace training. |
| RMSD relevance-mask **LLM judge** | **✗ infeasible** | No judge in-browser; approximate with answer-span masking and disclose the gap. |
| Full **RLHF / PPO** loop | **✗ out of scope** | In-browser rollouts impractical; RLVR / rejection-sampling is the honest proxy. |

## What already exists (so we don't rebuild it)
- **Distillation:** live soft-target (`DistillSection`, teacher `sort-model.json`, different-arch student). No
  *self*-distillation yet.
- **Held-out:** deterministic `sortHeldOut()` (20% of 729) + block-strided val split; surfaced as
  "held-out / unseen" in Distill/Ablation/Recovery/LoRA/Grok sections and the learn page.
- **Ablation:** deterministic (temp 0, fixed seed); solid except the 20-vector noise tail.
- **Decoding:** greedy + temperature + top-k/top-p. No draft-model / speculative path.
- **LoRA:** frozen ~90K default base → descending (just shipped). Presets: tiny 24/2/2, default 48/3/3.

## Recommended flagship (chosen) — "Catastrophic forgetting, and how to beat it"
One self-contained lab section, three live fine-tunes of the frozen ascending sort base onto **descending**:
1. **Naive SFT** (full fine-tune) → learns descending but **ascending collapses** = catastrophic forgetting.
2. **LoRA** (frozen base + overlay) → ascending **preserved** (the mechanism from the LoRA demo — *why*
   freezing doesn't forget).
3. **Self-distillation / replay** → fine-tune on descending **while distilling from a frozen snapshot of the
   old self on ascending** → **both retained**. This is RMSD's core (reverse-KL self-distill to your prior
   self); the relevance-mask judge is the real-scale extra we can't run in-browser.

Engine: two small additive `Trainer` methods — `sftStep(cfg,flags,ids)` (full-param CE on a supplied corpus)
and `replayStep(cfg,flags,{newIds,oldIds,teacher,λ,T})` (new-task CE + λ·self-distill vs a frozen teacher).
Data already in place (`buildSortCorpus`, `buildDescendingSortCorpus`, `sortHeldOut`, `sortAccuracyDir`).

**Phase-0 result (measured offline on `sort-model.json`, held-out 50):**
- **Design correction found by Phase-0:** ascending vs descending under the *same* `sort` prompt are
  contradictory for a single weight set (one input, two answers) — replay can't hold both. Fix: give the new
  task its own verb, **`tros`** ("sort" backwards → descending; all in-vocab). Now one model can hold both.
- **Catastrophic forgetting is real and dramatic** — full-param SFT on `tros` reaches ~90–98% on the new
  task but the old `sort` skill **collapses 96% → 4%**.
- **Replay / self-distillation keeps both** — at **λ=0.5, T=2, lr 0.005**: `tros` climbs to ~100% by ~500
  steps *while* `sort` stays ~92–96% (vs 4% for SFT). λ=1 also holds both, slightly slower on the new task.
  Locked defaults: **λ=0.5, T=2**. A unit test (`trainer.test.ts`) guards the mechanism at tiny scale.

## Suggested order
1. Flagship forgetting/self-distillation demo (chosen — in progress).
2. Derisk ablations + held-out callout (cheap, ship alongside).
3. Speculative decoding (marquee inference demo).
4. LoRA minimum-base experiment; RLVR / rejection-sampling.
