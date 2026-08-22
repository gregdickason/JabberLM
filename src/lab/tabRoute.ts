// Tab routing for the lab, kept pure (strings in, strings out) so it is testable under
// vitest's node environment — no `location`, no DOM.
//
// Tabs live in the QUERY STRING, not a #fragment, and that is an analytics decision as much
// as a routing one. Cloudflare Web Analytics' beacon builds the URL it reports from
// `pathname + search`; a fragment is invisible to it (fragments never reach a server either).
// The beacon also patches `history.pushState`, so pushing a new `?tab=` counts as its own
// pageview — which is the only way to see which of the thirteen demos anyone actually opens.
// Two rules fall out of that beacon's dedupe logic, and LabApp depends on both:
//   1. push on a real tab switch (replaceState is not a navigation and reports nothing);
//   2. push an ABSOLUTE path — it resolves a relative URL to the bare origin, which would
//      collapse every tab into a single entry.

export const TABS = [
  'neurons',
  'attention heads',
  'head ablation',
  'injury & recovery',
  'dictionary (SAE)',
  'steering',
  'mixture of experts',
  'advanced grokking',
  'distillation',
  'LoRA fine-tuning',
  'forgetting',
  'reward learning (RLVR)',
  'speculative decoding',
] as const
export type Tab = (typeof TABS)[number]

export const DEFAULT_TAB: Tab = 'neurons'

export const slug = (t: string) =>
  t.replace(/[()]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

export const tabOf = (s: string | null | undefined): Tab | undefined =>
  TABS.find((t) => slug(t) === (s ?? '').toLowerCase())

/** `?tab=` wins; `#hash` is the legacy form (old deep links, bookmarks) and still resolves. */
export const tabFromUrl = (search: string, hash: string): Tab =>
  tabOf(new URLSearchParams(search).get('tab')) ??
  tabOf(hash.replace(/^#/, '')) ??
  DEFAULT_TAB

/** Absolute (see rule 2 above) — pass `location.pathname`. */
export const tabUrl = (pathname: string, t: Tab) => `${pathname}?tab=${slug(t)}`
