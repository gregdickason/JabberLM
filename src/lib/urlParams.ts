// Prefill: let a URL put the reader in front of a *specific* example, so a blog post can
// say "open the hallucination demo on 7x + 2 = 16" and have it be true on arrival.
//
// Every teaching demo on the site holds its example in local state. These helpers read an
// initial value from the query string instead, falling back to the demo's own default, and
// are shared by the full pages and their embeds (`embed.html?demo=…&prompt=…`).
//
// Pure and defensive: a missing, empty, over-long or hostile value yields the fallback, so
// a demo can never be wedged by a bad link.

const MAX = 200

// Control characters are stripped rather than rejected: a prompt pasted out of a terminal
// or a blog's code block often carries a stray newline, and the reader meant the text.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g

/** One string param, trimmed, length-capped, falling back to the demo's default. */
export function paramString(search: string, key: string, fallback: string): string {
  const raw = new URLSearchParams(search).get(key)
  if (raw == null) return fallback
  const v = raw.replace(CONTROL, '').trim()
  return v ? v.slice(0, MAX) : fallback
}

/** One integer param inside [min, max], falling back when absent or unparseable. */
export function paramInt(
  search: string,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = new URLSearchParams(search).get(key)
  if (raw == null) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** One value out of a fixed set (case-insensitive), else the fallback. */
export function paramOneOf<T extends string>(
  search: string,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = (new URLSearchParams(search).get(key) ?? '').toLowerCase()
  return allowed.find((a) => a.toLowerCase() === raw) ?? fallback
}

/**
 * A digits-and-spaces list, e.g. `?list=6 9 2` (also accepts `6,9,2` and `6+9+2`).
 * Returns the fallback unless every token is a single digit — the tiny models' whole
 * numeric vocabulary — so a demo can't be handed input it cannot tokenize.
 */
export function paramDigits(
  search: string,
  key: string,
  fallback: number[],
  count?: number,
): number[] {
  const raw = new URLSearchParams(search).get(key)
  if (raw == null) return fallback
  const parts = raw.trim().split(/[\s,+]+/).filter(Boolean)
  if (!parts.length || parts.length > 8) return fallback
  if (count != null && parts.length !== count) return fallback
  const ns = parts.map((p) => (/^[0-9]$/.test(p) ? Number(p) : NaN))
  return ns.some((n) => Number.isNaN(n)) ? fallback : ns
}

/** `?a=123&b=456` for the adder: digit strings only, capped so the loop stays quick. */
export function paramNumber(search: string, key: string, fallback: string, maxDigits = 30): string {
  const raw = (new URLSearchParams(search).get(key) ?? '').replace(/[^0-9]/g, '')
  return raw ? raw.slice(0, maxDigits) : fallback
}
