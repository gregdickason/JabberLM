import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALE, DEMOS, MAX_SCALE, MIN_SCALE, demoFromUrl, rootFontPx, scaleFromUrl } from '../demos'

describe('embed demo routing', () => {
  it('selects a demo from ?demo=', () => {
    expect(demoFromUrl('?demo=tictactoe')?.id).toBe('tictactoe')
    expect(demoFromUrl('?demo=TicTacToe%20')?.id).toBe('tictactoe') // case/space tolerant
  })

  it('returns nothing for a missing or unknown demo (EmbedApp shows the index)', () => {
    expect(demoFromUrl('')).toBeUndefined()
    expect(demoFromUrl('?demo=')).toBeUndefined()
    expect(demoFromUrl('?demo=chess')).toBeUndefined()
  })

  it('gives every demo a unique, url-safe id', () => {
    expect(new Set(DEMOS.map((d) => d.id)).size).toBe(DEMOS.length)
    for (const d of DEMOS) expect(d.id).toMatch(/^[a-z0-9-]+$/)
  })

  it('clamps ?scale= and falls back to the default on junk', () => {
    expect(scaleFromUrl('?scale=1.6')).toBe(1.6)
    expect(scaleFromUrl('?scale=9')).toBe(MAX_SCALE)
    expect(scaleFromUrl('?scale=0.1')).toBe(MIN_SCALE)
    for (const junk of ['', '?scale=', '?scale=big', '?scale=-2', '?scale=0'])
      expect(scaleFromUrl(junk)).toBe(DEFAULT_SCALE)
  })

  it('turns the scale into a root font size', () => {
    expect(rootFontPx('?scale=1')).toBe('16px')
    expect(rootFontPx('')).toBe('20px')
  })
})
