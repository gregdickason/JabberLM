// Generates a 1920×1080 social/article cover showing how a word is really tokenised.
//
//   npm run gen:cover                       -> covers/tokens-strawberry.png (the post-2 cover)
//   npm run gen:cover -- --word Jabberwocky --guess "" --out covers/tokens-jabberwocky.png
//
// Why a canvas and not a screenshot: LinkedIn article covers want 1920×1080, and cropping a
// page screenshot to 16:9 either loses the demo or shrinks the type past readability at
// thumbnail size. Drawing to a canvas at the real pixel size makes the output dimensions
// independent of whatever display this runs on.
//
// Why a browser at all: text rasterisation. Node has no canvas, and adding one (node-canvas,
// puppeteer) is a heavy dependency for one image. So this starts a throwaway local server,
// opens the page, lets Chrome draw and POST the PNG back, writes it, and exits. Plain node —
// NOT vite-node — like scripts/gen-stats.mjs.
//
// The splits are never typed by hand. They are read from public/bpe-examples.json (real
// OpenAI tiktoken cl100k_base output), and an unknown word is a hard error rather than a
// guess — same rule as every other number on this site.
//
// Scope, honestly: this makes TOKEN-SPLIT cards. It is not a general post-cover template.

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { dirname } from 'node:path'

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

const WORD = arg('word', 'strawberry')
const HIGHLIGHT = arg('highlight', 'r').slice(0, 1).toLowerCase()
const OUT = arg('out', `covers/tokens-${WORD.toLowerCase()}.png`)
const EYEBROW = arg('eyebrow', `HOW "${WORD}" REACHES THE MODEL`)
const SUB = arg('sub', 'The model never saw the letters — so it cannot count them.')

// ---- the real splits, from the shipped tiktoken output ----------------------
const bpe = JSON.parse(readFileSync(new URL('../public/bpe-examples.json', import.meta.url)))
const ACTUAL = bpe.examples[WORD]
if (!ACTUAL) {
  console.error(
    `[gen-cover] "${WORD}" is not in public/bpe-examples.json, so its split is unknown.\n` +
      `            Add it there (from real tiktoken output) rather than guessing.\n` +
      `            Available: ${Object.keys(bpe.examples).join(', ')}`,
  )
  process.exit(1)
}

// The dim "what you would guess" row. Defaults to the morpheme split where the word has an
// obvious one; pass --guess "" to drop the row entirely, or --guess "a,b" to set it.
const GUESS_DEFAULTS = { strawberry: 'straw,berry', cheeseburger: 'cheese,burger', lighthouse: 'light,house' }
const guessArg = arg('guess', GUESS_DEFAULTS[WORD] ?? '')
const GUESS = guessArg ? guessArg.split(',').filter(Boolean) : []

// Headline: count the highlighted letter and the chunks it is scattered across — both derived,
// so the claim on the image cannot drift from the split above it.
const hits = ACTUAL.filter((t) => t.toLowerCase().includes(HIGHLIGHT)).length
const total = [...WORD.toLowerCase()].filter((c) => c === HIGHLIGHT).length
const NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
const headline =
  arg('headline', null) ??
  (total && hits
    ? `${NUM[total] ?? total} ${HIGHLIGHT}'s. ${NUM[hits] ?? hits} token${hits === 1 ? '' : 's'}.` +
      (GUESS.length ? ` No "${GUESS[0]}".` : '')
    : `${ACTUAL.length} tokens, not ${GUESS.length || 1}.`)

console.log(`[gen-cover] ${WORD} -> ${ACTUAL.join(' / ')}  (${bpe.encoding}, ${bpe.model})`)

