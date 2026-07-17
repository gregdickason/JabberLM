// One shared top nav for every page, so a visitor always sees the same five places
// and where they currently are. Replaces the bespoke, per-page header link sets that
// varied in which links they showed, their order, and their labels.

export type NavKey = 'playground' | 'explain' | 'learn' | 'harness' | 'lab'

const LINKS: { key: NavKey; label: string; href: string }[] = [
  { key: 'playground', label: 'Playground', href: './' },
  { key: 'explain', label: 'New to AI', href: './explain.html' },
  { key: 'learn', label: 'How it works', href: './learn.html' },
  { key: 'harness', label: 'Tools & agents', href: './harness.html' },
  { key: 'lab', label: 'Lab', href: './lab.html' },
]

/**
 * `current` highlights the active page; `children` holds page-specific controls
 * (rendered between the brand and the right-aligned nav) — e.g. the playground's
 * Config/Guide buttons and model badge, or a page's descriptive subtitle.
 */
export default function SiteNav({ current, children }: { current: NavKey; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 bg-slate-900/60 px-4 py-2 font-mono">
      <a href="./" className="text-base font-bold text-sky-300 hover:text-sky-200">
        JabberLM
      </a>
      {children}
      <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs sm:ml-auto">
        {LINKS.map((l) =>
          l.key === current ? (
            <span
              key={l.key}
              aria-current="page"
              className="rounded bg-slate-800 px-1.5 py-1 sm:py-0.5 font-semibold text-sky-200 ring-1 ring-slate-600"
            >
              {l.label}
            </span>
          ) : (
            <a
              key={l.key}
              href={l.href}
              className="rounded px-1.5 py-1 sm:py-0.5 text-slate-300 hover:bg-slate-800 hover:text-sky-200"
            >
              {l.label}
            </a>
          ),
        )}
        <a
          href="https://github.com/gregdickason/JabberLM"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded px-1.5 py-1 sm:py-0.5 text-slate-400 hover:text-sky-300"
        >
          GitHub ↗
        </a>
      </nav>
    </header>
  )
}
