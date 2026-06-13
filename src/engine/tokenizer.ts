// Character-level tokenizer. The vocabulary is simply the sorted set of unique
// characters in the training text — so every token is a single, human-readable
// character. This is what makes the inspector legible (and why char-level suits
// Jabberwocky's invented words, which would fragment under a subword tokenizer).

export class CharTokenizer {
  readonly itos: string[] // id -> char
  readonly stoi: Map<string, number> // char -> id

  constructor(text: string) {
    const chars = Array.from(new Set(Array.from(text))).sort()
    this.itos = chars
    this.stoi = new Map(chars.map((c, i) => [c, i]))
  }

  get vocabSize(): number {
    return this.itos.length
  }

  encode(text: string): number[] {
    const ids: number[] = []
    for (const ch of text) {
      const id = this.stoi.get(ch)
      if (id !== undefined) ids.push(id) // silently skip out-of-vocab chars
    }
    return ids
  }

  decode(ids: number[]): string {
    return ids.map((i) => this.itos[i] ?? '').join('')
  }

  /** Human-readable label for a token id (spaces/newlines shown as glyphs). */
  label(id: number): string {
    const ch = this.itos[id]
    if (ch === ' ') return '␣'
    if (ch === '\n') return '⏎'
    if (ch === '\t') return '⇥'
    return ch
  }
}
