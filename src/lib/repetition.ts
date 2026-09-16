/**
 * Spotting the repeating groove that greedy decoding falls into.
 *
 * Taking the most likely token every time is deterministic, so as soon as the text re-enters a
 * state it has been in before, the continuation must repeat — and the model is in a loop it
 * cannot leave. Every language model does this when decoded that way; it is a property of the
 * decoding rule, not of the model's size or training.
 *
 * The teaching pages quote the block back to the reader, so the note names the thing they are
 * looking at rather than describing it in the abstract.
 */

/** The shortest block repeating itself at the end of `s`, or null if there isn't one. */
export function repeatingTail(s: string, minRepeats = 3, maxPeriod = 15): string | null {
  const tail = s.slice(-60)
  for (let p = 2; p <= maxPeriod; p++) {
    if (tail.length < p * minRepeats) break
    const block = tail.slice(-p)
    if (tail.slice(-p * minRepeats) === block.repeat(minRepeats)) return readable(block)
  }
  return null
}

/**
 * A repeating block can be caught mid-word: "…the stood the stood…" is just as truly the block
 * "d the stoo". Rotate it to begin after a space so the quote reads the way a person would say
 * it out loud. Falls back to the block as found when no rotation starts a word.
 */
export function readable(block: string): string {
  const p = block.length
  for (let k = 0; k < p; k++) {
    if (block[(k - 1 + p) % p] === ' ' && block[k] !== ' ') return block.slice(k) + block.slice(0, k)
  }
  return block
}
