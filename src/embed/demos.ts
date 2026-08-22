// The embeddable "popup" demos: single-purpose pages a lecturer, trainer or presenter can
// drop into their own site with one <iframe>, or open full-screen on a projector.
//
// One HTML entry (embed.html) selects the demo from the query string — `?demo=tictactoe`.
// Query, not a fragment, for the same reason the lab's tabs are: Cloudflare's beacon reports
// pathname + search, so every embedded demo is countable on its own (see src/lab/tabRoute.ts).
//
// This module is deliberately pure (strings in, data out) so it is testable under vitest's
// node environment; EmbedApp maps an id to its React component.

export type DemoId = 'tictactoe' | 'harness-tools' | 'agent-loop' | 'prompt-injection' | 'lora'

export interface Demo {
  id: DemoId
  /** Browser-tab / index title. Not rendered inside the frame — an embed carries no blurb. */
  title: string
  /** The full lesson this demo is lifted from, for the index page and docs. */
  source: { label: string; href: string }
  /**
   * Fixed box, in rem, for demos whose content appears as you use them (a trace, a second
   * column). Without it the frame would grow mid-demo and the host page would jump under a
   * presenter mid-sentence. rem, not px, so `?scale=` still resizes the whole thing; the box
   * scrolls if a narrow host squeezes it. Omitted = the demo sizes itself (tic-tac-toe).
   */
  frame?: { w: number; h: number }
  /** The page it comes from sets the type: the harness page is sans, the lab/capstone mono. */
  font?: 'sans' | 'mono'
}

export const DEMOS: Demo[] = [
  {
    id: 'tictactoe',
    title: 'Play a tiny transformer at tic-tac-toe',
    source: { label: 'Capstone', href: './capstone.html' },
  },
  {
    id: 'harness-tools',
    title: 'Watch a tool call go through the harness',
    source: { label: 'Tools & agents §1', href: './harness.html' },
    frame: { w: 54, h: 28 },
    font: 'sans',
  },
  {
    id: 'agent-loop',
    title: 'Loop it — and it is an agent',
    source: { label: 'Tools & agents §3', href: './harness.html' },
    frame: { w: 54, h: 22 },
    font: 'sans',
  },
  {
    id: 'prompt-injection',
    title: 'Prompt injection — the agent obeys the tool output',
    source: { label: 'Tools & agents §4', href: './harness.html' },
    frame: { w: 60, h: 24 },
    font: 'sans',
  },
  {
    id: 'lora',
    title: 'LoRA — re-task a frozen model with a tiny overlay',
    source: { label: 'Lab', href: './lab.html?tab=lora-fine-tuning' },
    frame: { w: 68, h: 26 },
    font: 'mono',
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
