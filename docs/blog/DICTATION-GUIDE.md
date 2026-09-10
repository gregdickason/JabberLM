# Dictation guide — what to say so Opus can write the post

You talk; Opus writes. This guide tells you what each post needs from you, what you can skip, and how to
mark things while speaking. Pair it with `docs/blog/OPUS-PROMPT.md` (the post list is in Part A; the
template Opus writes to is in Part B).

## The short version

One post is **five to eight minutes of talking**, about 900–1,400 spoken words. Say it in this order:

1. **The hook** — the news story or the everyday puzzle you'd open with, and why it made you think of this.
2. **Explain it to a friend** — the idea as you'd say it over coffee, no terms.
3. **The question** — what you'd ask the reader to predict before they click.
4. **What they'll see** — walk through the demo as if you're watching over their shoulder.
5. **How it actually works** — now the terms, in your own words.
6. **So what** — one thing someone should do differently at work because of this.
7. **The honest bit** — what the tiny model can't show, what's an estimate, what you're skipping.
8. **The bridge** — where this sits on the size ladder, and what's next.

You do not have to do all eight. Three, four, five and seven are the ones only you can supply. Opus can
fill two, six and eight from the site if you skip them, and it will mark those paragraphs `[FROM SITE]`
in the notes so you can re-do them in your words later.

## What only you can give

Opus has the whole site and every measured number. It does **not** have:

- **The stories.** The fix you tried that failed. The moment a number surprised you. Why you chose
  sorting over algebra. What the exhaustive tic-tac-toe eval told you that the accuracy didn't. Tell
  these in full, in the first person, with the wrong turn included. They are the book.
- **Your opinions.** "I think RLHF gets too much credit." "I'd never deploy this without a check layer."
  Say them plainly; Opus will keep your hedge exactly as strong as you made it.
- **The hook.** Which headline, which conversation, which question from a colleague. Opus will not invent
  a news story; if you don't give one it will use a puzzle instead.
- **Your phrasings.** If you have a line ("same brain, longer education"), say it. Opus keeps your words
  and tidies the grammar; it does not rewrite you into its own voice.
- **What the reader should predict.** You know where people guess wrong.

## How to speak

- **Full sentences, as if to one person.** Not notes, not headings. "So the thing about tokens is…" is
  fine. Bullet-speak ("tokens. subword. strawberry example.") gives Opus nothing to keep.
- **Don't read the outline aloud.** Opus has it. Talk about the idea, not the plan.
- **Ramble is fine; restarts are fine.** Say "scrap that" and go again. Opus takes the last version.
- **Say the number, then say where it came from** if you know: "eighty-nine percent on the held-out
  lists" is better than "about ninety". If you don't know or can't remember, say **"check number"** and
  Opus will source it or flag it. Never guess a frontier size; say "estimated".
- **Say the running example.** "Sort six nine two" not "the sorting example". The literal prompts are
  the reader's handholds.
- **Mark structure with a word:** say **"new paragraph"**, **"sidebar"** (for a ▼ Go deeper box),
  **"the honest bit"**, **"so what"**, **"footnote"**. Opus listens for these.
- **Mark uncertainty with a word:** "check number", "check this", "I think but not sure". Opus will
  not upgrade a "not sure" to a fact.
- **Mark what to cut:** "off the record" for something you want Opus to know but not print.
- **Name the demo you mean:** "the tokenizer embed", "the head-ablation tab", "the tic-tac-toe game
  with the check off". The names are in the OPUS-PROMPT post table.

## Per post: the thing to make sure you say

The one sentence each post cannot do without. Say it however you like.

| # | Post | Make sure you say |
|---|---|---|
| 2 | It doesn't see letters | what the model actually receives for *strawberry*, and why that one fact explains counting, reversing, arithmetic |
| 3 | Words as places | that "similar meaning, nearby coordinates" comes from the company words keep; and the bias line |
| 4 | The reflex | "a fluent, confident answer is a prediction, not a fact", in your words |
| 5 | What it can see | attention is the *only* step where information moves between tokens; and what "outside the window" means for a long chat |
| 6 | The rest of the block | that stacking attention + MLP a few times *is* the whole model; nothing else is in there |
| 7 | Learning by being wrong | that every one of the 90,000 numbers gets nudged a little, every step; what "loss" measures |
| 8 | The moment it gets it | memorising the training lists vs the rule; what you saw the first time the held-out curve jumped |
| 9 | Why it makes things up | that the model was *trained* on algebra and still can't do it; it learned the shape, not the sum |
| 10 | Knowledge / skill | the split: skill goes in the weights, knowledge you look up; and the caveat that the browser can't do the end-to-end |
| 11 | Opening the box | one head, one skill; what "ablate" means; the surprise that poems survive |
| 12 | Injury and recovery | that you retrained with the head *locked off* and the skill came back somewhere else; the brain analogy and its limit |
| 13 | Cleaner concepts | superposition in one sentence; what steering felt like to do |
| 14 | Many brains in one | that experts are chosen per token, not per task; what ablating one expert broke |
| 15 | How a model is made | pretraining vs fine-tuning; the adapter is ~12% of the base and the base never changes |
| 16 | Teaching it to behave | **this is the chat gap**: why it answers instead of continuing; SFT then preferences; that this shapes behaviour, not truth; the forgetting story |
| 17 | Talking to it well | that the whole conversation is re-sent every turn; what a system prompt is; your own prompting rules |
| 18 | Giving it tools | "a model's answer is a guess, a tool's output is a computation"; what breaks when the harness is off |
| 19 | Loop it | what an agent adds (the loop, a stop); the injection story; "authorise consequential actions" |
| 20 | Reasoning in a loop | the model does every sum; the harness only holds the place; the 25-digit result; name chain-of-thought |
| 21 | What it costs | why output tokens cost more; the quantisation cliff; the lever you'd pull first |
| 22 | Play it, then look inside | what the model was *never told* (rules, legal cells); budget not size; the heads that learned to look at danger; the 9 losing lines |
| 23 | The concept nobody labelled | that fragile/heavy/food/chemical were never tokens and the embeddings clustered anyway |
| 24 | Emergence | the number line as the smallest emergence you've seen; what you believe about scale |
| 25 | The strange loop | Hofstadter in your words; the agent loop pointed at itself; where you stop |
| 26 | What we can and can't claim | your actual position, hedged exactly as much as you mean it |

## What not to worry about

- Grammar, ums, repeats, order. Opus fixes all of that.
- Exact numbers. Say "check number" and move on.
- Links and embeds. Opus adds them from the post table.
- Terms you've forgotten the name of. Describe it ("the thing where you freeze the model and train a
  small add-on") and Opus names it.
- Length. Over is better than under; Opus cuts, it can't invent.
- The ladder footer, the Go-deeper maths, the definitions. Opus does those.

## Filing

One file per post: `docs/blog/dictation/post-NN.md` (raw transcript, no tidying). If you re-dictate a
section, add it to the same file under a line that says `--- redo: <section> ---`; Opus uses the latest.
Off-the-record notes to Opus can go at the top under `--- notes ---`.

Opus returns two files: `docs/blog/post-NN-<slug>.md` (the draft) and `docs/blog/post-NN-notes.md`
(what it used, what it flagged, up to three questions). Read the notes first; the `[CHECK]` and
`[FROM SITE]` items are the ones that need you.
