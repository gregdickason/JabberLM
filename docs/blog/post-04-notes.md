# Post 4 notes — "The reflex"

## Revision, 11 Nov 2026

- **Algebra section cut.** The dispatch *Your ("Weight Spaced") model looks right, but is wrong*
  (published 7 Nov) used the same `7x + 2 = 16` example. Post 4 now keeps the must-say line ("a
  fluent answer is a prediction, not a fact") in "Why this matters at work" and links to the
  dispatch for the evidence (94% looks right / 8.4% is right, `MEASURED.multitaskAlgebra`). The
  algebra rows in the number table below are no longer in the post; they are kept for the record.
- **New section, "This week's headline was a loop".** It corrects a claim the draft implied: that
  choosing in proportion is THE fix for loops. It is a mitigation. Source is the paper's own
  Exp. 8 (https://rikiyat.github.io/blog/weight-space-programming/): Qwen3.5-0.8B with thinking
  on, **sampled** at temperature 0.6, top-p 0.95, top-k 20, presence penalty 1.5. **93.0%** of
  baseline MATH-500 answers hit the 32,768-token limit; after the edit (50 forward passes),
  **33.1%**; MATH-500 **7.9% → 48.1%**; "it repeats the same text and rarely reaches an answer".
  "Critics have pointed out" refers to Míriam González
  (https://x.com/miriamgonp/status/2117686029507309778, I could not open the thread itself) and the
  Latent Space recap. The interpretation is attributed to them, not stated as fact.
- **GPT-2 sentence softened** from "it is why the chatbots you use choose in proportion" to "it is
  one reason", since the new section shows sampling is not a complete cure.
- **LinkedIn cut redone**, 2,953 characters (limit 3,000). It drops the "It looks nothing up" line
  and the poem's long-tail aside to fit.
- **[CHECK] "This week's"** in the section heading assumes publication within about two weeks of
  the paper (2 Nov). If it goes out later, change it to "A recent headline was a loop".


## Read this first

**No dictation again**, so as with post 3 every word is mine. It follows the shape you kept for
post 3 (hook, the idea, a predict-first question, why it matters at work, the answers last) and
delivers what post 3's closing line promised: "what happens when a model has to choose what comes
next, and why always choosing the most likely thing is the wrong answer."

Two files, as for post 3:

- `post-04-the-reflex.md` — the book copy. About 620 words of prose, longer than post 3's ~500.
  The algebra section is the addition; cut it if you want post 3's length back, but it carries
  the post's one must-say line (DICTATION-GUIDE: "a fluent, confident answer is a prediction,
  not a fact").
- `post-04-linkedin.txt` — plain text, no markup, 2,851 characters (limit 3,000). The opening
  line is above the mobile fold. "Linked in the comments", same as post 3.

## First comment

> The live demo: https://jabberlm.com/explain?section=prediction
>
> One button takes the top pick every time, the other chooses in proportion. Press each and watch
> the same weights write two very different poems. It embeds as a single iframe — snippet at
> https://jabberlm.com/teachers

## Every number, and where it came from

All measured on 1 Nov 2026 against the shipped `public/multitask-model.json`, with the same
calls the demo makes (`model.forward` for the bars, `generate` with the demo's settings). Script:
`measure-reflex.ts` in the session scratchpad — re-run before republishing if the bundle is
retrained.

| claim | measured | source of the setting |
|---|---|---|
| 77 possible characters | `tok.itos.length` = 77 | `BUNDLES.multitask.vocab` |
| `'Twas brillig, and the ` → s 17%, c 10%, w 10%, t 8% | s 17.1, c 10.0, w 9.8, t 8.4, f 7.2, b 7.0 | demo's default prompt |
| `sort 6 9 2 => ` → 98.8% on 2 | 2: 98.8, 1: 1.0, 9: 0.2 | |
| greedy algebra writes `7x = 18 => x = 3` | `"7x = 18 => x = 3\n…"` | temperature 0 |
| five sampled runs give 5, 8, 1, 1, 3 | temp 0.8, `RNG(7)`, five consecutive draws | the demo's sampling temperature |
| greedy poem: `stone song, And stood the cross the stood the stood…` | 90 chars, `repeatingTail` = "the stood" | `NextTokenDemo` "Keep taking the top bar" |
| sampled poem: `The quoggs shies conftercante deep, …` | temp 0.8, `RNG(2024)`, **second** draw | the demo's own seed |
| ~90K parameters | 90,336 | `BUNDLES.multitask.params` |
| GPT-2 "over a thousand times larger" | GPT-2 Large, 774M ≈ 8,600× | Holtzman et al., *The Curious Case of Neural Text Degeneration*, ICLR 2020 (arXiv 1904.09751) — greedy and beam search on GPT-2 Large produce repetition loops |

**On the sampled poem:** a reader's *first* press of "Choose in proportion instead" on the page
gives a different line (`treeer, It the holce—the find and gentled began…`); the quoggs line is
the second press. The post never claims it is the first, but if you would rather quote exactly
what a reader sees first, swap it.

**"Choose in proportion"** is the demo's own wording; strictly it samples at temperature 0.8, which
is slightly sharper than proportional. I kept the demo's phrase so the post and the button agree.

## Questions for you

1. **Is there a hook?** It opens on the "ask twice, get two answers" puzzle. A real instance from
   work — two people getting different answers to the same policy question — would beat it.
2. **The algebra section** is the one place this goes beyond the demo the post links to (the
   page's §1 is poem-only; you can reproduce it by typing `7x + 2 = 16 => ` into the box and
   pressing "Keep taking the top bar"). Keep, or cut to post 9 ("Why it makes things up")?
3. **Ladder footer.** Post 3 dropped it, post 1 had it. I included one. Keep or drop for the
   series?

## Series bookkeeping

`src/data/series.ts`: post 2 is now `published` under its real title, *What is a token anyway?*,
with its LinkedIn URL; post 3 `published` with its URL; post 4 `draft`. The OPUS-PROMPT post table
matches. Post 1 still has no `url` — send it if you want the series page to link it.
