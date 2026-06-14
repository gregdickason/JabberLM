import { useEffect, useMemo, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { computeHeadStats, probeHeadAttention, type HeadStat } from '../interp/heads'
import SectionIntro from './SectionIntro'
import Heatmap from '../viz/Heatmap'

export default function HeadsSection({ trainer }: { trainer: Trainer }) {
  const [stats, setStats] = useState<HeadStat[] | null>(null)
  const [sel, setSel] = useState<{ layer: number; head: number }>({ layer: 0, head: 0 })

  useEffect(() => {
    setStats(null)
    const id = setTimeout(() => {
      const s = computeHeadStats(trainer.model, trainer.tok.encode(trainer.text))
      setStats(s)
      const best = [...s].sort((a, b) => b.induction - a.induction)[0]
      if (best) setSel({ layer: best.layer, head: best.head })
    }, 0)
    return () => clearTimeout(id)
  }, [trainer])

  // a probe sequence whose first chunk repeats, so induction heads have something
  // to copy from (attend from the 2nd occurrence back to "what came next" the 1st time)
  const probe = useMemo(() => {
    const chunk = trainer.tok.encode(trainer.text).slice(0, Math.min(24, Math.floor(trainer.model.cfg.contextLen / 2)))
    return [...chunk, ...chunk]
  }, [trainer])

  const probeLabels = probe.map((id) => trainer.tok.label(id))
  const attn = useMemo(
    () => probeHeadAttention(trainer.model, sel.layer, sel.head, probe),
    [trainer, sel, probe],
  )

  const color = (label: HeadStat['label']) =>
    label === 'induction'
      ? 'text-emerald-300'
      : label === 'previous-token'
        ? 'text-sky-300'
        : 'text-slate-400'

  return (
    <div>
      <SectionIntro
        title="Attention heads & circuits"
        papers={[
          { title: 'A Mathematical Framework for Transformer Circuits', url: 'https://transformer-circuits.pub/2021/framework/index.html' },
          { title: 'In-context Learning and Induction Heads', url: 'https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html' },
        ]}
      >
        Attention heads route information between positions, and many specialise. Two famous roles:
        a <span className="text-sky-300">previous-token</span> head (each position looks one step back)
        and an <span className="text-emerald-300">induction</span> head (it looks at the token that
        followed the last time the current token appeared — the core of copying and in-context
        learning). Scores below are averaged over the whole corpus; pick a head to see its pattern on a
        repeated probe, where induction shows up as a bright off-diagonal stripe.
      </SectionIntro>

      {!stats ? (
        <div className="text-xs text-slate-500">scanning heads…</div>
      ) : (
        <div className="flex flex-wrap gap-6">
          <div>
            <table className="text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 text-left">head</th>
                  <th className="px-2 text-right">prev-token</th>
                  <th className="px-2 text-right">induction</th>
                  <th className="px-2 text-left">role</th>
                </tr>
              </thead>
              <tbody>
                {[...stats]
                  .sort((a, b) => b.induction - a.induction)
                  .map((s) => {
                    const active = s.layer === sel.layer && s.head === sel.head
                    return (
                      <tr
                        key={`${s.layer}.${s.head}`}
                        onClick={() => setSel({ layer: s.layer, head: s.head })}
                        className={'cursor-pointer ' + (active ? 'bg-slate-800' : 'hover:bg-slate-800/50')}
                      >
                        <td className="px-2 text-slate-300">L{s.layer}·H{s.head}</td>
                        <td className="px-2 text-right text-slate-400">{s.prevToken.toFixed(2)}</td>
                        <td className="px-2 text-right text-slate-400">{s.induction.toFixed(2)}</td>
                        <td className={'px-2 ' + color(s.label)}>{s.label}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          <div className="min-w-0 overflow-x-auto">
            <Heatmap
              matrix={attn}
              scale="sequential"
              title={`L${sel.layer}·H${sel.head} attention on a repeated probe (query rows × key cols)`}
              rowLabels={probeLabels}
              colLabels={probeLabels}
            />
            <div className="mt-1 max-w-sm text-[11px] text-slate-500">
              On the repeated probe, an induction head puts weight on the stripe one position after the
              first copy — it has learned "this happened before; predict what came next".
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
