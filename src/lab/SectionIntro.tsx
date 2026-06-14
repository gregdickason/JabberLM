export interface Paper {
  title: string
  url: string
}

// Header for each lab section: a short plain description, the honest toy-scale
// caveat, and links to the papers the technique comes from.
export default function SectionIntro({
  title,
  children,
  papers,
}: {
  title: string
  children: React.ReactNode
  papers: Paper[]
}) {
  return (
    <div className="mb-4 max-w-3xl space-y-2">
      <h2 className="text-sm font-bold text-fuchsia-300">{title}</h2>
      <p className="text-[12px] leading-relaxed text-slate-300">{children}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <span className="text-slate-500">papers:</span>
        {papers.map((p) => (
          <a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline"
          >
            {p.title}
          </a>
        ))}
      </div>
    </div>
  )
}

export const CAVEAT =
  'This is a ~200k-parameter character model, so its "features" are low-level (spaces, letter pairs, capitals, vowel runs), not rich concepts. It demonstrates the method and the intuition, not Claude-scale meaning.'
