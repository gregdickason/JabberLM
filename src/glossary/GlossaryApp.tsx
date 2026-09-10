import { useMemo, useState } from 'react'
import SiteNav from '../components/SiteNav'
import { useHashScroll } from '../components/useHashScroll'
import { GROUPS, TERMS, type Term } from '../data/glossary'

/**
 * One definition per term, linkable (`glossary.html#logit`).
 *
 * Every teaching page on this site introduces terms, and until now none of them had anywhere
 * to send a reader who had lost one. The register here matches the "New to AI" page: define it
 * without leaning on another undefined word, and prefer the honest short answer.
 */

function Entry({ t }: { t: Term }) {
  return (
    <div id={t.id} className="scroll-mt-6 border-t border-slate-800 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-slate-100">{t.term}</h3>
        {t.also && <span className="text-[11px] text-slate-500">also: {t.also}</span>}
        <a
          href={`#${t.id}`}
          className="ml-auto text-[11px] text-slate-600 hover:text-sky-400"
          aria-label={`link to ${t.term}`}
        >
          #
        </a>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{t.short}</p>
      {t.more && <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{t.more}</p>}
      {t.see && (
        <a className="mt-1 inline-block text-[12px] text-sky-400 hover:underline" href={t.see.href}>
          → {t.see.label}
        </a>
      )}
    </div>
  )
}

export default function GlossaryApp() {
  const [q, setQ] = useState('')
  useHashScroll(true)

  const needle = q.trim().toLowerCase()
  const hits = useMemo(
    () =>
      !needle
        ? TERMS
        : TERMS.filter((t) =>
            [t.term, t.also ?? '', t.short, t.more ?? ''].join(' ').toLowerCase().includes(needle),
          ),
    [needle],
  )

  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <SiteNav current="glossary">
        <span className="hidden text-xs text-slate-400 sm:inline">Glossary</span>
      </SiteNav>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-lg font-bold text-slate-100">Glossary</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
          Every term this site uses, in plain words. If a page threw a word at you before it
          explained it, it is here. Each entry says where you can go and watch the thing itself.
        </p>

        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter — try 'token', 'agent', 'cost'"
            aria-label="Filter glossary"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-500"
          />
        </div>

        {needle ? (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              {hits.length} {hits.length === 1 ? 'match' : 'matches'}
            </div>
            {hits.map((t) => (
              <Entry key={t.id} t={t} />
            ))}
            {hits.length === 0 && (
              <p className="mt-3 text-[13px] text-slate-400">
                Nothing here matches that. If it is a term you met on this site, that is a gap worth
                reporting on{' '}
                <a
                  className="text-sky-400 hover:underline"
                  href="https://github.com/gregdickason/JabberLM/issues"
                >
                  GitHub
                </a>
                .
              </p>
            )}
          </div>
        ) : (
          <>
            <nav aria-label="Contents" className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {GROUPS.map((g) => (
                  <a
                    key={g}
                    href={`#${g.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                    className="text-[12px] text-sky-400 hover:underline"
                  >
                    {g}
                  </a>
                ))}
              </div>
            </nav>

            {GROUPS.map((g) => (
              <section key={g} id={g.toLowerCase().replace(/[^a-z]+/g, '-')} className="mt-6 scroll-mt-6">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-400">{g}</h2>
                {TERMS.filter((t) => t.group === g).map((t) => (
                  <Entry key={t.id} t={t} />
                ))}
              </section>
            ))}
          </>
        )}

        <footer className="mt-10 border-t border-slate-800 pt-4 text-[12px] text-slate-500">
          Numbers quoted around the site come from{' '}
          <span className="font-mono text-slate-400">src/data/modelStats.ts</span>, which is
          regenerated from the model files themselves. Built by Greg Dickason.
        </footer>
      </div>
    </div>
  )
}
