import { card } from './ui'

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'If I paste confidential information into a prompt, is it private?',
    a: (
      <>
        It depends entirely on the product and its settings, not on the model itself. Many consumer
        tiers may retain or use inputs to improve services; many enterprise/business tiers contractually
        do not, and offer data-residency and no-training guarantees. Treat the default as "not
        confidential" unless your agreement says otherwise, and avoid pasting privileged or regulated
        data into tools you haven't cleared.
      </>
    ),
  },
  {
    q: 'Will I get the same answer every time?',
    a: (
      <>
        Not reliably. With randomness ("temperature") above zero, the same prompt yields different
        answers. Even at zero, model or system updates can change outputs over time. For anything that
        needs to be reproducible, fix the settings, record the model version, and keep the output —
        don't assume a re-run will match.
      </>
    ),
  },
  {
    q: 'Can it cite real sources?',
    a: (
      <>
        Only when it's connected to a real document store or search tool that returns actual sources.
        On its own, a model will happily produce citations, quotes, and case numbers that look correct
        but are invented. Always click through and verify references.
      </>
    ),
  },
  {
    q: 'Is it actually reasoning, or just predicting text?',
    a: (
      <>
        Mechanically it predicts likely next text (the demos above). That can produce genuinely useful
        multi-step work, but it is not a guarantee of correctness and it has no understanding of truth.
        Use it to draft, summarise, and surface options — keep a human accountable for decisions.
      </>
    ),
  },
]

export default function Governance() {
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="mb-1 font-semibold text-slate-100">You can't fully see inside it</div>
        <p className="text-[12px] leading-relaxed text-slate-300">
          A trained model is millions to billions of numbers with no labels. Researchers can now read{' '}
          <em>some</em> of what's inside — identifying internal "features" a model uses and even steering
          them — but this is partial and an active research area, not a complete audit. So you generally
          cannot prove <em>why</em> a model produced a particular answer. That matters for bias,
          accountability, and compliance: validate outputs and keep humans in the loop for consequential
          decisions.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
          <a className="text-fuchsia-300 hover:underline" href="./lab.html">
            See the interpretability lab ↗
          </a>
          <a
            className="text-sky-400 hover:underline"
            href="https://transformer-circuits.pub/2024/scaling-monosemanticity/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Anthropic: reading features inside a model ↗
          </a>
        </div>
      </div>

      <div className="space-y-1">
        {FAQ.map((f) => (
          <details key={f.q} className={card + ' [&_summary]:cursor-pointer'}>
            <summary className="font-semibold text-slate-100">{f.q}</summary>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-300">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
