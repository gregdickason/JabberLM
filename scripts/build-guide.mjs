// Build-time renderer: GUIDE.md -> public/guide.html (a real static page).
//
// Serving the guide as its own page (instead of a runtime blob) means opening it
// is a normal pageview — so free, privacy-friendly pageview analytics (e.g.
// Cloudflare Web Analytics) counts "guide opens" with no custom events. It also
// keeps `marked` out of the client bundle and makes the guide shareable/SEO-able.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { marked } from 'marked'

const STYLE = `
  :root { color-scheme: dark; }
  body {
    margin: 0; background: #0b0f17; color: #e6edf3;
    font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  main { max-width: 820px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { color: #7dd3fc; font-size: 28px; margin: 0 0 4px; }
  h2 { color: #7dd3fc; font-size: 21px; margin: 36px 0 10px; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
  h3 { color: #a5b4fc; font-size: 17px; margin: 26px 0 8px; }
  a { color: #38bdf8; }
  code { background: #1e293b; padding: 1px 5px; border-radius: 4px; font-size: 0.9em;
         font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { background: #111827; padding: 12px 14px; border-radius: 8px; overflow-x: auto; border: 1px solid #1e293b; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 14px 0; padding: 8px 14px; border-left: 3px solid #f59e0b;
               background: #14110a; color: #cbd5e1; border-radius: 0 6px 6px 0; }
  ul, ol { padding-left: 24px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #1e293b; margin: 32px 0; }
  table { border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #1e293b; padding: 6px 10px; text-align: left; }
  th { background: #111827; }
  strong { color: #f1f5f9; }
  .home { display: inline-block; margin-bottom: 12px; color: #38bdf8; }
`

const md = readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8')
const body = marked.parse(md)

const doc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>JabberLM — Hands-On Guide</title>
  <style>${STYLE}</style>
</head>
<body>
  <main>
    <a class="home" href="./">← back to JabberLM</a>
    ${body}
  </main>
</body>
</html>
`

const outDir = new URL('../public/', import.meta.url)
mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('guide.html', outDir), doc)
console.log('[build-guide] wrote public/guide.html')
