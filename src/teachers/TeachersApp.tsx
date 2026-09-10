import { useEffect } from 'react'
import SiteNav from '../components/SiteNav'
import { useHashScroll } from '../components/useHashScroll'
import { DEMOS, demoOf, type Demo } from '../embed/demos'
import { LESSONS } from './lessons'

// The one page on this site aimed at the person AT THE FRONT of the room rather than the
// learner: what to show, in what order, how long each part takes, and how to lift a demo out
// and put it in their own material. Everything here is a claim about how the site behaves,
// so it is written from what the code actually does — the embed table is generated from the
// same registry embed.html routes from, so it cannot drift.

const H = ({ id, n, children }: { id: string; n: number; children: React.ReactNode }) => (
  <div className="mb-3 flex items-baseline gap-2">
    <span className="text-xs font-bold text-fuchsia-400">{n}</span>
    <h2 id={id} className="scroll-mt-6 text-lg font-bold text-slate-100">
      {children}
    </h2>
  </div>
)

const Sec = ({ children }: { children: React.ReactNode }) => (
  <section className="mx-auto max-w-3xl border-t border-slate-800 px-4 py-8">{children}</section>
)

const th = 'border-b border-slate-700 px-2 py-1.5 text-left align-top font-semibold text-slate-300'
const td = 'border-b border-slate-800 px-2 py-1.5 align-top'
const a = 'text-sky-400 hover:underline'

const ROUTES = [
  {
    time: '15 min',
    label: 'A single demo',
    body: (
      <>
        Open the <a className={a} href="./capstone.html">capstone</a> and play the tic-tac-toe agent, or
        drop one embed into your slides. Enough to make one point: a model proposes, a harness checks.
      </>
    ),
  },
  {
    time: '50 min',
    label: 'A lecture',
    body: (
      <>
        <a className={a} href="./explain.html">New to AI</a> (tokens, embeddings, why it makes things up),
        ending on{' '}
        <a className={a} href="./explain.html?section=instruction">§5, “why it answers instead of continuing”</a>{' '}
        → <a className={a} href="./harness.html">Tools &amp; agents</a> §1 and §3 → the{' '}
        <a className={a} href="./capstone.html">capstone</a> game. Talk over the explain page but{' '}
        <b>run §5 live</b>: the same instruction goes to two models within 2,000 parameters of each
        other, and the one trained
        on plain text carries on writing — it answers a question nobody asked. That is the
        pretraining → instruction-tuning story with two real models rather than a diagram.
      </>
    ),
  },
  {
    time: '2–3 hrs',
    label: 'A workshop',
    body: (
      <>
        The full path: <a className={a} href="./explain.html">New to AI</a> →{' '}
        <a className={a} href="./learn.html">How it works</a> →{' '}
        <a className={a} href="./">Playground</a> (everyone trains a model) →{' '}
        <a className={a} href="./harness.html">Tools &amp; agents</a> →{' '}
        <a className={a} href="./lab.html">Lab</a> → <a className={a} href="./capstone.html">Capstone</a>.
        Give the playground and the lab the most time — they are the parts people remember. If the room
        needs the pretraining → instruction-tuning → RLHF sequence, take{' '}
        <a className={a} href="./explain.html?section=instruction">explain §5</a> slowly on the way past:
        it is the one place on the site where two models of the same architecture and near-identical
        size answer the same instruction differently, and the difference is what they were trained on.
      </>
    ),
  },
]

const PAGES = [
  {
    href: './explain.html',
    name: 'New to AI',
    mins: '10 min',
    audience: 'no maths',
    moment: 'Type “strawberry” into the tokenizer demo and count the r’s the model can’t see.',
  },
  {
    href: './learn.html',
    name: 'How it works',
    mins: '15 min',
    audience: 'some maths',
    moment: 'The number line: digits arrange themselves in order inside the model, unprompted.',
  },
  {
    href: './',
    name: 'Playground',
    mins: '5 min +',
    audience: 'hands-on',
    moment: 'Train on the sorting dataset and watch held-out accuracy sit flat, then jump.',
  },
  {
    href: './harness.html',
    name: 'Tools & agents',
    mins: '10 min',
    audience: 'practitioners',
    moment: '§1: untick “use the harness” and watch a fluent answer become a wrong one.',
  },
  {
    href: './lab.html',
    name: 'Lab',
    mins: 'explore',
    audience: 'technical',
    moment: 'Ablate the critical head and watch a learned skill collapse in real time.',
  },
  {
    href: './capstone.html',
    name: 'Capstone',
    mins: '10 min',
    audience: 'everyone',
    moment: 'Turn the legal-move check off and let the agent break the game in two moves.',
  },
]

