// Small, ready-made fine-tune targets for the LoRA demo. Each is a short
// Jabberwocky-style text engineered so that fine-tuning the bundled model's
// adapters for a few hundred steps produces an obvious, legible change — and
// toggling the LoRA overlay off snaps the model back to its base behaviour.
//
// Keep these in the base model's character set (letters + basic punctuation, no
// digits): out-of-vocab characters are silently dropped when encoded.

export interface FineTunePack {
  id: string
  name: string
  description: string
  text: string
}

// "Summon the Snark": hammer one distinctive recurring creature so the adapter
// learns to keep producing it — the clearest "the overlay added this" demo.
const REFRAIN = `Beware the Snark, my beamish boy,
the Snark that gyres in brillig light!
The Snark came snorfling through the wood,
the Snark, the Snark, in tulgey night.

O the Snark is sleek, the Snark is sly,
the Snark goes galumphing by and by.
Beware the Snark, the frumious Snark,
the Snark that whiffles in the dark.

The Snark, the Snark, the slithy Snark,
it burbled soft and left its mark.
Come hither, Snark, my vorpal friend,
the Snark will dance till brillig's end.

The Snark did gyre, the Snark did gimble,
the Snark was nimble, quick, and thimble.
And all who met the Snark would say:
the Snark, the Snark, callooh, callay!

Beware the Snark, beware its claws,
the Snark that snicker-snacks its jaws.
The Snark, the Snark, forever more,
the Snark came snorfling to the door.
`

// "Go nautical": steep the model in sea-words so generations drift toward tide,
// brine, and the deep — adaptation to a theme rather than one fixed phrase.
const NAUTICAL = `'Twas briny on the slithy tide,
and salt the foam did gyre and ride;
the mimsy waves were green and wide,
and brillig brine on every side.

The deep did burble, dark and cold,
where slithy eels and toves of old
went gimbling through the briny fold,
past coral caves and sunken gold.

Beware the tide, my beamish boy,
the salt-sea swell, the breakers' joy!
The foam that whiffles, wild and free,
the frumious fathoms of the sea.

O sail the slithy, salty deep,
where mome-fish dream and krakens sleep;
the brine is cold, the tide is steep,
and brillig waters, dark and deep.

The gulls did gyre, the waves did roar,
the salt-spray washed the rocky shore;
and all the briny ocean swore
the tide would turn forevermore.
`

export const FINETUNE_PACKS: FineTunePack[] = [
  {
    id: 'refrain',
    name: 'Summon the Snark',
    description:
      'Teaches the model to keep producing one distinctive creature. After a little training it says "the Snark" everywhere; toggle the overlay off and it vanishes.',
    text: REFRAIN,
  },
  {
    id: 'nautical',
    name: 'Go nautical',
    description:
      'Steeps the model in sea-words (tide, brine, the deep) so generations drift nautical — adapting to a theme rather than memorising one phrase.',
    text: NAUTICAL,
  },
]
