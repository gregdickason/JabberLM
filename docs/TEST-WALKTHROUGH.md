# Test walkthrough — the book/blog companion build

Run `npm run dev` and work down this list. Each step says what to do and **what you should see**.
Anything that does not match is a bug, not a preference — note the step number.

Two automated gates first. Both should pass before you look at anything:

```bash
npm test          # vitest: gradient checks, model/trainer/persist, url params, embed registry
npm run build     # tsc -b && vite build — must build 10 pages
npm run stats     # re-derives model numbers from the JSON bundles; should report "no change"
```

`npm run stats` printing "no change" is the point: it means every parameter count in the code
matches the actual model files.

---

## 1. The new pages exist and are reachable

1. Open `http://localhost:5173/`. In the top nav you should now see **Glossary** and **Series**
   after "For teachers". Neither should ever appear as a "Next →" suggestion.
2. Click **Glossary**. You should get a page of terms grouped into seven sections, with a filter
   box at the top.
   - Type `agent` into the filter. The list should narrow to a handful of entries and show a
     match count.
   - Clear it. Click a group name in the contents strip — it should jump to that group.
   - Hover any term and click the little `#` on the right. The URL should become
     `.../glossary.html#<term>`; reload the page and it should land on that term.
   - Every entry that has a `→ …` link should go somewhere real. Spot-check three.
3. Click **Series**. You should see 26 posts in five parts, post 1 marked published and the rest
   marked `planned`, each with a one-line idea and most with a `→ try it` link.
   - Click three `→ try it` links from different parts. Each must land on the right section or
     tab, not just the top of a page.

## 2. Deep links — the thing the blog posts depend on

Paste each URL directly into the address bar (not via an in-page click) and confirm it lands on
the right place, scrolled, with the demo present.

| URL | should land on |
|---|---|
| `/explain.html?section=hallucination` | "Why it sometimes makes things up" |
| `/explain.html?section=instruction` | the new "Why it answers instead of continuing" |
| `/explain.html?section=inference` | "Inference economics" |
| `/harness.html?section=loop` | "Loop it — and it's an agent" |
| `/harness.html?section=injection` | "The catch — prompt injection" |
| `/harness.html?section=reasoning-loop` | the adder section |
| `/capstone.html?section=play` | the tic-tac-toe game |
| `/capstone.html?section=warehouse` | the warehouse agent |
| `/capstone.html?section=recap` | "The whole book, in one page" |
| `/lab.html?tab=head-ablation` | the head-ablation tab (this already worked) |

**Old links must still work.** These are published in the guide and elsewhere:

- `/harness.html#loop-it-and-its-an-agent` → should land on the agent-loop section.
- `/harness.html#the-catch-prompt-injection` → should land on prompt injection.

**The scroll-spy.** On the explain page, scroll slowly from top to bottom. The URL should update
to `?section=…` as you pass each section. Now press the browser **back** button once: it should
take you to the *previous page you visited*, not walk you up the page one section at a time.
That is deliberate — scrolling replaces history, only clicking a contents link pushes it.

Click an entry in the explain page's "On this page" contents box. That one *should* add a history
entry, so back returns you to where you were.

## 3. Prefill — a link that opens on a specific example

Each of these should arrive with the example already in the box, not the default.

| URL | should show |
|---|---|
| `/explain.html?section=prediction&prompt=sort%206%209%202%20%3D%3E%20` | the prediction demo primed with `sort 6 9 2 => ` |
| `/explain.html?section=hallucination&prompt=7x%20%2B%202%20%3D%2016%20%3D%3E%20` | the hallucination demo on the algebra example |
| `/explain.html?section=embeddings&word=queen` | the word map centred on `queen` |
| `/harness.html?section=tools&ex=biggest%20of%204%201%207` | the tool demo primed with that instruction |
| `/harness.html?section=reasoning-loop&a=999&b=1` | the adder with 999 and 1 |
| `/capstone.html?section=warehouse&basket=ADE` | the warehouse with basket A D E |
| `/?dataset=sort&prompt=sort%204%201%207%20%3D%3E%20` | playground on the sorting dataset, prompt primed |

**Bad input must fall back, not break.** Try `/explain.html?section=embeddings&word=` and
`/capstone.html?section=warehouse&basket=ZZZZZZ`. Both should show the demo's normal default with
no error.

## 4. The new explain section (the chat gap)

Open `/explain.html?section=instruction`.

1. Read the section. It should explain pretraining → instruction tuning → RLHF, and say plainly
   that RLHF shapes behaviour rather than truth.
2. Press **total of 6 9 2** then **Send to both**.
   - The left card (plain text model) should carry on writing, and will likely produce something
     like ` => 2 6 9` — a *sorted list*, which is the wrong answer to "total".
   - The right card (instruction-tuned) should produce something like ` => sum(6 9 2) = 16`.
   - Neither should run past the end of its line into other training text.
