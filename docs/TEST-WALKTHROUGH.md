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
