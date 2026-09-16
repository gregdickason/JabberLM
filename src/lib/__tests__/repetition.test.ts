import { describe, it, expect } from 'vitest'
import { repeatingTail, readable } from '../repetition'

describe('repeatingTail', () => {
  it('finds the groove in real greedy output', () => {
    // This is what the bundled model actually produces at temperature 0 from
    // "'Twas brillig, and the " — the loop a reader sees and mistakes for a broken model.
    const real = "'Twas brillig, and the stone song,\nAnd stood the cross the stood the stood the stood the stood the stood the stoo"
    expect(repeatingTail(real)).toBe('the stood ')
  })

  it('returns null for text that is merely varied', () => {
    const sampled = "'Twas brillig, and the snicker-snack,\nAnd burbles trang shere were septers trurn the world"
    expect(repeatingTail(sampled)).toBeNull()
  })

  it('needs three repeats, not two', () => {
    expect(repeatingTail('xx ab ab ')).toBeNull()
    expect(repeatingTail('xx ab ab ab ')).not.toBeNull()
  })

  it('ignores a repeat that is not at the end', () => {
    expect(repeatingTail('ab ab ab and then something else entirely follows on')).toBeNull()
  })

  it('handles text shorter than a period', () => {
    expect(repeatingTail('')).toBeNull()
    expect(repeatingTail('ab')).toBeNull()
  })
})

describe('readable', () => {
  it('rotates a block caught mid-word to start at a word', () => {
    expect(readable('d the stoo')).toBe('the stood ')
  })

  it('leaves a block that already starts a word alone', () => {
    expect(readable('the stood ')).toBe('the stood ')
  })

  it('falls back when no rotation starts a word', () => {
    expect(readable('abcd')).toBe('abcd')
    expect(readable('   ')).toBe('   ')
  })
})
