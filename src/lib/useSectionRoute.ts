import { useEffect } from 'react'
import { sectionFromUrl, sectionUrl, knownSection } from './sectionRoute'
import { resolveAnchor, type AnchorAliases } from './legacyAnchors'

/**
 * Keeps a long scrolling page's URL in step with the section you are reading, and lands a deep
 * link (`explain.html?section=cost`, a legacy `#cost`, or a legacy heading slug) on the right
 * section once React has painted it.
 *
 * Two different history verbs, deliberately:
 *
 *  - **Scrolling replaces.** A pushState per section scrolled past would turn the back button
 *    into a slow crawl up the page, which is a worse thing to do to a reader than the extra
 *    analytics row is worth. The URL still tracks the section, so it stays shareable.
 *  - **Clicking a contents link pushes** (`pushSection` below). That is a real navigation, it
 *    counts as a pageview, and back returns you where you were.
 *
 * A deep-link arrival needs no help either way: the beacon reads `?section=` off the URL as
 * part of the load pageview, which is what makes a blog post's "Try it →" countable.
 */
export function useSectionRoute(ids: readonly string[], ready: unknown, aliases: AnchorAliases = {}) {
  // Land a deep link, once the sections exist in the DOM.
  useEffect(() => {
    const raw = sectionFromUrl(location.search, location.hash)
    if (!raw) return
    const id = resolveAnchor(aliases, raw)
    if (!knownSection(ids, id)) return
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Track the section in view. IntersectionObserver rather than a scroll handler, so this costs
  // nothing while the reader is playing with a demo.
  useEffect(() => {
    const seen = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio)
        let best = ''
        let bestRatio = 0
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            best = id
            bestRatio = ratio
          }
        }
        if (!best || bestRatio <= 0) return
        if (sectionFromUrl(location.search, location.hash) === best) return
        history.replaceState(null, '', sectionUrl(location.pathname, best, location.search))
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
}

/** For a contents link: a deliberate jump, so it pushes and is counted. */
export function pushSection(id: string) {
  history.pushState(null, '', sectionUrl(location.pathname, id, location.search))
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
}
