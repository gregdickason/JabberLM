# Build decisions log — site work for the book/blog companion (10 Sept 2026)

Ambiguous calls made while building, so they can be reversed knowingly. Each says what the
choice was, what else was on the table, and why this side won.

---

**1. Scroll-spy uses `replaceState`, not `pushState`.**
The roadmap asked for `?section=` + `pushState` on the scroll-spy so every section counts as a
pageview. Implemented as `replaceState` while scrolling and `pushState` only on a deliberate
contents click. A history entry per section scrolled past would make the back button walk up
the page one section at a time, which is a worse thing to do to a reader than the extra
analytics row is worth. Deep-link arrivals are unaffected: the beacon reads `?section=` off
the load URL, so a blog post's "Try it →" is still counted. See `src/lib/useSectionRoute.ts`.

**2. Section ids are short and hand-set; old slug anchors keep working.**
Every section now carries a short id (`#cost`, `#loop`, `#play`). The long auto-slugged anchors
(`#loop-it-and-its-an-agent`) are kept working by an alias *map* resolved in the routing hook
(`src/lib/legacyAnchors.ts`, each page declaring `{ 'old-slug': 'new-id' }`), not by emitting
duplicate anchors into the DOM. The first attempt did emit hidden anchor spans and was wrong:
an anchor has to sit at the section it names, so a component rendering them in one place would
have scrolled every legacy link to the same spot.

**3. `?section=` beats `#hash` when both are present.** Arbitrary, but it has to be one of
them; the query form is the canonical one we publish, so it wins.

**4. Prefill silently falls back rather than erroring.**
A bad `?prompt=`/`?list=` shows the demo's own default instead of an error state. A reader who
follows a mistyped link from a post should land on a working demo, not a diagnostic. Values
are trimmed, length-capped and control-stripped (`src/lib/urlParams.ts`).

**5. The stats script regenerates structure only, not measured numbers.**
`npm run stats` re-derives params/dims/vocab from the JSON bundles. Accuracy figures stay
hand-maintained with a `measuredBy` script name, because only a person can say what a number
was measured on. The alternative — running every eval in the stats script — would make it a
multi-minute job nobody runs.

**6. `scripts/gen-stats.mjs` is plain node, not vite-node.**
Every `gen:*` script shells out to `npx --yes vite-node`, which cannot resolve in this
environment (pre-existing; `vite-node` is not in `node_modules/.bin`). The stats script only
reads JSON, so it follows `build-guide.mjs` and runs on plain node. The model-training scripts
were left alone.

**7. The chat/instruction-tuning gap is filled with two models we already ship.**
Explain gains "Why it answers instead of continuing" between hallucination and tokens. The plan
was to fake it by framing one model's prompt as `Q: … A:`; what shipped is better and real. The
three-skill model (90,336 params, trained on plain text) and the tool-calling model (88,464
params, same architecture, trained on instruction→response pairs) get the same instruction side
by side. Verified before writing the copy: sent `total of 6 9 2`, the plain-text model continues
with ` => 2 6 9` — a sorted list, confidently answering a question nobody asked — and the tuned
one emits ` => sum(6 9 2) = 16`. That contrast is the pretraining/SFT distinction with no
hand-waving. The honest caveat, which the lesson states, is that these are two separately
trained models rather than one model before and after tuning.

**8. The glossary is one page with per-term anchors, not tooltips everywhere.**
Cheaper to maintain and linkable from the book. First uses on the teaching pages link into it.
A tooltip layer over every term would need a term-detection pass over all copy and would drift.

**9. Reading-time labels raised to measured values.**
Explain 10 → 20 min, learn 15, capstone 10 → 20, harness 10 → 12. The audit measured explain at
3,000+ words plus fourteen widgets. Under-promising the time made the page feel like a failure
to finish; the honest number lets a reader plan.

**10. The adder's "200 facts" claim was corrected, not deleted.**
The page said the model was taught "exactly one thing: the addition table. 200 facts." The
corpus also holds 6,000 whole sums and 6,000 traces up to 4 digits. The corrected copy keeps
the punch and gains a stronger point: it was trained on whole sums and still cannot do them in
one pass, which is precisely why the loop matters.

**11. New embeds reuse page components; no component was forked.**
Per CLAUDE.md's rule, the prose stays on the page and the demo is the shared part. Six of the
seven needed no change at all — they were already standalone components the page merely wrapped.
The seventh, the flaky-harness demo, was assembled inline inside `HarnessApp`, so it moved to
`src/harness/demos.tsx` as `FlakyDemo` and the page now renders it under its own prose, the same
split the other harness demos already had. No frame was measured in a browser (the extension was
not connected), so all seven sizes need the visual check in step 5 of the test walkthrough.

**12. The series page lists posts from a single registry.**
`src/data/series.ts` holds the post list; `series.html` renders it and the teachers page links
it. One registry so a post's title, status and Try-it link cannot disagree between surfaces.
Posts not yet written are listed as planned, so the page is honest on day one.

---

## Still open after this build

Listed here so the next session does not have to re-derive them from the evaluation.

- **Embed frame sizes are unverified in a browser.** The Chrome extension was not connected, so
  the seven new frames in `src/embed/demos.ts` were sized from their components' content rather
  than measured. Step 5 of `docs/TEST-WALKTHROUGH.md` is the check.
- **No `og:image` per demo or per tab.** Every shared link still previews with the one site-wide
  card, so each post's "Try it →" looks identical in a social preview. Needs a screenshot script.
- **The playground sidebar still has no tooltips.** Every knob (d_model, heads, d_ff, weight
  tying, grad clip, top-k, top-p) is a bare label; the explanations exist only in GUIDE §4.
- **No embed for grokking or the Step Through.** Both are in the series plan (posts 6, 7, 8) and
  both are awkward: grokking needs minutes of live training, and the Step Through is a modal.
  Posts 6-8 currently link to the page rather than carrying a frame.
- **Logit lens, attention-on-a-poem, and a capstone "edit the rule" exercise** were Tier 4 in the
  evaluation and are untouched.
- **The series schedule is unresolved.** Post 1 promised "twice a week to the end of September" on
  27 July. Twenty-six posts at two a week runs to late November. `src/data/series.ts` lists the
  posts without dates; the cadence line needs deciding before post 2 goes out.
- **`npx vite-node` cannot resolve in this environment**, so no `gen:*` model script was run and
  no model was retrained. `npm run stats` confirms the committed numbers match the shipped model
  files, which is the part that mattered here.