3. Try the other two chips, and type your own. The contrast should hold.

This is the point of the section: same size, same architecture, different training data.

## 5. The seven new embeds

Open each and confirm it renders with no nav, no page prose, and stays inside a fixed box that
does not jump as you use it. Then resize the browser narrow and confirm the box scrolls rather
than the page reflowing.

- `/embed.html?demo=next-token`
- `/embed.html?demo=attention`
- `/embed.html?demo=hallucination`
- `/embed.html?demo=instruction`
- `/embed.html?demo=rag`
- `/embed.html?demo=quantisation`
- `/embed.html?demo=flaky-harness` — should show a caught error **on load**, without a click.

**Frame sizes are the thing most likely to be wrong here.** They were set from the components'
content, not measured in a browser. For each: if there is a large band of empty space at the
bottom, or a scrollbar appears immediately on a normal-width window, the `frame` in
`src/embed/demos.ts` needs adjusting. Note which ones and I will fix them.

Also check `?scale=` still works: `/embed.html?demo=next-token&scale=2` should make everything
bigger, not just the text.

Prefill works on embeds too: `/embed.html?demo=hallucination&prompt=the%20invoice%20shows%20`.

## 6. The corrections

Confirm each of these now reads correctly.

1. `/explain.html?section=hallucination` — the caption above the demo must **not** say the model
   "only ever saw one poem". It should mention nonsense verse, algebra and sorted lists.
2. `/explain.html?section=inference` — the intro should say **three** levers and then list three.
   The quantisation box at the bottom should agree (it used to call itself "the fourth lever").
3. `/explain.html?section=inference` — the specialist-vs-generalist box should quote **89%** for
   the generalist, not "~95%", and must not refer to a "training-cost story" that does not exist.
4. `/harness.html?section=reasoning-loop` — the intro must say the adder was **also** trained on
   6,000 whole sums and 6,000 traces, and make the point that it was trained on 4-digit sums and
   still cannot do them in one pass. The old copy claimed 200 facts were "the whole of its
   arithmetic", which was false.
5. Same section, the closing callout — should name **chain of thought** and give the compounding
   figure (99% per column over 15 digits is 86%).
6. `/lab.html?tab=neurons` — the caveat under the intro should say **~90K**-parameter, not ~200k.
7. `/learn.html` — the fine-tuning paragraph should link to the **lab**, not claim you can do LoRA
   in the playground.
8. Playground: hard-reload `/`, dismiss the welcome box, and watch the status line under the
   training buttons. It should say "built-in three-skill model loaded ✓", not "pretrained
   Shakespeare loaded ✓".
9. `/capstone.html` — the browser tab title should be about playing an agent, not "a warehouse
   agent" (the page opens with tic-tac-toe).

## 7. The capstone bridges

1. `/capstone.html?section=play`. **Before** the board there should be an amber box headed
   "Before you play — what this model was and was not told". Read it: it should say the model
   predicts characters, was never told the rules, and was never told which cells are empty.
2. Play a game against the **undertrained** agent with the harness check **on**. You should see the
   retry chain fire on most turns (`cell 8 ✗ taken → re-ask…`).
3. Untick the check and keep playing. The game should break within a move or two.
4. Switch to the **well-trained** agent. Read the blurb below the board — it should now include the
   honest note that 9 losing lines remain as O, and that being right about 98% of positions is a
   different claim from being safe in all of them.
5. Scroll to the recap. Every bullet should name where you met that idea and link to it. Click two.

## 8. Learn and lab (subagent work — check these carefully)

1. `/learn.html` — the attention section should now explain the dot product, the √d division, the
   causal mask and the row-wise softmax in prose, not only in chart titles. There should be a
   section on what multiple heads are for, and a dimensions table comparing this model with GPT-2
   and GPT-3 in section 8.
2. `/learn.html?section=attention` and `?section=training` should deep-link correctly, and the old
   long anchors (e.g. `#letting-tokens-look-at-each-other-attention`) should still land.
3. `/lab.html` — the four group labels (Observe / Intervene / Adapt / Scale & serve) should show
   their one-line description as visible text, not only on hover. A short framing paragraph should
   stay visible above the tabs even after a model has loaded, and should point a newcomer at the
   head-ablation tab.
4. Spot-check three lab tabs for glossary links on jargon (superposition, ablation, held-out).

## 9. Teachers page

`/teachers.html` — should now mention the glossary and the series page, and document the
`?section=` and prefill parameters so a session leader can prepare links in advance. The embed
table should list all **seventeen** demos.

## 10. Last pass

