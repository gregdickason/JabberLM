// Section deep-linking for the long scrolling pages (explain / learn / harness / capstone).
//
// Same reasoning as the lab's tabRoute, for the same reason: Cloudflare Web Analytics builds
// the URL it reports from `pathname + search` and patches `history.pushState`, so
// `?section=cost` is a countable pageview while `#cost` is invisible to it. A blog post's
// "Try it →" therefore links to `?section=`, and every `#hash` link already in the wild
// keeps working.
//
// Pure (strings in, strings out) so it tests under vitest's node environment — no DOM.

/** `?section=` wins; a legacy `#hash` still resolves. '' when neither is present. */
export const sectionFromUrl = (search: string, hash: string): string =>
  (new URLSearchParams(search).get('section') || hash.replace(/^#/, '') || '').toLowerCase()

/**
 * Absolute path (a relative URL resolves to the bare origin in the beacon, collapsing every
 * section into one entry), preserving any prefill params so `?prompt=…&section=…` survives.
 */
export const sectionUrl = (pathname: string, id: string, search = '') => {
  const q = new URLSearchParams(search)
  q.set('section', id)
  return `${pathname}?${q.toString()}`
}

/** True when the id is one this page actually renders (guards a typo'd deep link). */
export const knownSection = (ids: readonly string[], id: string) => ids.includes(id)
