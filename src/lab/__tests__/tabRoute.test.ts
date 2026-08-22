import { describe, expect, it } from 'vitest'
import { DEFAULT_TAB, TABS, slug, tabFromUrl, tabUrl } from '../tabRoute'

describe('lab tab routing', () => {
  it('gives every tab a distinct url-safe slug', () => {
    const slugs = TABS.map(slug)
    expect(new Set(slugs).size).toBe(TABS.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('round-trips every tab through its url', () => {
    for (const t of TABS) {
      const url = tabUrl('/lab.html', t)
      expect(tabFromUrl(url.slice(url.indexOf('?')), '')).toBe(t)
    }
  })

  it('reports an absolute path with the tab in the query string', () => {
    // Both matter to the Cloudflare beacon: it resolves a relative URL to the bare origin
    // (every tab would dedupe to one entry) and it ignores fragments entirely.
    const url = tabUrl('/lab.html', 'injury & recovery')
    expect(url).toBe('/lab.html?tab=injury-recovery')
    expect(url.startsWith('/')).toBe(true)
    expect(url).not.toContain('#')
  })

  it('still resolves legacy #hash deep links, with ?tab= winning', () => {
    expect(tabFromUrl('', '#head-ablation')).toBe('head ablation')
    expect(tabFromUrl('?tab=steering', '#head-ablation')).toBe('steering')
  })

  it('falls back to the default tab on a bare or unknown url', () => {
    expect(tabFromUrl('', '')).toBe(DEFAULT_TAB)
    expect(tabFromUrl('?tab=nonsense', '#also-nonsense')).toBe(DEFAULT_TAB)
    expect(tabFromUrl('?other=1', '')).toBe(DEFAULT_TAB)
  })
})
