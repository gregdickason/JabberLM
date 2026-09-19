# Post 3 notes — "Words as coordinates — how meaning becomes maths"

## Read this first

**There was no dictation for this one.** You asked for the post directly, so every word of it is
mine, written from the site's own §7 copy and from the measured output of the demo. That is the
opposite of the intended workflow, where your voice carries the piece and I assemble it. Treat the
draft as a structural first pass: the facts are checked and the shape is right, but none of the
phrasing is yours.

The paragraphs most worth re-dictating, in order:

1. **The opening two paragraphs.** The hook is a generic one ("a computer has no idea what *ocean*
   means"). Post 1 opened on a news story; this has no equivalent, because I had none from you.
2. **"Why this matters at work".** The semantic-search example and the bias paragraph are the two
   places a reader decides whether you know what you are talking about. Your own examples from
   client work would be worth far more than mine.
3. **The closing bridge.** I tied it to JabberLM's digit number line, which is a real and good
   connection, but you may want the ladder framing done differently since this post steps off it.

## Length

501 words between the hook and the ladder footer, which counts the "Predict first" prompt and the
"Try it" line. Prose proper is about 490. You asked for 300 to 500.

## Every number in the post, and where it came from

All measured this session by running `nearest` and `analogy` from `src/explain/embeddings.ts`
against the shipped `public/word-vectors.json`, not recalled:

| claim in the post | measured |
|---|---|
| nearest to *ocean*: *sea* 0.88, *seas* 0.85, then *coast* | sea 0.881, seas 0.846, coast 0.809 |
| king − man + woman = **queen**, 0.86 | queen 0.861 (then daughter 0.768, prince 0.764) |
| paris − france + italy = **Rome**, 0.84 | rome 0.838 (then madrid 0.746) |
| *king* and *queen* score 0.78 | cosine 0.784 |
| *king* and *ocean* score 0.23 | cosine 0.229 |
| 1,429 words, 50 numbers each | `word-vectors.json`: 1429 entries, `dims: 50` |

If the vector file is ever regenerated, re-run those before republishing. Nothing here reads from
`modelStats.ts`, because no model of ours is involved.

## The embed

`embeddings` already existed in the registry, so nothing new was needed — it is the whole of §7
(nearest neighbours, live analogies, the 2-D map) with the page's prose stripped. The iframe in
the post is the real one and will work as soon as the post is published.

**One gap I closed to make the post work.** The demo took `?word=` but the analogy triple had no
prefill, so the post could quote the Paris result and then not link to it. `?analogy=a,b,c` now
works, on the page and on the embed, with `paramWords` in `src/lib/urlParams.ts` and unit tests
covering the wrong count, non-words and junk. The post links to
`?analogy=paris,france,italy` in the text.

Frame is 44×32rem, set before this post existed. Worth one look at the height in the iframe above;
I set the iframe to 740px, which is a guess.

## Questions for you

1. **Is there a hook?** A news item, a client conversation, an argument you had about whether these
   things "understand" anything. The post currently opens on a puzzle because I had nothing else.
2. **The bias paragraph is three sentences.** It could carry more weight, or be cut to a clause and
   given a post of its own later. Which?
3. **"Being straight with you"** is my phrasing for the honest-caveat block. Post 1 used no such
   label. Do you want a consistent one across the series, and is that it?

## Series bookkeeping

`src/data/series.ts` post 3 now carries this title and is marked `draft` rather than `planned`;
the post table in `docs/blog/OPUS-PROMPT.md` matches. The closing line promises post 4 on choosing
the next token, which is what the registry says post 4 is, and it now has the two-button greedy
versus sampled demo to point at.
