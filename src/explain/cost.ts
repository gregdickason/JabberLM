// Rough, provider-neutral token + cost estimation for the "what does it cost"
// section. Real tokenizers split into sub-words; ~4 characters per token is the
// standard rule of thumb for English. Prices are illustrative and editable.

export interface Prices {
  inPerM: number // $ per 1,000,000 input tokens
  outPerM: number // $ per 1,000,000 output tokens
}

export interface Tier {
  name: string
  prices: Prices
}

// Illustrative tiers (orders of magnitude, not a quote). Users can edit prices.
export const TIERS: Tier[] = [
  { name: 'small/fast model', prices: { inPerM: 0.5, outPerM: 1.5 } },
  { name: 'mid model', prices: { inPerM: 3, outPerM: 15 } },
  { name: 'frontier model', prices: { inPerM: 15, outPerM: 75 } },
]

export function estimateTokens(text: string): number {
  return Math.max(0, Math.round(text.trim().length / 4))
}

export function estimateCost(inTokens: number, outTokens: number, p: Prices): number {
  return (inTokens / 1e6) * p.inPerM + (outTokens / 1e6) * p.outPerM
}

export function fmtUSD(x: number): string {
  if (x === 0) return '$0'
  if (x < 0.01) return '<$0.01'
  if (x < 1) return '$' + x.toFixed(3)
  return '$' + x.toFixed(2)
}
