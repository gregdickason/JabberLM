# Prompt for Opus — build the "Limits" group in the lab

You are adding a fifth theme to JabberLM's interpretability lab (`lab.html`): **Limits** — three
tabs that make one rule measurable on the site's own tiny models. Read `CLAUDE.md` first (all of it;
the engineering conventions are binding), then `docs/BUILD-DECISIONS.md` for how the last build made
its calls, then this file.

## The rule the tabs exist to show

One forward pass through a transformer does a **fixed amount of work** — O(N²·d) for input length N
and model width d — however hard the question is. Anything that needs more computation than one pass
can hold must be broken into more passes, or handed to something outside the model whose effort grows
with the problem. And a second model asked to *verify* the first has exactly the same fixed budget, so
verification by another model is not independent review; trust has to come from something that
actually runs.

That rule is now stated in prose at the top and bottom of `harness.html` and in the adder's closing
callout. The lab's job is to turn it into three curves.

**Honesty, which is non-negotiable on this site:** the strong form of this claim — Sikka & Sikka's
"Hallucination Stations" theorem that a model *unavoidably* hallucinates on tasks above O(n³) — is
too strong, because chain of thought extends the number of passes and lifts the per-pass bound
(linearly per token; Merrill & Sabharwal). The defensible version, and the only one the copy may
state, is: *work per pass is fixed; more passes buy more compute, one token at a time; the budget is
finite.* The adder already proves it: one pass fails at 4 digits, the loop succeeds at 25. Every
sentence you write must be consistent with that, and the papers row on each tab must carry both sides.

Papers to cite in the `SectionIntro` `papers` row (title + URL only, as the other tabs do):
- Sikka & Sikka, *Hallucination Stations: On Some Basic Limitations of Transformer-Based Language
  Models* (2025).
- Merrill & Sabharwal, *The Expressive Power of Transformers with Chain of Thought* (ICLR 2024) — the
  counterweight.
- Finzi, Qiu, Jiang, Izmailov, Kolter, Wilson, *From Entropy to Epiplexity: Rethinking Information for
  Computationally Bounded Intelligence* (arXiv 2601.03220, 2026).
- For the noise tab, Wolfram's Rule 30 / Rule 110 (a stable reference to *A New Kind of Science* or
  the Wolfram MathWorld pages is fine).

## The three tabs