// Deep links: every long page resolves `?section=<id>`, the lab `?tab=<slug>`. Listed here in
// full because a session leader building a deck needs the actual ids, not the idea of them.
const SECTIONS = [
  {
    page: 'explain.html',
    href: './explain.html',
    key: '?section=',
    ids: 'prediction · randomness · context · hallucination · instruction · tokens · embeddings · rag · cost · inference · governance',
  },
  {
    page: 'harness.html',
    href: './harness.html',
    key: '?section=',
    ids: 'tools · robust · loop · injection · reasoning-loop',
  },
  {
    page: 'capstone.html',
    href: './capstone.html',
    key: '?section=',
    ids: 'play · inside · warehouse · train · concepts · recap',
  },
  {
    page: 'lab.html',
    href: './lab.html',
    key: '?tab=',
    ids: 'one slug per tab — the tab strip on the page names them',
  },
]

// Prefill: the demo opens on YOUR example rather than its default. Same keys on the full
// pages and on the embeds.
const PREFILL = [
  { k: '?prompt=', what: 'the text a completion demo starts on', eg: 'explain.html?section=hallucination&prompt=the contract states that' },
  { k: '?list=', what: 'a three-digit list, for the sorting demos', eg: 'embed.html?demo=lora&list=6 9 2' },
  { k: '?a= &b=', what: "the adder's two numbers", eg: 'harness.html?section=reasoning-loop&a=23498&b=94321' },
  { k: '?word=', what: 'the word the embeddings demo looks up', eg: 'explain.html?section=embeddings&word=paris' },
  { k: '?basket=', what: 'the order the warehouse agent packs', eg: 'capstone.html?section=warehouse&basket=A B C' },
  { k: '?ex=', what: 'the instruction handed to the tool-caller', eg: 'harness.html?section=tools&ex=total of 6 9 2' },
]

