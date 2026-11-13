# Weight-space programming: what the paper shows, a measured spike, and a proposal

Written 4 November 2026. **Status (7 Nov): parked as a potential addition — not scheduled.** **Proposal only, nothing on the site has changed.** The one code addition
is a measurement script, `scripts/measure-weight-space.ts`, which reproduces every number below.

---

## The paper

*Sparks of Weight-Space Programming: LLMs can natively read & write neural network weights*,
Rikiya Takehi, Jayden Teoh, Alex Zhang, Omar Khattab (MIT CSAIL), 2 November 2026. It is a
**blog post, not a peer-reviewed paper**, with logs at `github.com/RikiyaT/lm_understand-logs`.
No independent check of the editing results exists yet. Simon Willison reproduced only the
no-tools "which game is this?" reading test.

GPT-6 Astra is given a small network's weights as text, and:

| Exp. | Network | Task | Tools | Result |
|---|---|---|---|---|
| 1 | MLP, 17K | name the game a PPO policy was trained on | none | 4/4 correct |
| 3 | char transformer, 7.2M (middle blocks only) | name the training language; find copying heads | Python, cannot run the net | correct both attempts; every copying head, no false ones |
| 4 | car policy, 172K | fix a policy stuck on a ramp, from one failed episode | none, one attempt | 1,024/1,024 episodes succeed (PPO: 0/256); 3.5% of weights changed |
| 5 | MLP, weights all zero | **write** MinAtar policies from the game rules | none, one reply | Breakout 517.4 vs PPO 15.8 at 100M steps |
| 6 | 1.48M | write a 9×9 Go policy | Python, 0–50 forward passes | beats a PPO net trained on ~20M games at 50 passes |
| 8 | Qwen3.5-0.8B | stop reasoning loops | Python, 10/25/50 passes | MATH-500 7.9% → 48.1% at 50 passes, editing 0.016% of weights |

**What it does not report:** any wall-clock time, cost or token count. Its comparisons with
training are sample counts (PPO steps or games), not compute or time. Willison's local
reproduction of the reading test took **46 to 65 minutes per network** on Qwen 3.8 27B (Kimi K3.1
Pro: 9m 41s).

**Its own limit, which our spike reproduces:** on Gemma 3 270M, editing could not improve
MATH-500 (6.8% → 7.0–7.7%). In the authors' words, editing *"could remove an obstacle that hid an
ability, but it could not add an ability the model lacked."*

**Two cautions for any copy.** (a) In Exp. 6 the post says "equal-sized PPO network", but the
setup lists a 243→32→32→82 PPO net, far smaller than Astra's 1.48M. (b) The newsletter's "with 50
steps, improve in a general direction" means a budget of 50 *forward passes*, not 50 optimisation
steps.