const page = `<meta charset="utf-8">
<style>html,body{margin:0;background:#0b0f17;color:#e6edf3;font:14px ui-monospace,Menlo,monospace}
canvas{display:block;width:900px;margin:10px auto}#s{text-align:center;padding:10px}</style>
<div id="s">rendering…</div><canvas id="c" width="1920" height="1080"></canvas>
<script>
const DATA = ${JSON.stringify({ word: WORD, actual: ACTUAL, guess: GUESS, highlight: HIGHLIGHT, eyebrow: EYEBROW, headline, sub: SUB, enc: bpe.encoding })};
const C=document.getElementById('c'),x=C.getContext('2d');
const MONO='ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const SKY='#7dd3fc',FUCH='#e879f9',S4='#94a3b8',S5='#64748b',S6='#475569',
      INK='#e6edf3',BORDER='#1e293b',CHIP='#111827',CHIPB='#334155',DIMB='#1f2937';
function rr(X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);
  x.arcTo(X+W,Y,X+W,Y+H,r);x.arcTo(X+W,Y+H,X,Y+H,r);
  x.arcTo(X,Y+H,X,Y,r);x.arcTo(X,Y,X+W,Y,r);x.closePath();}
const wOf=(s,f)=>{x.font=f;return x.measureText(s).width;};
function runs(str,X,Y,font,base,hi,hiChar){x.font=font;x.textBaseline='alphabetic';let cx=X;
  for(const ch of str){x.fillStyle=(hiChar&&ch.toLowerCase()===hiChar)?hi:base;
    x.fillText(ch,cx,Y);cx+=x.measureText(ch).width;}}
// a centred row of token chips, sized to the longest row so both rows share a rhythm
function chipRow(toks,cy,size,o){
  const f='700 '+size+'px '+MONO,padX=size*0.36,h=size*1.62,gap=size*0.26;
  const ws=toks.map(t=>wOf(t,f)+padX*2);
  let cx=(1920-(ws.reduce((a,b)=>a+b,0)+gap*(toks.length-1)))/2;
  toks.forEach((t,i)=>{
    x.fillStyle=o.fill;rr(cx,cy,ws[i],h,14);x.fill();
    x.strokeStyle=o.border;x.lineWidth=3;rr(cx,cy,ws[i],h,14);x.stroke();
    runs(t,cx+padX,cy+h*0.69,f,o.text,o.hi,o.hiChar);cx+=ws[i]+gap;});
  return h;}
function centred(s,y,font,fill){x.font=font;x.fillStyle=fill;
  x.fillText(s,(1920-x.measureText(s).width)/2,y);}
const spaced=s=>[...s].join(' ');

async function draw(){
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  x.fillStyle='#0b0f17';x.fillRect(0,0,1920,1080);x.textBaseline='alphabetic';

  x.fillStyle=SKY;x.font='700 38px '+MONO;x.fillText('JabberLM',104,88);
  x.fillStyle=S5;x.font='400 25px '+MONO;
  x.fillText('a transformer small enough to see through',104+wOf('JabberLM','700 38px '+MONO)+26,88);
  x.fillStyle=BORDER;x.fillRect(104,118,1712,2);

  centred(spaced(DATA.eyebrow),196,'600 24px '+MONO,S5);

  // With a guess row the actual row sits lower and smaller; without one it gets the space.
  if(DATA.guess.length){
    centred('what you would guess',276,'400 30px '+MONO,S6);
    chipRow(DATA.guess,302,74,{fill:'#0d1219',border:DIMB,text:S6,hi:S6,hiChar:null});
    centred('what GPT-4 actually does',520,'400 30px '+MONO,S4);
    chipRow(DATA.actual,548,112,{fill:CHIP,border:CHIPB,text:INK,hi:FUCH,hiChar:DATA.highlight});
  }else{
    centred('what GPT-4 actually does',410,'400 32px '+MONO,S4);
    const size=Math.min(136,Math.floor(1500/Math.max(6,DATA.actual.join('').length+DATA.actual.length*0.8)));
    chipRow(DATA.actual,450,size,{fill:CHIP,border:CHIPB,text:INK,hi:FUCH,hiChar:DATA.highlight});
  }

  // headline, with the highlighted letter tinted wherever it appears
  const f1='700 60px '+MONO;
  let tw=wOf(DATA.headline,f1),px=(1920-tw)/2;
  runs(DATA.headline,px,838,f1,INK,FUCH,DATA.highlight);
  centred(DATA.sub,900,'400 42px '+MONO,S4);

  x.fillStyle=BORDER;x.fillRect(104,968,1712,2);
  x.fillStyle=SKY;x.font='600 31px '+MONO;x.fillText('jabberlm.com',104,1026);
  x.fillStyle=S5;x.font='400 27px '+MONO;
  const rt='real GPT-4 splits · '+DATA.enc;
  x.fillText(rt,1816-wOf(rt,'400 27px '+MONO),1026);

  const b64=C.toDataURL('image/png').split(',')[1];
  const r=await fetch('/save',{method:'POST',body:b64});
  document.getElementById('s').textContent=await r.text();
}
draw();
</script>`

// ---- serve, draw, write, exit ----------------------------------------------
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let b = ''
    req.on('data', (d) => (b += d))
    req.on('end', () => {
      const buf = Buffer.from(b, 'base64')
      mkdirSync(dirname(OUT), { recursive: true })
      writeFileSync(OUT, buf)
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20)
      res.end(`saved ${OUT} (${w}×${h})`)
      console.log(`[gen-cover] wrote ${OUT} — ${w}×${h}, ${Math.round(buf.length / 1024)} KB`)
      console.log('[gen-cover] you can close the browser tab.')
      server.close(() => process.exit(0))
    })
    return
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(page)
})

server.listen(0, () => {
  const url = `http://localhost:${server.address().port}/`
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  execFile(opener, [url], (err) => {
    if (err) console.log(`[gen-cover] could not open a browser — visit ${url} yourself.`)
  })
  console.log(`[gen-cover] rendering at ${url} …`)
})

// Don't hang forever if the browser never arrives.
setTimeout(() => {
  console.error('[gen-cover] timed out after 60s with no render. Is a browser available?')
  process.exit(1)
}, 60_000).unref?.()
