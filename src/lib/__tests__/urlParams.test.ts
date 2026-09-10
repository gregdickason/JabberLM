import { describe, it, expect } from 'vitest'
import { paramString, paramInt, paramOneOf, paramDigits, paramNumber } from '../urlParams'
import { sectionFromUrl, sectionUrl, knownSection } from '../sectionRoute'

describe('paramString', () => {
  it('returns the fallback when absent or empty', () => {
    expect(paramString('', 'prompt', 'hi')).toBe('hi')
    expect(paramString('?prompt=', 'prompt', 'hi')).toBe('hi')
    expect(paramString('?prompt=%20%20', 'prompt', 'hi')).toBe('hi')
  })
  it('decodes, trims and caps', () => {
    expect(paramString('?prompt=sort%206%209%202', 'prompt', 'x')).toBe('sort 6 9 2')
    expect(paramString(`?prompt=${'a'.repeat(500)}`, 'prompt', 'x')).toHaveLength(200)
  })
  it('strips control characters rather than rejecting the value', () => {
    expect(paramString('?prompt=a%00b%0Ac', 'prompt', 'x')).toBe('abc')
  })
})

describe('paramInt', () => {
  it('clamps into range and falls back on nonsense', () => {
    expect(paramInt('?k=4', 'k', 2, 1, 6)).toBe(4)
    expect(paramInt('?k=99', 'k', 2, 1, 6)).toBe(6)
    expect(paramInt('?k=-5', 'k', 2, 1, 6)).toBe(1)
    expect(paramInt('?k=abc', 'k', 2, 1, 6)).toBe(2)
    expect(paramInt('', 'k', 2, 1, 6)).toBe(2)
  })
})

describe('paramOneOf', () => {
  const models = ['weak', 'strong'] as const
  it('matches case-insensitively and rejects anything else', () => {
    expect(paramOneOf('?m=STRONG', 'm', models, 'weak')).toBe('strong')
    expect(paramOneOf('?m=nope', 'm', models, 'weak')).toBe('weak')
    expect(paramOneOf('', 'm', models, 'weak')).toBe('weak')
  })
})

describe('paramDigits', () => {
  it('accepts spaces, commas and plus', () => {
    expect(paramDigits('?list=6%209%202', 'list', [1, 2, 3])).toEqual([6, 9, 2])
    expect(paramDigits('?list=6,9,2', 'list', [1, 2, 3])).toEqual([6, 9, 2])
    expect(paramDigits('?list=6+9+2', 'list', [1, 2, 3])).toEqual([6, 9, 2])
  })
  it('rejects multi-digit, non-numeric, wrong-length and over-long input', () => {
    expect(paramDigits('?list=10%209%202', 'list', [1, 2, 3])).toEqual([1, 2, 3])
    expect(paramDigits('?list=a%20b%20c', 'list', [1, 2, 3])).toEqual([1, 2, 3])
    expect(paramDigits('?list=6%209', 'list', [1, 2, 3], 3)).toEqual([1, 2, 3])
    expect(paramDigits('?list=1%202%203%204%205%206%207%208%209', 'list', [1, 2, 3])).toEqual([
      1, 2, 3,
    ])
  })
})

describe('paramNumber', () => {
  it('keeps digits only and caps the width', () => {
    expect(paramNumber('?a=23,498', 'a', '1')).toBe('23498')
    expect(paramNumber('?a=abc', 'a', '1')).toBe('1')
    expect(paramNumber(`?a=${'9'.repeat(80)}`, 'a', '1')).toHaveLength(30)
  })
})

describe('sectionRoute', () => {
  it('prefers ?section= over #hash, and lower-cases', () => {
    expect(sectionFromUrl('?section=Cost', '#tokens')).toBe('cost')
    expect(sectionFromUrl('', '#Tokens')).toBe('tokens')
    expect(sectionFromUrl('', '')).toBe('')
  })
  it('builds an absolute url and preserves prefill params', () => {
    expect(sectionUrl('/explain', 'cost')).toBe('/explain?section=cost')
    expect(sectionUrl('/explain', 'hallucination', '?prompt=hi')).toBe(
      '/explain?prompt=hi&section=hallucination',
    )
  })
  it('replaces an existing section rather than appending', () => {
    expect(sectionUrl('/explain', 'tokens', '?section=cost')).toBe('/explain?section=tokens')
  })
  it('guards unknown ids', () => {
    expect(knownSection(['cost', 'tokens'], 'cost')).toBe(true)
    expect(knownSection(['cost', 'tokens'], 'nope')).toBe(false)
  })
})