- Click every item in the top nav on two different pages. No 404s.
- `/glossary.html` and `/series.html` should appear in `public/sitemap.xml`.
- View source on `/glossary.html` and `/series.html`: each needs its own `<title>`, description
  and canonical URL, not a copy of the explain page's.

---

### What I could not verify myself

- **Nothing was checked in a real browser.** The Chrome extension was not connected in this
  session, so every visual claim above is inferred from the code. The embed frame sizes (step 5)
  are the most likely thing to need a nudge.
- **No model was retrained.** `npm run stats` confirms the numbers in the code match the shipped
  model files, but the `gen:*` scripts cannot run in this environment — `npx vite-node` fails to
  resolve, which is pre-existing and unrelated to this work.
- The live-training demos (lab grokking, RLVR, capstone SFT→RL) were not run to completion.

---

# Limits group (added 14 Sept 2026)

Three new lab tabs. Two measure and need no training; one trains for about a minute.

## L1. Routing

- `/lab.html?tab=what-fits`, `?tab=structure-vs-noise`, `?tab=verifiers-budget` each open the
  right tab. The legacy `#verifiers-budget` form should work too.
- The tab strip should show a fifth group, **Limits**, last, with the visible blurb "what a fixed
  budget can and cannot reach".
- Every one of the thirteen older tabs must still open — the slug function changed (it now drops
  apostrophes) and a test asserts nothing moved, but click a few anyway.

## L2. What fits

Open `/lab.html?tab=what-fits`. It sweeps automatically on load, one width per frame, taking
roughly ten seconds; rows should appear progressively rather than all at the end.

Expected shape, from the measured run:

| digits | one pass | writing the working | the loop |
|---|---|---|---|
| 1 | ~33% | ~50% | 100% |
| 2 | 0% | ~33% | 100% |
| 3–4 | 0% | 0% | 100% |
| 6 and up | 0% | *no room* | 100% |

The three things to check, because they are the argument:

1. **Amber beats red at one and two digits.** If it does not, the chain-of-thought point is lost
   and the copy is wrong.
2. **Amber hits zero at three digits**, where the working still fits (56 characters in a 96
   window). The copy says it fails before running out of room; confirm the table agrees.
3. **From six digits the trace column reads "no room"** and the char count turns red, because a
   full trace needs more than 96 characters. That is a structural ceiling, not a failure.

## L3. Structure vs noise

Open `/lab.html?tab=structure-vs-noise` and press **Train all three**. Give it a minute.

- Three held-out curves must separate in this order, low to high: **rule 110**, then **rule 30**,
  then **random bits**. At around 600 steps the measured values were 0.576 / 0.772 / 0.871.
- If all three sit on top of each other near 0.77, something has changed the row width or the
  context window and the demo is broken. That is the one failure mode to watch for.
- It should auto-pause, either "✓ settled" or "reached step cap". **↺ Reset** must re-run it.
- Tick **also run the same poems forwards and backwards**. It rebuilds and re-runs. Forward must
  end up *below* reversed (measured 1.789 vs 2.090 at 900 steps). If reversed wins, tell me — that
  is what happens when the corpus is too short and gets memorised.

## L4. The verifier's budget

Open `/lab.html?tab=verifiers-budget`. Sweeps on load, about seven seconds.

- Left chart: the grey "caught the wrong answer" line should be **flat at 100%** across every
  width, while the green "accepted the right answer" line collapses. That contrast is the whole
  tab — if grey is not flat at 100, the lesson does not land.
- Right chart: "checking in JavaScript" flat at 100, "checking with the loop" at or near 100,
  "one pass" near zero throughout, and "writing the working" present only for widths 1–4.

## L5. Embeds

- `/embed.html?demo=what-fits` and `/embed.html?demo=verifiers-budget` should each render the
  chart with no heading or prose, and finish their sweep unaided.
- **Both frame sizes are guesses** — no browser was available while building. Check for a large
  empty band at the bottom or an immediate scrollbar, and tell me which needs adjusting.
- `teachers.html?lesson=what-fits` and `?lesson=verifiers-budget` should each show a full lesson.

## L6. Copy and cross-links

- `/harness.html?section=where-this-leaves-you` should now link to the **Limits group**, not the
  bare lab.
- `/glossary.html` should have a **Limits** group with three entries: fixed compute budget,
  epiplexity, time-bounded entropy. Each links into the right tab.
- `/series.html` should list **27** posts, with a new post 21, "What fits in one pass".

---

# The prediction demo's two decoding rules (16 Sept 2026)

Open `/explain.html?section=prediction`.

1. Press **Keep taking the top bar**. It should write, then fall into a repeating groove, and an
   amber note should appear naming the block it is repeating — from the default prompt that is
   `"the stood "`. The note must say this is not the model being small or undertrained.
2. Press **Choose in proportion instead**. The same weights should now write plausible
   Jabberwocky-style verse. Press it twice more: each press should give something different.
