# Notes — "Looks right, is wrong" (dispatch, 7 Nov 2026)

## What you asked for, and where it is

- **Screenshots of well-formed, wrong equations**, taken from the running site with headless
  Chrome at 2× scale, in `docs/blog/img/confidently-wrong/`:
  - `play-7x.png`: playground, temp 0, `7x + 2 = 16 => 7x = 18 => x = 3`
  - `play-2x.png`: playground, temp 0, `2x + 1 = 5 => 2x = 0 => x = 0`
  - `bars-7x.png`: explain §1 bars at `7x + 2 = 16 => 7x = 1` → 8 at 0.309, 4 at 0.185
  - `play-sort.png`: `sort 6 9 2 => 2 6 9` (spare, if you want a "what it did learn" contrast)
- **The link to citation validation needing real content grounding:** the sections "What a
  checker of form can catch" and "Checking against the content". The point-of-law knowledge
  graph is described by function, not by product.
- **Subtle push back on the citation-checker post:** it is never named or linked. It is described
  as "one widely shared result" with its 97.8% figure. The push back is a single question: what
  did the fakes in its test set look like? The honest bit says outright that I have not tested
  it and am not claiming it fails.
- **The weight-space thread:** the opening paragraph (the MIT paper, unnamed in the LinkedIn cut).
- **The talk:** the Latent Space episode, used for the 70% → 99% point. See question 1.

LinkedIn cut: `post-looks-right-is-wrong-linkedin.txt`, 2,721 characters (limit 3,000). It drops
the Princeton study and the talk paragraph to fit; keep one of them if you cut elsewhere.

## Every number, and where it came from

| claim | value | source |
|---|---|---|
| ~90,000 parameters | 90,336 | `BUNDLES.multitask.params` |
| looks like valid working | 753/800 = **94.1%** | `scripts/measure-confidently-wrong.ts`; now `MEASURED.multitaskAlgebra` |
| fully right | 67/800 = **8.4%** | same |
| "four in five" in the training text | 650/800 = 81.3% | same, against `buildEquationCorpus()` |
| right when the equation was in training | 57/650 = 8.8% | same |
| bars at `7x = 1`: 8 at 31%, 4 at 18% | 0.309 / 0.185 | `bars-7x.png`, read off the live page |
| 97.8% for the hand-written citation checker | the author's own, unverified | the post you sent (image), Dealroom coverage |
| Princeton: 5 error types; good on non-existent, none reliable on wrong pincite | Liu, Stammbach, Henderson, *Who Checks the Citations?*, arXiv 2606.21155v2 (6 Aug 2026) | https://arxiv.org/html/2606.21155v2 |
| Bloomberg: 93-100% wrong case vs 37-61% wrong page (opinions) | Verma, *Is this Citation on Point?*, arXiv 2608.12571 v2 (25 Oct 2026) | https://www.alphaxiv.org/abs/2608.12571 |
| 70% → 99% in one release | **chapter title only** | Latent Space, 2 Nov: https://latent.space/p/building_legal_agents_when_you_can_t_see_the_data_-_jacob_lauritzen_cto_of_legora/ |
| MIT weight-space paper | Takehi, Teoh, Zhang, Khattab, 2 Nov 2026 | https://rikiyat.github.io/blog/weight-space-programming/ |

"Fully right" is stricter than "right final answer". The final `x` is right on 212/800 (26.5%),
but 145 of those get there through wrong working, e.g. a wrong step that happens to divide out.
The post uses the strict figure because it is about working that looks right.

## Things I need you to check

1. **[CHECK] Which talk did you mean?** I found no talk where the Legora CTO makes the
   weight-space argument itself; his weight-writing is in the X post only. The closest are the
   **Latent Space episode** (2 Nov, the day before the post: citations 70% → 99% in one release,
   and "Legora can't read a single trace of what its agent does for a lawyer") and his **AI
   Engineer Europe 2026 talk**, *Agents need more than a chat*. I used Latent Space. The 70 → 99
   figure comes from the **chapter title**, not a transcript, so listen to that segment before
   publishing. Note too that linking an episode with his name in the URL, in a post that pushes
   back on his result, is not "without naming". Drop the link, or keep it as the respectful point
   it is written as (a check grounded in the source does not move with the model). Your call.
2. **Disclosure.** "A knowledge graph of points of law" closely describes a product category.
   If you work for, or with, a company that sells one, the post needs the same kind of disclosure
   line the Jev dispatch carries.
3. **The challenge to "better than training".** I left the "better than training" claim alone
   on purpose: the author's own thread says trained and hand-written weights converge with more
   labels, and someone replied "this is literally distillation". Pushing on that would make the
   post about him. The post's question (what did the fakes look like?) is the stronger point and
   doesn't need it.

## Found on the way (site bug, not fixed)

The **playground ignores `?prompt=`** once the bundled model loads: it reseeds the prompt from the
training text (`InferencePanel.tsx` around line 95, "reseed the prompt from the (possibly new)
training text"). So `/?prompt=…` links land on `'Twas brillig`. The post links to explain §1
instead, which honours it. Worth a fix before any post links the playground with a prompt.

## Series bookkeeping

Registered in `src/data/series.ts` as a **dispatch** (`n: 4.5`, part 2, 7 Nov, `draft`), with the
explain §1 deep link as Try it and the `next-token` embed. Its material overlaps post 9 *Why it
makes things up* (algebra at 90K); when post 9 is written it should link this rather than repeat
the measurement.
