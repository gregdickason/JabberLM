# What changed since September, and what the series should do about it

Researched 1 November 2026, for review. Each item says which post it touches, what it would
change, and **how well it is sourced**. Primary means the vendor's or author's own page; anything
I could only reach through coverage is marked secondary, and the claims I could not verify at all
are listed at the end, so none of them gets cited by accident.

Ranked by how much they matter to the series, not by how big the news was.

---

## 1. GPT-6 Astra reasons inside one pass, and that touches our core argument

**Touches:** post 21 *What fits in one pass*, the harness page's fixed-work rule, and possibly post
26 *The strange loop*. **Recommend:** a dispatch, or the hook for post 21. This is the most
important item here.

**What happened.** OpenAI's GPT-6 Astra (3 Sept) can do multi-step reasoning with no visible chain
of thought. The system card (primary) says *"GPT-6 Astra's monitorability has decreased relative to
GPT-5.6 Sol"* and that it is *"more capable of controlling its own CoT"*. An independent LessWrong
test (RohanS, 9 Sept) wrote 24 made-up multi-hop questions, told the model to answer at once,
confirmed `reasoning_tokens = 0` on every sample, and got e.g. 100% vs 0% and 70% vs 0% against
GPT-5.6 Sol. Never worse on any of the 24. The cipher task: 0% for both.

**Why it matters to us.** The site's invariant (CLAUDE.md, harness page): one forward pass does a
fixed amount of work, so anything harder goes to more passes or to the harness. Astra looks, at
first sight, like a counter-example. It is not, and explaining why is a good post:

- A bigger pass is still a fixed pass. The fixed budget at frontier scale is simply large enough
  to hold a three- or four-hop lookup chain. Our adder shows the same shape at the bottom: one pass
  fails at 4 digits, the loop succeeds at 25. Astra moves where the line sits, not whether there is
  one. The cipher at 0% is the line still being there.
- The architecture is the open question. *The Information* reported (unconfirmed) that Astra uses
  **recurrent depth / looped transformers**, the same weights applied more than once per token.
  If the loop count adapts per token, "fixed work per pass" stops being literally true and our
  copy needs a sentence. Against that: Jakub Pachocki (OpenAI chief scientist) reportedly said
  the compute-graph depth of current frontier models, Astra included, is *"within a factor of two
  of GPT-4"*. That quote reached me only second-hand (Raschka's article as quoted on HN); **find
  the original before using it.** Raschka's own view is that the looping is overstated and the
  gain is mostly training recipe.
- The monitorability angle is the bigger story. Chain of thought was the window the harness page
  and post 20 *Reasoning in a loop* implicitly rely on: work done out loud can be checked. A model
  that does more of the work silently has less you can check. That is our "trust has to come from
  execution, not a model's opinion" line, with a frontier example.

**Action on the site, before any post:** reread the fixed-work paragraph on the harness page and
the `what-fits` tab copy for any wording that assumes a fixed **layer count**. If it says "fixed
amount of work per pass", it survives a looped model with a fixed loop count; it does not survive
an adaptive one. I have not changed anything.