3. Edit the text box by hand. The note should disappear, since it no longer describes what is on
   screen.
4. Check `/explain.html?section=randomness` directly below reads as a continuation of that, not a
   restatement of it.
5. `/embed.html?demo=next-token` gets the same two buttons — worth one look, since the frame was
   sized before the third button existed.

The point to protect: a reader must never leave §1 thinking the bundled model is broken. If the
amber note does not appear when the groove does, that is a bug worth reporting.

---

# Calibration tab and the Jev dispatch (20 Sept 2026)

## C1. The tab

`/lab.html?tab=calibration`. It opens on the **undertrained** agent and sweeps ~900 boards in a few
seconds, with a "measuring…" note.

Expected, and the whole point of the tab:

- **Undertrained:** the range tile reads roughly `17.4% – 17.4%` and says *it barely moves at all*.
  The histogram is a **single bar**. The "said when right / wrong" tile shows the same number twice
  and says *no difference — it cannot tell you*. If the histogram shows a spread here, something is
  wrong.
- Switch to **well-trained**. It re-sweeps. The histogram now spreads across most of the range, the
  reliability curve sits **well above** the grey diagonal, and the said-right/said-wrong tile shows
  roughly `71% / 48%`.

The reliability chart's grey line is the "if the number meant what it says" reference. The green
line being above it means under-confident, which is the counter-intuitive finding and should be
stated in the copy below the chart.

## C2. Cross-links and copy

- `/capstone.html?section=play` — below the board there should now be a paragraph naming the typed
  decision, and saying the schema made a malformed move impossible while the agent still picks an
  occupied cell in most positions. It links to the calibration tab.
- The capstone recap's "All of it is next-token prediction" line should now carry the asterisk about
  a transformer not having to be used that way.
- `/glossary.html` — the Limits group should now have **calibration**, **typed decision**,
  **autoregressive** and **System 1 and System 2**.
- `/explain.html?section=inference` — a new paragraph on the Jevons argument at the end, before the
  callout.
- `/series.html` — a dispatch row at the top of Part 1 with a dot instead of a number and an amber
  "dispatch · 20 September 2026" tag.

## C3. The dispatch

`docs/blog/post-jev-linkedin.txt` is copy-paste ready: 513 words, 2,847 characters, no Markdown,
link held for the first comment (text in `post-jev-notes.md`).

The three numbers that must be right, because the post is a public challenge to someone else's
claim and they will be checked: **60%** of positions get an occupied cell, confidence ranges
**17.4158% to 17.4225%**, and the strong model says **71.5% / 48.1%**. All three are in
`post-jev-notes.md` with their measurement, and all three are reproduced by the tab.

---

# Embedded intelligence (21 Sept 2026)

## E1. The capstone's third section

`/capstone.html?section=embedded`, between the harness-halves section and the recap.

1. Read the two paragraphs before the demo. They should make the assistance-versus-automation
   argument: every model most people have used was trained on human preferences, so a person is in
   the loop by construction, and the lesson businesses drew was not to let it decide anything
   costly.
2. The demo lists thirteen messages: eight held-out complaints, one per route, then five ambiguous
   ones. **None of these were trained on.**
3. The first eight should route sensibly and confidently.
4. The last five should come back with noticeably **lower** confidence, and at the default 70%
   threshold most should be marked `→ a person`. That is the demo working, not failing — each one
   genuinely belongs to two routes, and the second-choice route is printed beside it.
5. Drag the threshold to 99%: nearly everything escalates, and the count of automatically-routed
   messages collapses. Drag to 30%: the ambiguous ones get routed on what is close to a coin-flip,
   and any wrong auto-routes appear in red.
6. Type your own complaint in lower case, e.g. `the salmon was mouldy`. It should classify and show
   a confidence. Type nonsense: it still answers, with a confidence, which is worth seeing once.

## E2. The claim to check hardest

The section ends by saying the whole design depends on the confidence varying with the input, and
links to the calibration tab where this site's own undertrained agent does not. Follow that link and
confirm it still lands on `?tab=calibration`.

## E3. The embeds

- `/embed.html?demo=classifier` — the demo alone, no prose.
- `/embed.html?demo=calibration` — should now be **only** the agent selector, the worked position
  and the tiles. The histogram and reliability chart should NOT be in the frame; they stay on the
  lab page. If you see charts, the split did not take.
- `teachers.html?lesson=classifier` should show a full lesson.

## E4. If the model looks wrong

The classifier is regenerated with `npm run gen:classifier`, which now works (it previously failed
on `npx vite-node`). It takes around thirty minutes. The generator prints held-out accuracy and the
exact rows the demo shows, so compare those against what the page renders — they should match,
since the page runs the same model with the same read.
