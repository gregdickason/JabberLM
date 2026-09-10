/**
 * Old deep links keep working after a section gains a short, stable id.
 *
 * Sections used to be anchored by a slug of their heading, so "Loop it — and it's an agent"
 * answered to `#loop-it-and-its-an-agent`. Those slugs are in the wild — in the guide, in the
 * capstone's cross-links, in anything anyone bookmarked or published — and they break silently
 * the moment a heading is edited, which is why the short ids exist now.
 *
 * So rather than choose, each page declares `{ 'old-slug': 'new-id' }` and any arriving legacy
 * anchor is resolved to the new id. Pure, so the mapping is testable; the hook that applies it
 * lives in `useSectionRoute`.
 */
export type AnchorAliases = Record<string, string>

/** Resolve an incoming anchor through the alias table (identity when it is already current). */
export const resolveAnchor = (aliases: AnchorAliases, id: string): string => aliases[id] ?? id

/** The full set of ids a page answers to — current ids plus every legacy alias. */
export const allAnchors = (ids: readonly string[], aliases: AnchorAliases): string[] => [
  ...ids,
  ...Object.keys(aliases),
]