Sources: [system card](https://deploymentsafety.openai.com/gpt-6-astra) (primary; I read the first
100K of 217K characters, the CoT-controllability section with the 60.9% vs 16.1% figure was not in
that portion) · [LessWrong test](https://www.lesswrong.com/posts/FsCkkoGsNmPzFKRhg/gpt-6-astra-can-do-a-lot-of-multi-hop-reasoning-without)
(primary for its own numbers) · [Raschka](https://magazine.sebastianraschka.com/p/gpt-6-astra-looped-transformers-and)
(secondary on architecture) · [HN thread](https://news.ycombinator.com/item?id=49627370).

---

## 2. Astra for Law is "not a new model": RAG at frontier scale, with the scores to prove it

**Touches:** post 10 *Knowledge you retrieve, skill you distil*, and post 18 *Giving it tools*.
**Recommend:** the hook for post 10. It is the cleanest real-world case of the post's argument
I have seen.

**What happened (17 Sept).** OpenAI's legal product is GPT-6 Astra plus a legal search index (US
case law, statutes, regulations, court rules; 230M+ URLs; case law from CourtListener) plus
written instructions for legal analysis. Same weights. On 200 questions from the private validation
set of Vals AI's Legal Research Bench, at highest reasoning effort: **54.0%** correct, against
**38.7%** for the same model with plain web search.

**Why it fits.** Post 10's claim is that knowledge is something you retrieve and skill is
something you train. Here the largest lab shipped a specialist product by changing only what the
model can look up and what it is told. And the number tells the other half: with the best retrieval
on offer, 46% of answers still fail the check. That is the check-layer argument (posts 18-19)
with a real figure.

**Caveats to carry in the post:** vendor-run; private question set, so not reproducible; the
baseline is the same model with web search, not Westlaw, Lexis or Harvey; no figure for
fabricated citations. Nothing published describes a citation-verification step.

**One for you, not the post:** if your day job touches legal research products, this one needs the
same kind of disclosure line the Jev dispatch carries.

Sources: OpenAI's page is [openai.com/index/astra-for-law](https://openai.com/index/astra-for-law/)
(returned 403 to me, **read it yourself before quoting**) · [SiliconANGLE](https://siliconangle.com/2026/09/17/openai-launches-astra-for-law-a-gpt-6-configuration-for-legal-research/)
· [Digital Applied, "not a new model"](https://www.digitalapplied.com/blog/astra-for-law-not-a-new-model-what-openai-added)
· [Artificial Lawyer](https://www.artificiallawyer.com/2026/09/18/openai-launches-astra-for-law/)
· [Law.com](https://www.law.com/legaltechnews/2026/09/17/openai-launches-legal-specific-configuration-of-gpt-6-astra-its-latest-llm-/).

---

## 3. Prompt injection on Jev: two studies, and they disagree in an instructive way

**Touches:** post 19 *Loop it, and it's an agent* (prompt injection, typed output), and the
calibration dispatch. **Recommend:** a paragraph in post 19; it is independent evidence for
something the site already claims.

- **HiddenLayer (14 Oct, Yeung & Schulz):** a simulated shop, a Jev-driven browser agent, and a
  planted ad that diverted it from its purchase. Jev fell for it *less often* than a Qwen3.8-27B
  tuned as a decision model, but it fell. TokenBreak-style respelling also got past Jev used as a
  prompt filter. Their line: *"under the hood, these are still language models, simply using a
  different decoding strategy."* That is almost word for word the capstone's masked-read framing.
  I found only coverage, **not HiddenLayer's report itself.**
- **"Decision Hijacking" (Wu & Lim, arXiv 2609.28613, 23 Sept; primary):** 510 InjecAgent cases.
  Injected content **shifts the probabilities but rarely flips the choice**; adaptive attacks
  raise choice-level success only from **1.8% to 3.5%**. Successes cluster where the **initial
  margin was small**. Their conclusion: schema-defined outputs *"change the risk without
  eliminating it"*.

**Why it fits.** Harness §4 already says typed output defeats a tool switch but not value
poisoning, so consequential actions still need authorisation. Both studies agree with that. The
second adds something we can *show*: the attacks that work are the ones that land on a decision
that was already close. That ties injection to calibration. A confidence threshold that escalates
low-margin decisions is a defence against injection as well as against error. Worth a sentence in
the calibration dispatch too.

Sources: [arXiv 2609.28613](https://arxiv.org/abs/2609.28613) (primary) ·
[The Outpost](https://theoutpost.ai/news-story/typesafe-ai-s-jev-decision-model-proves-vulnerable-to-prompt-injection-despite-security-claims-32257/)
· [dev.ua](https://dev.ua/en/news/modeli-pryiniattia-rishen-na-kshtalt-jev-takozh-urazlyvi-do-prompt-iniektsii-1792053800).

---

## 4. The two Jev dispatches are out of date before they are published

**Touches:** dispatch 0 *What has to be true before software can decide anything* (20 Sept) and
dispatch 0.5 *Calibration is the claim* (25 Sept), both still `draft`. **Recommend:** update both
before either goes out, or publish them dated, as of when they were written.

What has moved since they were written:

- **Competitors shipped the same shape.** OpenAI's **Decisions API** (preview at DevDay 29 Sept,
  public beta 6 Oct; `/v1/decisions`, GPT-6 Luna only, typed predicates/choices/scores, $0.10/M
  input) and Cloudflare's **Clef / Clef-flash** (1 Oct; Apache-2.0 weights; Jev-compatible API).
  Clef's construction, per The Register: a **frozen, post-trained Qwen3.8-27B, one prefill pass,
  then the choices are scored in parallel.** That is our masked read, at 27B. It strengthens the
  correction already in `post-jev-sources.md`: the shape is commoditising, so the moat is
  calibration, not architecture.
- **The Decision Index has not caught up.** Cloudflare's scores were self-run on the Index's panel
  and are not on the official board yet. The Space would not render for me, so **re-read the
  leaderboard before quoting any rank**, including the "Jev third on calibration" line.
- **Jev 1.14 (14 Oct):** experimental image input, a bounding-box answer type, and long context
  up to 262K behind an opt-in "danger zone" header. TypeSafe still recommends limiting context.
  Only third-party sources reached me.
- **Funding:** $870M Series A at $7.5B (9 Oct, a16z-led). Secondary only.
- **A data exposure (24 Oct):** TypeSafe disclosed that customers' Jev outputs were exposed;
  CEO Diogo Almeida posted it himself. No postmortem, no customer count. The point worth one line
  in a dispatch: a decision API's log reveals **what every customer was asking it to decide**,
  which is more sensitive than the scores. Otherwise this is an operations story, not a mechanism
  one, and I would not build a post on it.

Sources: [The Register on Clef](https://www.theregister.com/a/5300649) · [Decisions API, public
beta](https://letsdatascience.com/news/openai-opens-decisions-api-public-beta-b69a1e40) ·
[OpenRouter, Jev 1.14](https://openrouter.ai/typesafe/jev-1.14) ·
[Netlify changelog](https://netlify.com/changelog/typesafe-jev-1-14-0-ai-gateway) ·
[leak coverage](https://aitoolsrecap.com/Blog/typesafe-ai-leak-every-customer-jev-output-2026).
TypeSafe's own docs/changelog did not come up; **check docs.typesafe.ai before citing 1.14**.

---

## 5. Interpretability results depend on how the model was trained

**Touches:** post 11 *Opening the box*, post 12 *Injury and recovery*, and post 23 *Play it, then
look inside*. **Recommend:** a sentence in the honest bit of post 11 or 23.

"The Model Organism Lottery" (Szablewski et al., arXiv 2607.01033, v2 29 Oct; primary): 61 small
models trained to show the same behaviour by seven methods, plus 96 distilled variants, probed with
four methods including the logit lens and steering. Interpretability outcomes **vary heavily with
how the model was trained, even with the behaviour held constant**; the more realistic methods
often give *less* interpretable models. Their words: results *"cast substantial doubt on the
validity of current MOs as interpretability proxies."*

We already have a small version of this: the weak and strong tic-tac-toe agents, same architecture,
same size, threat focus 0.199 vs 0.785, and the seed note in CLAUDE.md ("ship the arm you can
point at, never an average"). The paper gives the reader a reason to take our "these are
properties of the shipped weights, not of the recipe" caveat seriously.

---

## 6. Diffusion language models: real products exist, but the sourcing is weak

**Touches:** *It does not have to write in order*. **Recommend:** nothing yet. Verify first.

Coverage says Inception's **Mercury 2.5** (8 Sept) is in production at 1,000+ tokens/s, Google's
**Gemini Diffusion** is still an experimental preview, and the open **LLaDA 2.0** line includes
100B-total MoE checkpoints. Every source I reached was a blog or guide, several contradict each
other, and none was Inception's or Google's own page. The post can say production diffusion text
models exist; the numbers wait for primary pages. None of this changes
`docs/DIFFUSION-decisions.md`'s finding, which is about our demo task, not about diffusion.

---

## 7. Agent incidents for hooks

**Touches:** post 19. **Recommend:** pick one as the hook once verified. All secondary as found.

- **Dark Reading, 26 Oct:** an in-the-wild attack where a markdown file in the downloads folder led
  a coding agent to install malware and steal credentials. The exact injection shape harness §4
  demonstrates, on a real machine.
- **Barracuda, 7 Oct:** phishing emails carrying hidden instructions aimed at the recipient's AI
  inbox assistant.
- **CrowdStrike, 29 Oct:** new injection techniques against agent planning.

[Dark Reading](https://www.darkreading.com/application-security/in-the-wild-attack-ai-agents-trust-markdown)
· [CrowdStrike](https://www.crowdstrike.com/en-us/blog/crowdstrike-uncovers-new-prompt-injection-techniques/)
· [Adversa's October list](https://adversa.ai/blog/top-ai-agent-security-resources-october-2026/)
· [incident timeline](https://github.com/webpro255/awesome-ai-agent-attacks).

---

## Post 4, specifically

Nothing above changes the draft. One optional hook: the decision APIs (OpenAI's, Cloudflare's,
Jev) sell exactly what post 4 shows, **the list of probabilities, without the choosing.** A line
like "three companies launched products last month that hand you the bars instead of the
sentence" would tie post 4 to the news. Only use it if you want the news angle; the puzzle hook
works without it.

## Checked and left out

- **Model launches** (Gemini 4 Argon GA, GPT-6.1 Terra, Mistral Large 4 weights, Kimi K3.1,
  DeepSeek V4.1, Meta's Muse Spark Open): no mechanism the series teaches changes. Trackers also
  disagree on dates and names. Useful only for the ladder's "frontier" rung, where sizes are
  undisclosed anyway.
- **EmbeddingGemma 2** (6 Oct): would have suited post 3, which is already out.
- **The MIT Technology Review "breakthrough technology" listing for interpretability:** only seen
  via blogs.

## Do not cite

- **emergent.sh on GPT-6 Astra**: dated September 2026 and says Astra launched January 2025;
  attributes claims to Raschka that his article does not make.
- **The "99.9% ARC-AGI-3" and "~83% FrontierMath Tier 4 without CoT" figures**: secondary only,
  not in the primary material I read.
- **Startup Fortune's leak article**: the page served to me was a generic Jev explainer with no
  incident content, so I cannot confirm what it says.

## Things to check yourself (403 or not rendered for me)

1. OpenAI's Astra for Law page.
2. The Jev Decision Index leaderboard: current ranks, and whether Clef / Decisions API / Jev 1.14
   are on it.
3. Pachocki's exact "within a factor of two of GPT-4" statement.
4. HiddenLayer's own report.
5. The rest of the GPT-6 Astra system card (characters 100K onward), for the 60.9% vs 16.1%
   CoT-controllability figure.