Slugs are fixed — the harness page and the series registry will link to them. Add them to `TABS` in
`src/lab/tabRoute.ts` (the slug function turns the label into the URL: `'what fits'` → `what-fits`),
to a new group in `GROUPS` in `src/lab/LabApp.tsx` (label **Limits**, blurb *"what a fixed budget can
and cannot reach"*), and to the render switch. Group order: put Limits last. Do not change
`DEFAULT_TAB`.

| label | slug | one-line takeaway |
|---|---|---|
| `what fits` | `what-fits` | one pass fails at a width the loop does not; the gap is the fixed budget |
| `structure vs noise` | `structure-vs-noise` | same bytes, three loss curves: what a bounded learner can extract is a property of the learner, not the data |
| `the verifier's budget` | `verifiers-budget` | asked to *check* a sum, the model fails at the same width it fails to *compute* one; only the tool's check scales |

### Tab 1 — `what fits`

**Reuses the adder and the harness loop. No training. Instant after a model fetch.**

Load `public/adder-model.json` (`deserialize` from `src/engine/persist`, the same way
`src/harness/AdderSection.tsx` does). For each width in `[2, 3, 4, 5, 6, 8, 10, 15, 20, 25]`, generate
a fixed sample of sums (`additionHeldOut(count, digits)` and `longHeldOut` in `src/data/addition.ts`;
use the same seed every run so the chart is reproducible) and measure two accuracies:

- **single pass**: prompt `sumPrompt(a, b)`, greedy decode, compare to `addOracle(a, b)`;
- **the loop**: `runAdder` / `runAdderWith` in `src/harness/runAdder.ts`, which asks one column per
  pass.

One `LineChart` (`src/viz/LineChart`, series `{x: width, y: pct}`) with both series, x = digits,
y = % correct. Under it, a short table of the two numbers per width. Keep the sample small enough that
the whole sweep runs in a few seconds on the main thread; do it in chunks with `requestAnimationFrame`
so the UI stays live and show a progress note, as `AblationSection` does for its sweep.

Copy must land, in this order: (1) the model was trained on whole sums up to 4 digits and *still*
scores ~0% on them in one pass (quote `MEASURED.adderSinglePass` from `src/data/modelStats.ts` for
the shipped figure, and say the number on screen is what this sample measured); (2) the loop is the
same model, same weights, given one fresh pass per column; (3) the gap is not knowledge — nothing was
learned between the two curves — it is *budget*; (4) the honest line about chain of thought: a chain
is the same idea with the model writing its own working, it lifts the bound one token at a time, and
it can run out. Link the adder section: `./harness.html?section=reasoning-loop`.

### Tab 2 — `structure vs noise`

**Trains live. Three tiny models, same architecture, same step count, on three corpora of identical
length. Auto-pauses.**

Build three corpora, each exactly the same number of characters (say 12,000), over the same two-symbol
alphabet so vocabulary size is identical:

1. **Rule 110** — a 1-D cellular automaton, structured, known Turing-complete. Serialise rows of a
   fixed width (e.g. 64 cells) as `0`/`1` characters with a newline per row, from a fixed seed row.
2. **Rule 30** — same serialisation, same width, same seed row. Chaotic: deterministic, but its centre
   column passes randomness tests, and a small learner cannot compress it.
3. **True random** — the same number of `0`/`1` characters from `RNG` (`src/engine/random`) with a
   fixed seed, in the same row layout.

Put the generators in a new pure module `src/data/automata.ts` (`ruleRow(rule, prev)`, `buildAutomatonCorpus(rule, rows, width, seed)`, `buildRandomBits(chars, seed)`), with unit tests in `src/data/__tests__/automata.test.ts` that check: Rule 110 and Rule 30 from the canonical single-cell seed reproduce the first few known rows; all three corpora are the same length and same alphabet; the generator is deterministic for a seed.

Train three `Trainer`s (`new Trainer(text, cfg, seed)` — see how `GrokSection` builds its own
trainer and never touches the `getTrainer` singleton) with the **tiny** preset config, one
`stepBatch` each per rAF tick, for a fixed budget (start at 1,500 steps; tune so it runs in about a
minute on a laptop). Plot **train loss** for all three on one `LineChart`. Also plot, on a second
chart, **held-out loss** on a continuation of each sequence the model did not train on (for the
automata, the next rows; for random, fresh random bits) — that is the honest curve, since a model can
memorise the training bits of anything.

Gate on the held-out curves with `ConvergenceGate` in `plateau` mode (`src/lab/converged.ts` — read
its doc comment; the Recovery tab is the example of plateau mode) and stop when all three plateau,
plus a hard step cap. Every training section on the site auto-pauses; this one must too.

Then, and this is the demo's whole point, add the fourth run as a checkbox: **Jabberwocky forward vs
reversed** (`JABBERWOCKY` from `src/data/jabberwocky.ts`, and the same string reversed). Same length,
same alphabet, same information in the classical sense. Plot both held-out losses on a third chart.

Copy must land: (1) the three corpora contain exactly the same number of bits and two of them are
fully deterministic, so on the classical account they carry no more or less information than each
other; (2) what the loss curves show is what *this learner, with this budget* can extract — the
paper's word for that is epiplexity, and the residual it cannot extract is time-bounded entropy;
(3) Rule 30 is the important one: it is not random, a bigger or longer-trained model might get it,
and to this model it is indistinguishable from noise — which is the epiplexity paper's point that
"looks like noise" is a fact about the observer; (4) forward vs reversed: same bytes, different
curve, so information is not independent of ordering for a bounded learner; (5) the practical line:
this is why running a simulation or a tool and feeding its output to a model creates information the
model could not have produced by thinking harder. Do **not** claim the model "understands" Rule 110;
say it compresses it.

Keep the two-symbol alphabet strict: if you add a newline, it is a third symbol and the three corpora
still match, which is fine — but say so in a code comment, and keep it identical across all three.

### Tab 3 — `the verifier's budget`

**Reuses the adder model. No training. Instant after fetch.**

Two experiments on the same widths as tab 1.

**A. Ask the model to check, not compute.** Build prompts of the form the model can read — the
cleanest is to reuse its own trained format: give it `sum a b => c` where `c` is either the true sum or
a corrupted one (flip one digit), and score whether the model's continuation agrees or disagrees. If
the adder's corpus format cannot support a yes/no reading cleanly, the honest alternative is:
have the model *re-derive* the sum in one pass and compare its answer to the claimed `c`; that is what
"checking by re-computing" costs a bounded model, and its accuracy will track tab 1's single-pass
curve. Say which you did in the copy; do not dress it up.

**B. The tool checks.** `addOracle(a, b) === c`, which is exact at every width.

One chart, three series against width: model generating (from tab 1, for reference), model
verifying, tool verifying. The first two collapse together; the third is flat at 100%.

Copy must land: (1) verifying is not cheaper than computing for this model, because it has the same
budget for both; (2) so a second model reviewing the first inherits the blind spot — a review by
another model is not independent review; (3) the tool's check is exact because its effort scales with
the input; (4) link the tic-tac-toe check layer (`./capstone.html?section=play`) and the harness
robustness section (`./harness.html?section=robust`) as the two places the site already puts
verification outside the model. Make the point that this is *why*, not just *that*.

### Shared

- Each tab is a self-contained section component in `src/lab/`, using `SectionIntro` (title, one
  paragraph, `papers`), the shared `CAVEAT` where the toy-scale caveat applies, and the lab's existing
  button/status idioms (`▶`, `⏸ Pause`, `↺ Reset`, "✓ converged — auto-paused (Reset to run again)",
  "reached step cap — paused"). Read `GrokSection.tsx` and `RecoverySection.tsx` before writing a line.
- Link every term's first use to the glossary (`./glossary.html#<id>`); add glossary entries in
  `src/data/glossary.ts` for **epiplexity**, **time-bounded entropy**, **fixed compute budget** (put
  the last under "Agents and tools" with a `see` pointing at `what-fits`). Match the register of the
  existing entries.
- Numbers in copy come from `src/data/modelStats.ts` or from the live measurement on screen. Never
  type a percentage into prose.
- Update the harness page's closing paragraph: it currently links to `./lab.html` with the words
  "the lab is where the rule becomes measurable"; point it at `./lab.html?tab=what-fits` and name the
  Limits group. Update `docs/blog/OPUS-PROMPT.md`'s post table so post 20 ("Reasoning in a loop") adds
  `lab.html?tab=what-fits` and `?tab=verifiers-budget` as Try-it links, and post 24 ("Emergence") adds
  `?tab=structure-vs-noise`. Add the same to `src/data/series.ts`.
- Add the two instant tabs (`what-fits`, `verifiers-budget`) to the embed registry
  (`src/embed/demos.ts`) with an `embed` flag on the component that drops the `SectionIntro` and
  prose, the pattern `AblationSection({ embed })` uses; write their lessons in
  `src/teachers/lessons.tsx` (the `Record<DemoId, Lesson>` type will fail the build until you do).
  Measure the frames in a browser if one is available; if not, size from content and say so in the
  lesson notes. Do not embed the training tab — a frame that needs a minute of training is workshop
  material, not a blog embed.
- Add the group and tabs to GUIDE.md §9 and to the teachers page's lab row, in the existing voice.

## Definition of done

- `npm test` green, including the new automata tests and a test that the three corpora are equal in
  length and alphabet.
- `npm run build` green.
- `lab.html?tab=what-fits`, `?tab=structure-vs-noise`, `?tab=verifiers-budget` all render, and the
  legacy `#slug` form resolves too.
- Both training-free tabs show their chart within a few seconds of the model fetch, with a progress
  note while sweeping.
- The training tab auto-pauses on plateau and on its cap, and `↺ Reset` re-runs it.
- Every claim in the copy is either the defensible version of the theorem or a live number.
- A short entry in `docs/BUILD-DECISIONS.md` for each judgement call (widths chosen, step budget,
  which verification form tab 3 used and why, frame sizes if unmeasured).
- Work on a branch, fast-forward merge to `main`, do not push.
