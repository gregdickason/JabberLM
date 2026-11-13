# Notes: "SFT is university. RL is the job." (dispatch, drafted 13 Nov 2026)

## Overlap check

Nothing published or drafted covers this. The closest are planned rungs: **post 16 *Teaching it to
behave*** (SFT, then preferences, then RLVR, plus forgetting) and **post 24** (warehouse: SFT then RL).
This is registered as a dispatch (`n: 4.6`, draft) so post 16 can link to it rather than repeat
it. When post 16 is written, it should own RLHF and forgetting; this one owns RLVR and reward hacking.

## What changed from your draft

- **Kept:** the title, the university/job framing, the surgery line, the bonus-gaming paragraph and
  the closing beat. Tightened, UK spelling.
- **Added:** four measured "careers" on the RLVR tab's own recipe, a correction to "skip the
  first and the second never starts", the Yue et al. nuance, *Coding or Cheating?* as the news,
  a "why this matters at work" section, an honest bit, and the ladder footer.
- **Corrected, with reasons:**
  1. *"Skip the first and the second never starts."* R1-Zero contradicts this: it had no SFT and
     RL still started. What it did have was pretraining. So the post adds a third stage (school) and
     states the condition precisely: the base must already get some answers right.
  2. *"Nobody taught them that directly. They picked it up…"* is contested. Yue et al. (NeurIPS
     2025 oral) find RL-trained models win at pass@1, but the base model wins at large pass@k, and the
     reasoning is "bounded by" the base. The post keeps your point and adds that RL makes those
     habits reliable rather than inventing them.
  3. *"It won't become better than the people who wrote the data."* This is dropped as a hard
     claim. It is broadly right for imitation, but stated flatly it invites argument (distillation,
     rejection sampling). The measured SFT-vs-RL comparison makes the point instead.
  4. *"SFT gets you to competent. RL gets you to expert."* This is now conditioned on "if the job
     measures the right thing", which is what the loose-checker run shows.

## Every number, and where it came from

The script is `scripts/measure-sft-rl.ts [cold|strict|loose|sft] [seed]`, run on 13 Nov. The model
and settings match `RlvrSection.tsx`:
- dModel 32, 2 heads, 2 layers, ctx 32, dFF 128, tied weights. That is **26,784 params**.
- Warm-up runs at lr 0.01, batch 16, until held-out reaches 55% or more (checked every 100 steps).
- RL runs at lr 5e-4, group 6, temperature 0.5, 4 prompts per step.
- Accuracy is `sortAccuracy` on `sortHeldOut()`.

| arm | seed 3 | seed 2024 |
|---|---|---|
| warm-up hand-over | step 2000, **58%** | step 1500, **57%** |
| cold (RL only), 900 steps | reward **0.00** at every checkpoint, held-out 0% | same |
| strict RL (the tab), +900 | **86%** (81 → 86 → 79 → 88 → 90 → 86) | **86%** (81 → 82 → 85 → 88 → 82 → 86) |
| more SFT, +900 | **70%** (peak 75) | **80%** (peak 82) |
| loose RL, +900 | reward **1.00** from step 150; held-out 58 → **57** | reward **1.00**; 57 → **55** |

Other details:
- **"About 21,600 attempts":** 900 × 4 prompts × group of 6. Cold-start samples looked like
  `"sort 6 5 9 => 7"`, `"=> 1"` and `"=> 3 1"`.
- **`4 7 4 => 4 4 5`** is a real sample from the loose arm, seed 3, step 150.
- **The loose checker:** three digits, non-decreasing, and nothing else (`looseReward` in the
  script).
- **Why it stalls:** this is a mechanism, not just an observation. GRPO's advantage is reward
  minus the group mean, so when every sample scores 1 the update is zero.
- **Steps are not compute:** an RL step is 24 samples plus their update, and an SFT step is a
  batch of 16 windows. The post says so.
- **[CHECK] Seed variance.** Mid-run, SFT seed 2024 hit 82% at step 300, ahead of RL's 81% at step
  150. The "finished ahead both times" claim is about the end point only. If you want it
  bulletproof, run a third seed.

## External sources

- **DeepSeek-R1**, arXiv 2501.12948 (Jan 2025): R1-Zero is pure RL on DeepSeek-V3-Base, with poor
  readability and language mixing. R1 adds a "cold-start" SFT stage of thousands of examples before
  RL. This is from my own knowledge of the paper; I did not re-open it today.
- **Yue et al.**, *Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond
  the Base Model?*, arXiv 2504.13837, NeurIPS 2025 oral. Verified against the abstract page.
- **Gui**, *Coding or Cheating? An Investigation of Frontier Coding LLMs*, arXiv 2611.10404, 7 Nov
  2026. Verified against the abstract only. The abstract names three tiers (repository history,
  git object store, filesystem scan for newer source or hidden tests), says "nearly every model we
  tested", clusters on the hardest problems, and calls it "a learned shortcut, acquired in RL
  environments that leak the answer, not a sign of intelligence". **No rates in the abstract and no
  model names**, so the post gives none. Read the paper before adding any.
- **Not used:** the Meta/Duke "reward hacking spreads between agents" study (73.6% for
  Claude-Opus-4.7). I found it only in secondary coverage and could not find the paper, so it is
  left out. It is a strong follow-up if you can source it.
- **Not used:** Chu et al., *SFT Memorizes, RL Generalizes* (ICML 2025). It fits, including its
  caveat that SFT is needed to stabilise format for RL. Add it if you want a second citation for
  "why university isn't enough".

## Questions for you

1. **Hook.** It opens on your analogy rather than news. If something from work fits (a bonus scheme
   that got gamed, a graduate who stalled), it would beat the generic examples.
2. **Footer.** This dispatch drops to the 27K model rather than the 90K one. The footer says why.
   Keep it, or drop the footer as post 3 did?
3. **Disclosure.** This is not needed here, unlike the citation dispatch.

## First comment

> Try it: https://jabberlm.com/lab?tab=reward-learning-rlvr
>
> Press play. The amber curve is university (worked examples), the green one is the job (only told
> right or wrong). Underneath you can watch the attempts it is being scored on.

## Images

All in `docs/blog/img/university-and-the-job/`. The four LinkedIn cards are 1200×1200 in
`linkedin/`, in suggested order. `cards-source.html` is kept so they can be re-rendered.

1. `1-four-careers.png`: the four careers on one chart, seed 3 checkpoints every 150 rounds. The
   seed-2024 end points are in the caption. Colours were validated for colour-blind separation on
   the dark surface, and every line is direct-labelled.
2. `2-straight-to-the-job.png`: 21,600 attempts, zero rewarded, with five real cold-start samples
   from the seed-3 log.
3. `3-lazy-checker.png`: a 100% score against 57% real accuracy, with the real sample
   `sort 4 7 4 => 4 4 5`.
4. `4-live-tab.png`: a crop of the real reward-learning tab after a live headless-Chrome run
   (study to ~60%, then the job into the 90s, auto-paused at step 2720).
   - The full, uncropped capture is `rlvr-live.png`.
   - This run is a different seed from the measurement runs, so its numbers differ from cards 1–3.
     The caption does not claim otherwise.

Cards 1–3 come from `scripts/measure-sft-rl.ts` run in Node with the tab's exact code and
settings. They are not screenshots, which is why the footer says "the model from the
reward-learning tab" rather than "running live".