/** teachers.html?lesson=<id> — the written lesson for one embeddable demo. */
function LessonPage({ demo }: { demo: Demo }) {
  const l = LESSONS[demo.id]
  useEffect(() => {
    document.title = `Teaching ${demo.id} — JabberLM`
  }, [demo])
  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <SiteNav current="teachers">
        <span className="hidden text-xs text-slate-400 sm:inline">Lesson</span>
      </SiteNav>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <a className={a + ' text-[12px]'} href="./teachers.html#embeds">
          ← all lessons
        </a>
        <h1 className="mt-3 text-2xl font-bold text-slate-100">{demo.title}</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-200">{l.headline}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
          <a
            className="rounded border border-sky-800 bg-sky-950/40 px-2 py-1 text-sky-200 hover:bg-sky-900/50"
            href={`./embed.html?demo=${demo.id}`}
            target="_blank"
            rel="noopener"
          >
            open the demo ↗
          </a>
          <a
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
            href={demo.source.href}
          >
            in context: {demo.source.label}
          </a>
          <span className="rounded border border-slate-800 px-2 py-1 font-mono text-slate-400">
            ?demo={demo.id}
          </span>
        </div>
      </div>

      <Sec>
        <H id="model" n={1}>The model</H>
        <p className="text-slate-300">{l.model}</p>
      </Sec>

      <Sec>
        <H id="tests" n={2}>What this demonstrates</H>
        <p className="text-slate-300">{l.tests}</p>
      </Sec>

      <Sec>
        <H id="walkthrough" n={3}>Walk a class through it</H>
        <ol className="space-y-3">
          {l.steps.map((st, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 shrink-0 font-mono text-xs text-fuchsia-400">{i + 1}</span>
              <span>
                <b className="text-slate-200">{st.do}</b>{' '}
                <span className="text-slate-300">{st.see}</span>
              </span>
            </li>
          ))}
        </ol>
      </Sec>

      {l.mechanism && (
        <Sec>
          <H id="mechanism" n={4}>The mechanism</H>
          <p className="text-slate-300">{l.mechanism}</p>
        </Sec>
      )}

      <Sec>
        <H id="questions" n={l.mechanism ? 5 : 4}>What students ask</H>
        <dl className="space-y-3">
          {l.questions.map((qa, i) => (
            <div key={i}>
              <dt className="font-semibold text-slate-200">{qa.q}</dt>
              <dd className="mt-0.5 text-slate-300">{qa.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[12px] text-slate-400">
          <a className={a} href="./teachers.html#embeds">← all lessons</a> ·{' '}
          <a className={a} href="./guide.html">the long-form guide</a> covers every page of the site.
        </p>
      </Sec>
    </div>
  )
}

export default function TeachersApp() {
  useHashScroll(true)
  const lesson = typeof location !== 'undefined' ? demoOf(new URLSearchParams(location.search).get('lesson')) : undefined
  if (lesson) return <LessonPage demo={lesson} />
  return (
    <div className="min-h-screen font-sans text-sm text-slate-200">
      <SiteNav current="teachers">
        <span className="hidden text-xs text-slate-400 sm:inline">Using JabberLM in a class</span>
      </SiteNav>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-100">For teachers</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-200">
          JabberLM is a real transformer — small enough to train in a browser tab, complete enough that
          every part of it is the same part a frontier model has. This page is for whoever is running the
          session: what to show, in what order, and how to lift any demo out of the site and into your
          own material.
        </p>
        <ul className="mt-4 space-y-1 text-[13px] text-slate-400">
          <li>
            • <b className="text-slate-200">Nothing leaves the machine.</b> Every model runs in the
            visitor's browser. No accounts, no uploads, no API keys, no cost per student.
          </li>
          <li>
            • <b className="text-slate-200">Nothing to install.</b> A modern browser is the whole
            requirement — no GPU, no Python, no lab setup.
          </li>
          <li>
            • <b className="text-slate-200">Free and MIT-licensed.</b> Use it in a class, a course, or a
            conference talk without asking.
          </li>
        </ul>
      </div>

      <Sec>
        <H id="routes" n={1}>Three ways to use it</H>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {ROUTES.map((r) => (
              <tr key={r.label}>
                <td className={td + ' whitespace-nowrap font-mono text-emerald-300'}>{r.time}</td>
                <td className={td + ' whitespace-nowrap font-semibold text-slate-200'}>{r.label}</td>
                <td className={td + ' text-slate-300'}>{r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sec>

      <Sec>
        <H id="pages" n={2}>What each page is for</H>
        <p className="mb-3 text-slate-300">
          Each page stands on its own, so you can take any one of them. The last column is the thing to
          put on the screen if you only have a minute.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>page</th>
                <th className={th}>time</th>
                <th className={th}>for</th>
                <th className={th}>the moment to point at</th>
              </tr>
            </thead>
            <tbody>
              {PAGES.map((p) => (
                <tr key={p.name}>
                  <td className={td}>
                    <a className={a + ' font-semibold'} href={p.href}>{p.name}</a>
                  </td>
                  <td className={td + ' whitespace-nowrap font-mono text-slate-400'}>{p.mins}</td>
                  <td className={td + ' whitespace-nowrap text-slate-400'}>{p.audience}</td>
                  <td className={td + ' text-slate-300'}>{p.moment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-slate-400">
          Two further pages are references rather than teaching stops, so they are not in the table and
          nobody needs to visit them in order.{' '}
          <a className={a} href="./glossary.html">Glossary</a> defines every term the site uses, plainly,
          each entry linking to the demo it comes from — this is the link to put in the chat or on your
          last slide, for whoever loses a word halfway through and stops following. Individual terms are
          addressable, so you can send someone straight to one:{' '}
          <code className="font-mono text-fuchsia-300">glossary.html#logit</code>.{' '}
          <a className={a} href="./series.html">Series</a> is the reading order for the written version —
          26 posts in five parts, each with a link into the demo it describes — and is what to hand
          anyone who asks what to read next. Most posts are still marked planned; the demos they point
          at already work.
        </p>
      </Sec>

      <Sec>
        <H id="embeds" n={3}>Put a demo in your own page</H>
        <p className="text-slate-300">
          Any demo below can be embedded in a course site, an internal wiki, an LMS page or a slide deck
          with one <code className="font-mono text-fuchsia-300">&lt;iframe&gt;</code>. The frame carries
          <b> no navigation, no teaching copy and no footer</b> — just a small JabberLM link and the
          running demo, because your page supplies the words.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 font-mono text-[12px] leading-relaxed text-slate-200">{`<iframe src="https://jabberlm.com/embed?demo=tictactoe"
        width="100%" height="900" style="border:0"
        title="JabberLM — play a tiny transformer at tic-tac-toe"></iframe>`}</pre>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>?demo=</th>
                <th className={th}>what it shows</th>
                <th className={th}>box</th>
                <th className={th}>from</th>
                <th className={th}>lesson</th>
              </tr>
            </thead>
            <tbody>
              {DEMOS.map((d) => (
                <tr key={d.id}>
                  <td className={td + ' whitespace-nowrap'}>
                    <a className={a + ' font-mono'} href={`./embed.html?demo=${d.id}`} target="_blank" rel="noopener">
                      {d.id}
                    </a>
                  </td>
                  <td className={td + ' text-slate-300'}>{d.title}</td>
                  <td className={td + ' whitespace-nowrap font-mono text-slate-400'}>
                    {d.frame ? `${d.frame.w * 20}×${d.frame.h * 20}` : 'fluid'}
                  </td>
                  <td className={td + ' whitespace-nowrap text-slate-400'}>{d.source.label}</td>
                  <td className={td + ' whitespace-nowrap'}>
                    <a className={a} href={`./teachers.html?lesson=${d.id}`}>
                      how to teach →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-slate-400">
          Every demo has a written lesson: what the model is, how it was trained, what the demo tests,
          a step-by-step walkthrough, and the questions students ask. Box sizes are pixels at the default <code className="font-mono">scale=1.25</code>. Every demo but
          tic-tac-toe uses a fixed box so your page cannot reflow mid-demo; if your content
          column is narrower, add <code className="font-mono text-fuchsia-300">&amp;scale=1</code> and it
          shrinks to 80% of those numbers.
        </p>

        <h3 className="mt-5 font-semibold text-slate-200">Two options worth knowing</h3>
        <ul className="mt-2 space-y-2 text-[13px] text-slate-300">
          <li>
            <code className="font-mono text-fuchsia-300">&amp;scale=1.6</code> — enlarges the whole demo,
            layout included, for a projector or a lecture theatre. Anything from 0.75 to 2.5.
          </li>
          <li>
            <b>Auto-height.</b> The frame posts its content height to your page whenever it changes, so
            you can size the iframe instead of guessing. Height only — nothing else crosses the frame:
            <pre className="mt-1 overflow-x-auto rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[12px] text-slate-200">{`addEventListener('message', (e) => {
  if (e.data?.type === 'jabberlm:height')
    document.getElementById('jabber').height = e.data.height + 16
})`}</pre>
          </li>
        </ul>
      </Sec>

      <Sec>
        <H id="links" n={4}>Link straight to the moment</H>
        <p className="text-slate-300">
          The long pages take a <code className="font-mono text-fuchsia-300">?section=</code>, and most
          demos take a parameter that prefills them. Together those mean a link can land on the exact
          example you are about to talk about. This is worth half an hour of preparation: you can build a
          deck in which every link opens the thing you want on screen, rather than typing an example into
          a demo in front of a room and hoping it behaves. It also survives being handed to someone else
          to present.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>page</th>
                <th className={th}>key</th>
                <th className={th}>values</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((s) => (
                <tr key={s.page}>
                  <td className={td + ' whitespace-nowrap'}>
                    <a className={a + ' font-mono'} href={s.href}>{s.page}</a>
                  </td>
                  <td className={td + ' whitespace-nowrap font-mono text-fuchsia-300'}>{s.key}</td>
                  <td className={td + ' font-mono text-[12px] text-slate-400'}>{s.ids}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 font-semibold text-slate-200">Prefilling a demo</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>key</th>
                <th className={th}>what it sets</th>
                <th className={th}>example</th>
              </tr>
            </thead>
            <tbody>
              {PREFILL.map((p) => (
                <tr key={p.k}>
                  <td className={td + ' whitespace-nowrap font-mono text-fuchsia-300'}>{p.k}</td>
                  <td className={td + ' text-slate-300'}>{p.what}</td>
                  <td className={td + ' font-mono text-[12px] text-slate-400'}>{p.eg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-slate-400">
          The same keys work on the embeds, which is where they earn their keep:{' '}
          <code className="font-mono">embed.html?demo=adder&amp;a=23498&amp;b=94321</code> puts one
          specific sum in your own slide, and the same demo with different numbers is the next slide. A
          value a demo cannot use is ignored and it opens on its usual default, so a mistyped link
          degrades to the ordinary page rather than breaking in front of people.
        </p>

        <h3 className="mt-5 font-semibold text-slate-200">Why <code className="font-mono text-fuchsia-300">?section=</code> and not <code className="font-mono">#section</code></h3>
        <p className="mt-2 text-slate-300">
          Both scroll to the same place — the older <code className="font-mono">#hash</code> links still
          resolve — but only one is countable. The site's analytics record the path and the query string,
          so <code className="font-mono text-fuchsia-300">explain.html?section=instruction</code> arrives
          as a visit to that section, while the same link written with a <code className="font-mono">#</code>{' '}
          is indistinguishable from someone landing at the top of the page. If you want to know whether
          the links in your handout were opened — or which of them was — send the{' '}
          <code className="font-mono text-fuchsia-300">?section=</code> form.
        </p>
      </Sec>

      <Sec>
        <H id="stage" n={5}>Running it live</H>
        <ul className="space-y-2 text-slate-300">
          <li>
            <b className="text-slate-200">Open every page once before you start.</b> Each demo fetches its
            model on first load (from ~24 KB to ~1.3 MB). Loading them on the presentation machine
            beforehand puts them in the browser cache, so nothing waits on venue wifi in front of people.
          </li>
          <li>
            <b className="text-slate-200">A page already open keeps working if the connection drops</b> —
            training and inference are local. Only a reload needs the network.
          </li>
          <li>
            <b className="text-slate-200">Scale for the room.</b> The embeds take{' '}
            <code className="font-mono text-fuchsia-300">?scale=</code>; for the full pages, the browser's
            own zoom is the equivalent.
          </li>
          <li>
            <b className="text-slate-200">Live training takes a minute or two</b> — it runs on the main
            thread so the visualisations stay live. Start it, then talk over it; the lab sections stop
            themselves once the model has learned.
          </li>
          <li>
            <b className="text-slate-200">Laptops are better than phones</b> for the lab and the
            playground. The explain page and the tic-tac-toe demo are fine on a phone.
          </li>
          <li>
            <b className="text-slate-200">Keep the glossary in a second tab.</b> Someone always loses a
            term — logit, residual stream, temperature — and then stops following. Paste{' '}
            <a className={a} href="./glossary.html">the glossary</a> into the chat rather than stopping
            the room, and carry on.
          </li>
        </ul>
      </Sec>

      <Sec>
        <H id="honesty" n={6}>“Is this a real one?”</H>
        <p className="text-slate-300">
          Worth answering carefully, because both halves are true. These models are{' '}
          <b>tiny</b> — 24,000 to 130,000 parameters, against hundreds of billions in a frontier model,
          and they read one character at a time rather than word pieces. They cannot hold a conversation
          and they get arithmetic wrong.
        </p>
        <p className="mt-2 text-slate-300">
          But the <b>machinery is the same machinery</b>: the same attention, the same residual stream,
          the same gradient descent, the same next-token objective, the same tool-calling loop. Nothing
          here is a simulation of a transformer — it is a transformer, run at a size you can watch. When
          a demo shows a limit (it hallucinates arithmetic; it can't count letters; it forgets an old
          skill while learning a new one), that limit is real at every scale — it just gets papered over
          by capability higher up.
        </p>
        <p className="mt-2 text-[13px] text-slate-400">
          Each page states its own caveats where they apply. If a claim on this site is measured, the
          number came from a script in the repo, not an estimate.
        </p>
      </Sec>

      <Sec>
        <H id="licence" n={7}>Licence, credit, and getting help</H>
        <p className="text-slate-300">
          MIT-licensed. Embed it, screenshot it, fork it, put it in a paid course — no permission needed.
          A link back to <a className={a} href="https://jabberlm.com">jabberlm.com</a> is appreciated and
          not required.
        </p>
        <p className="mt-2 text-slate-300">
          Found a bug, or want a demo embeddable that isn't in the list yet?{' '}
          <a className={a} href="https://github.com/gregdickason/JabberLM/issues" target="_blank" rel="noopener noreferrer">
            Open an issue
          </a>
          . The whole site — models, training scripts, measurements — is in{' '}
          <a className={a} href="https://github.com/gregdickason/JabberLM" target="_blank" rel="noopener noreferrer">
            the repo
          </a>
          .
        </p>
        <footer className="mt-6 border-t border-slate-800 pt-4 text-[12px] text-slate-400">
          Teaching with it? The <a className={a} href="./guide.html">long-form guide</a> is the written
          version of the whole site, useful as a handout or pre-reading. For the people who want to keep
          going afterwards, send them the <a className={a} href="./series.html">series</a> — the posts in
          reading order, each one landing on a demo they can run.
        </footer>
      </Sec>
    </div>
  )
}
