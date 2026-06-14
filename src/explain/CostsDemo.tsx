import { useState } from 'react'
import { estimateCost, estimateTokens, fmtUSD, TIERS, type Prices } from './cost'
import { card } from './ui'

// "What it costs to run." Paste text → tokens → an illustrative price, and how it
// scales with answer length and volume.
export default function CostsDemo() {
  const [text, setText] = useState(
    'Please review the attached 12-page services agreement and summarise the key obligations, termination rights, and liability caps.',
  )
  const [tierIdx, setTierIdx] = useState(1)
  const [answerTokens, setAnswerTokens] = useState(500)
  const [prices, setPrices] = useState<Prices>(TIERS[1].prices)

  const inTokens = estimateTokens(text)
  const perCall = estimateCost(inTokens, answerTokens, prices)

  const num = 'w-24 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-right text-[12px] text-slate-100'

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        Paste a prompt or document. Cost is driven by how much text goes in plus how much comes out.
      </div>
      <textarea
        className="h-20 w-full resize-y rounded border border-slate-700 bg-slate-800 p-2 text-[12px] text-slate-100"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-slate-300">
        <span>
          input ≈ <span className="text-slate-100">{inTokens.toLocaleString()}</span> tokens
        </span>
        <label className="flex items-center gap-1">
          model
          <select
            className={num + ' w-36'}
            value={tierIdx}
            onChange={(e) => {
              const i = Number(e.target.value)
              setTierIdx(i)
              setPrices(TIERS[i].prices)
            }}
          >
            {TIERS.map((t, i) => (
              <option key={t.name} value={i}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          answer length (tokens)
          <input
            type="number"
            className={num}
            min={0}
            step={100}
            value={answerTokens}
            onChange={(e) => setAnswerTokens(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <label className="flex items-center gap-1">
          $/1M in
          <input
            type="number"
            className={num}
            step={0.5}
            value={prices.inPerM}
            onChange={(e) => setPrices((p) => ({ ...p, inPerM: Number(e.target.value) }))}
          />
        </label>
        <label className="flex items-center gap-1">
          $/1M out
          <input
            type="number"
            className={num}
            step={0.5}
            value={prices.outPerM}
            onChange={(e) => setPrices((p) => ({ ...p, outPerM: Number(e.target.value) }))}
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="per request" value={fmtUSD(perCall)} />
        <Stat label="× 1,000 requests" value={fmtUSD(perCall * 1000)} />
        <Stat label="× 100,000 requests" value={fmtUSD(perCall * 100000)} />
      </div>
      <div className="mt-2 text-[11px] text-amber-400/90">
        Illustrative only — token prices vary by provider and model and change often. Check current
        pricing for real budgets. Note output tokens usually cost several times more than input tokens,
        so long answers and re-runs add up.
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        One to raise with your technical team: <span className="text-slate-200">prompt caching / KV-cache
        reuse</span>. When the same long instructions or documents are sent on every call, the model can
        store and reuse its processed view of that text — the attention "keys and values" it computed for
        the prompt, known as the KV cache — instead of re-reading it each time. Providers bill cached
        input at a large discount, so for repeated long-context work it can cut cost and latency
        substantially. Worth asking: "are we caching the parts of the prompt that don't change?"
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-2">
      <div className="text-base font-bold text-emerald-300">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
