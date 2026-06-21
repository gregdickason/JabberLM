// Training texts. Char-level tokenization keeps the vocab tiny and every token
// human-readable — and Jabberwocky's invented words are exactly why a normal
// subword tokenizer would be a poor teaching example here.

import { SHAKESPEARE_SONNETS } from './shakespeare'
import { JABBER_POEMS } from './jabberPoems'

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

// Three datasets that tell the core story: one poem overfits; many poems (in the
// same invented style) generalise; a different, real-English corpus (sonnets)
// shows the same tiny model coping with a wholly different voice.
//   - "Jabberwocky (one poem)" — train on this alone and watch held-out
//     validation loss turn up: the model memorises rather than generalises.
//   - "Jabber Poems" — Jabberwocky + 49 more in the same style (JABBER_POEMS);
//     enough variety that the tiny model learns the *style*, not one poem.
//   - "Shakespeare (sonnets)" — a larger real-English corpus for contrast.
export const TEXT_SAMPLES: TextSample[] = [
  { id: 'jabberwocky', name: 'Jabberwocky (one poem)', text: JABBERWOCKY },
  { id: 'jabber', name: 'Jabber Poems', text: JABBER_POEMS },
  { id: 'sonnets', name: 'Shakespeare (sonnets)', text: SHAKESPEARE_SONNETS },
]
