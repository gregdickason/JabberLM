import SiteNav from '../components/SiteNav'
import { useHashScroll } from '../components/useHashScroll'
import { PARTS, POSTS, publishedCount, type Post } from '../data/series'

/**
 * The reading order for the blog series that becomes the book, and the page a post links back
 * to. Everything here comes from `src/data/series.ts`, so the list cannot drift from the posts.
 *
 * Unwritten posts are shown as planned rather than hidden. A reader who arrives mid-series
 * should be able to see the shape of the argument, and the demos are already live even where
 * the writing is not.
 */

function Row({ p }: { p: Post }) {
  const done = p.status === 'published'
  const dispatch = p.kind === 'dispatch'
  return (
    <li className="flex gap-3 border-t border-slate-800 py-3">
      <span
        className={
          'mt-0.5 w-6 shrink-0 text-right font-mono text-[12px] ' +
          (done ? 'text-sky-300' : 'text-slate-600')
        }
        title={dispatch ? 'a dispatch — written when it happened, off the ladder' : undefined}
      >
        {dispatch ? '·' : p.n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {p.url ? (
            <a href={p.url} className="text-[13px] font-semibold text-sky-300 hover:underline">
              {p.title}
            </a>
          ) : (
            <span className={'text-[13px] font-semibold ' + (done ? 'text-slate-100' : 'text-slate-400')}>
              {p.title}
            </span>
          )}
          {dispatch && (
            <span className="rounded border border-amber-800 px-1 text-[10px] uppercase tracking-wide text-amber-500">
              dispatch{p.date ? ` · ${p.date}` : ''}
            </span>
          )}
          {!done && (
            <span className="rounded border border-slate-700 px-1 text-[10px] uppercase tracking-wide text-slate-500">
              {p.status}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-400">{p.idea}</p>
        {p.tryIt && (
          <a className="mt-1 inline-block text-[12px] text-sky-400 hover:underline" href={p.tryIt.href}>
            → {p.tryIt.label}
          </a>
        )}
      </div>
    </li>
  )
}

export default function SeriesApp() {
  useHashScroll(true)
  const parts = [1, 2, 3, 4, 5] as const

  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <SiteNav current="series">
        <span className="hidden text-xs text-slate-400 sm:inline">The series</span>
      </SiteNav>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-lg font-bold text-slate-100">'Twas Brillig — the series</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
          A climb from the smallest language model that does anything useful to the ones making
          headlines, one rung at a time, each with something you can run yourself. The posts become
          a book; this page is the reading order.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
          The promise is that it is one mechanism the whole way up. Nothing gets bolted on at the top
          whose seed you cannot already see at the bottom.
        </p>
        <p className="mt-2 text-[12px] text-slate-500">
          {publishedCount()} of {POSTS.filter((p) => p.kind !== 'dispatch').length} rungs published,
          plus the occasional dispatch when something happens that is worth stopping for. The demos
          below are live whether or not the post that uses them is written yet — that is the point
          of the site.
        </p>

        {parts.map((n) => (
          <section key={n} id={`part-${n}`} className="mt-8 scroll-mt-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-400">
              Part {n} — {PARTS[n]}
            </h2>
            <ul className="mt-1">
              {POSTS.filter((p) => p.part === n).map((p) => (
                <Row key={p.n} p={p} />
              ))}
            </ul>
          </section>
        ))}

        <footer className="mt-10 border-t border-slate-800 pt-4 text-[12px] leading-relaxed text-slate-500">
          Lost a word? The{' '}
          <a className="text-sky-400 hover:underline" href="./glossary.html">
            glossary
          </a>{' '}
          defines every term the series uses. Running a session with this?{' '}
          <a className="text-sky-400 hover:underline" href="./teachers.html">
            For teachers
          </a>{' '}
          has session plans and embeddable demos. Built by Greg Dickason.
        </footer>
      </div>
    </div>
  )
}
