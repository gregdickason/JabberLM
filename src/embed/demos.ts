// The embeddable "popup" demos: single-purpose pages a lecturer, trainer or presenter can
// drop into their own site with one <iframe>, or open full-screen on a projector.
//
// One HTML entry (embed.html) selects the demo from the query string — `?demo=tictactoe`.
// Query, not a fragment, for the same reason the lab's tabs are: Cloudflare's beacon reports
// pathname + search, so every embedded demo is countable on its own (see src/lab/tabRoute.ts).
//
// This module is deliberately pure (strings in, data out) so it is testable under vitest's
// node environment; EmbedApp maps an id to its React component.

export type DemoId = 'tictactoe'

export interface Demo {
  id: DemoId
  /** Browser-tab / index title. Not rendered inside the frame — an embed carries no blurb. */
  title: string
  /** The full lesson this demo is lifted from, for the index page and docs. */
  source: { label: string; href: string }
}

export const DEMOS: Demo[] = [
  {
    id: 'tictactoe',
    title: 'Play a tiny transformer at tic-tac-toe',
    source: { label: 'Capstone', href: './capstone.html' },
  },
]

export const demoOf = (id: string | null | undefined): Demo | undefined =>
  DEMOS.find((d) => d.id === (id ?? '').toLowerCase().trim())

export const demoFromUrl = (search: string): Demo | undefined =>
  demoOf(new URLSearchParams(search).get('demo'))

// Presenters project these; `?scale=` multiplies the root font size, and every size in the
// embedded demos is rem-based so the whole thing grows with it. Default is deliberately
// larger than the site's own pages — an embed is read from the back of a room.
export const DEFAULT_SCALE = 1.25
export const MIN_SCALE = 0.75
export const MAX_SCALE = 2.5
export const BASE_FONT_PX = 16

export const scaleFromUrl = (search: string): number => {
  const raw = parseFloat(new URLSearchParams(search).get('scale') ?? '')
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw))
}

export const rootFontPx = (search: string) => `${BASE_FONT_PX * scaleFromUrl(search)}px`