Sources: [authors' post](https://rikiyat.github.io/blog/weight-space-programming/) (primary) ·
[Willison's reproduction](https://simonwillison.net/2026/Nov/3/qwen-can-interpret-model-weights/) ·
[alphaXiv listing](https://www.alphaxiv.org/abs/2611.weight-space-programming).

---

## The spike: descending sort, three ways

Same starting point as the lab's LoRA tab: `public/sort-model.json` (87,456 params), which sorts
**ascending** at **99%** on all 145 unseen lists (`sortHeldOut()`). The goal is **descending** on
the same `sort a b c => ` prompt. Measured on this laptop, single thread.

| method | what changes | time | descending, 145 unseen | ascending afterwards |
|---|---|---|---|---|
| **written by hand** (by me) | 384 weights (0.44%): four embedding rows swapped | **0.02 ms** to apply, 0 training steps, 2 evaluations | **99%** | 1% (the edit replaces it) |
| **LoRA SFT** (the tab's recipe: rank 8, attn+mlp, lr 0.01, batch 16) | a 10,368-param adapter | ≥90% on the tab's 40-list check at step **280 (86 s)**; the tab's gate stops at step 780 (239 s) | **96%** | 99% with the overlay off |
| **RLVR** (the RL tab's recipe: lr 5e-4, temp 0.5, group 6, 4 prompts/step), reward = "is it sorted descending" | all weights | **600 steps, 187 s: never starts.** Mean reward 0 on 11 of 12 checkpoints | 5% throughout | n/a |

### Why the hand-written edit works

The model's vocabulary has the digits **1 to 9** (no 0), and its embeddings are **tied**: the
same table is read at the input and used to score the output. Swap the rows for 1↔9, 2↔8, 3↔7
and 4↔6 (5 maps to itself). Now `sort 6 9 2` *looks like* `sort 4 1 8` to the model. It sorts
that ascending (`1 4 8`), and because the output scores use the same swapped table, `1 4 8` comes
out as `9 6 2`. Ascending sort of 10−d is descending sort of d.

As a change to the weights, this is **ΔE = PE − E**, which is non-zero on 8 rows, each pair being
`+v` and `−v`. So it is **rank 4 by construction**: a low-rank overlay like LoRA's, but on the
embedding table, where our LoRA does not reach (it adapts Wq, Wv and W2).

### What the timings mean, and what they don't

- **I read none of the weight values.** The edit comes from knowing *what the network computes*
  (order is read off token identity, and the vocabulary is symmetric). That is the paper's Exp. 5
  ("write it from the rules"), not its Exps. 1 to 4 ("read the weights"). Say so on the page.
- **"0.02 ms" is the machine's time, not the programmer's.** The fair cost is my reasoning in this
  session (a few minutes) plus **2 evaluations**. The first try assumed digits 0 to 9, wrote a
  missing row and scored 71%; one look at the vocabulary fixed it. That is the paper's
  forward-pass budget, at size 2.
- **It relabels an ability the model already has rather than adding one,** which is the paper's
  Gemma limit at the bottom of the ladder. LoRA *learned* descending: same verb, toggleable, base
  kept. The edit only *borrowed* ascending in a mirror. The same trick cannot teach a genuinely
  new skill, and it cannot keep ascending alive without an overlay switch.
- **RL failing is the cold-start lesson,** not a verdict on RL. An ascending model almost never
  samples a descending answer, so a correctness-only reward is zero and there is no gradient. The
  RL tab already teaches this and fixes it with an SFT warm-up.

---

## Proposal for the site

**Recommend A, with B as its interactive half. Both reuse what already exists.**

**A. A third arm on the LoRA tab, "or write it by hand".** Below the adapter chart, add a panel
that applies the written edit as a toggleable overlay (a `deserialize` copy with the four rows
swapped, so no engine change), and shows the measured comparison: 0 steps / 99% against the
adapter's curve. Copy: what the edit is, why tied embeddings make it exact, that no weight was
*read*, and the "relabels, doesn't add" limit. Link the paper. Cost: one component plus copy; the
embed (`lora`) gains it for free if it lives in `LoraSection`.

**B. "Program it yourself".** A 9-slot digit-mapping control: the visitor chooses where each
digit's embedding row goes, and the model re-sorts live. The mirror gives descending; any other
order-reversing or arbitrary permutation sorts by *that* order (e.g. "odd before even"), which
shows the model sorts by row identity, not by numeric value. This is the strongest teaching
moment in the idea, and it's ours, not the paper's. It runs on the same forward pass, and every
choice is checkable against `sortAccuracyDir` with the mapped order.

**C (not recommended now). A live "Claude edits the weights" demo.** It needs an LLM call from
the page. That means an API key or proxy, cost, and a model reading 87K floats (about 500K
characters, beyond what is useful in one prompt). It also breaks the site's "runs entirely in your
browser" promise. If wanted, do it as a recorded run with the transcript shown, never live.

**For the blog:** a dispatch on the paper fits post 15 *How a model is made* (fine-tuning versus
LoRA) and post 26 *The strange loop* (a model editing a model). The honest headline from our
spike: **"Writing the weights took two tries and no training. It only worked because the answer
was already in the model."**

## Questions for you

1. A only, or A+B? B is the more original piece and a little more UI.
2. Should the RL row stay in the comparison? It is honest and teaches cold start, but a reader
   could read it as "RL is useless". The alternative is an SFT-warm-up + RL arm, which is just the
   RL tab again.
3. Do you want me to attempt a **harder** edit before anything ships: one that needs reading the
   weights, such as making the Forgetting tab's `tros` verb sort descending while `sort` stays
   ascending? I would report it with a forward-pass budget, like the paper, and say plainly if it
   fails.
