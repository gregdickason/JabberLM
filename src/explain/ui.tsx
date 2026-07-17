// Small shared building blocks for the plain-language explainer.

// Turn a title into a short URL anchor, e.g. "Why it makes things up" -> "why-it-makes-things-up".
const slug = (s: string) =>
  s.replace(/[()'"]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

export function Section({
  n,
  title,
  id,
  children,
}: {
  n: number
  title: string
  id?: string // short, stable anchor for deep-linking (defaults to a slug of the title)
  children: React.ReactNode
}) {
  return (
    <section
      id={id ?? slug(title)}
      className="mx-auto max-w-2xl scroll-mt-6 border-t border-slate-800 px-4 py-8"
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xs font-bold text-fuchsia-400">{n}</span>
        <h2 className="text-lg font-bold text-slate-100">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  )
}

// "What this means if you work in…" callout.
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-sky-900 bg-sky-950/40 p-3 text-[13px] leading-relaxed text-sky-100">
      <div className="mb-1 font-semibold text-sky-300">What this means for your work</div>
      {children}
    </div>
  )
}

export const card = 'rounded-lg border border-slate-800 bg-slate-900/50 p-3'
export const btn =
  'rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700 disabled:opacity-40'
