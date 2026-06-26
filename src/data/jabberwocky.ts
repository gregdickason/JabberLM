// Training texts. Char-level tokenization keeps the vocab tiny and every token
// human-readable — and Jabberwocky's invented words are exactly why a normal
// subword tokenizer would be a poor teaching example here.

import { JABBER_POEMS } from './jabberPoems'
import { buildSortCorpus, buildEquationCorpus } from './tasks'

export const JABBERWOCKY = `'Twas brillig, and the slithy toves
Did gyre and gimble in the wabe:
All mimsy were the borogoves,
And the mome raths outgrabe.

"Beware the Jabberwock, my son!
The jaws that bite, the claws that catch!
Beware the Jubjub bird, and shun
The frumious Bandersnatch!"

He took his vorpal sword in hand;
Long time the manxome foe he sought—
So rested he by the Tumtum tree
And stood awhile in thought.

And, as in uffish thought he stood,
The Jabberwock, with eyes of flame,
Came whiffling through the tulgey wood,
And burbled as it came!

One, two! One, two! And through and through
The vorpal blade went snicker-snack!
He left it dead, and with its head
He went galumphing back.

"And hast thou slain the Jabberwock?
Come to my arms, my beamish boy!
O frabjous day! Callooh! Callay!"
He chortled in his joy.

'Twas brillig, and the slithy toves
Did gyre and gimble in the wabe:
All mimsy were the borogoves,
And the mome raths outgrabe.
`

export interface TextSample {
  id: string
  name: string
  text: string
}

// A deliberate three-task curriculum — the same tiny model, three outcomes:
//   - "Jabber Poems"  — language: it MEMORISES a style and generates more of it.
//   - "Sorting"       — it learns a real procedure and GENERALISES to unseen
//                       inputs (it "groks", with a sudden jump in held-out accuracy).
//   - "Equations"     — it memorises the format but the arithmetic never clicks:
//                       fluent, confident, WRONG working (hallucination).
// (Edit the box or paste your own text to train on anything.)
export const TEXT_SAMPLES: TextSample[] = [
  { id: 'jabber', name: 'Jabber Poems', text: JABBER_POEMS },
  { id: 'sort', name: 'Sorting', text: buildSortCorpus() },
  { id: 'equations', name: 'Equations', text: buildEquationCorpus() },
]
