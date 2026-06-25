/**
 * Assemble the public demo for Vercel (or any static host).
 *
 *   node scripts/assemble-demo.mjs   →   ./public/
 *     ├── index.html        the demo landing (links both games)
 *     ├── shining-pop/      the PixiJS v8 build (games/shining-pop/dist)
 *     ├── shining-pop-v2/   the Cocos Creator build (games/shining-pop-v2/build/web-mobile)
 *     └── media/            screenshots for the landing
 *
 * Both games are committed static builds, so this only COPIES — no toolchain.
 * Each game keeps its own directory root, so its relative asset paths resolve
 * (a URL rewrite would break the Cocos multi-file build). Node >= 18.
 */
import { cpSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ROOT (where the games live) is resolved from THIS file, so the sources are found
// no matter what working directory invokes the script. The OUTPUT, however, is
// written relative to the CURRENT working directory so Vercel finds `public/`
// regardless of whether its Root Directory is the repo root or a subfolder (the
// "Cannot find module …/games/shining-pop/scripts/assemble-demo.mjs" deploy bug).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(process.cwd(), 'public');

const GAMES = [
  { slug: 'shining-pop', src: 'games/shining-pop/dist' },
  { slug: 'shining-pop-v2', src: 'games/shining-pop-v2/build/web-mobile' },
  { slug: 'shining-pop-v3', src: 'games/shining-pop-v3/build/web-mobile' },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const copied = [];
for (const g of GAMES) {
  const src = path.join(ROOT, g.src);
  // Skip a game whose static build isn't committed yet (e.g. a work-in-progress
  // game) rather than failing the whole demo build — the ready games still ship.
  // The game is picked up automatically as soon as its build/ lands in the repo.
  if (!existsSync(src)) {
    console.warn(`⚠ skip ${g.slug} — no committed build at ${g.src}`);
    continue;
  }
  cpSync(src, path.join(OUT, g.slug), { recursive: true });
  copied.push(g.slug);
  console.log(`✓ ${g.slug}  ←  ${g.src}`);
}

mkdirSync(path.join(OUT, 'media'), { recursive: true });
for (const f of ['pixi-board.png', 'cocos-desktop.png', 'pixi-desktop.png']) {
  const s = path.join(ROOT, 'docs/media', f);
  if (existsSync(s)) cpSync(s, path.join(OUT, 'media', f));
}

writeFileSync(path.join(OUT, 'index.html'), LANDING());
console.log('✓ index.html  (demo landing)');
console.log(`\nDemo assembled → ${OUT}`);
for (const slug of copied) console.log(`  /${slug}`);

function LANDING() {
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Shining Pop — two slot games, one math core · ARTEST | BrainRocket</title>
<meta name="description" content="Two production slot games on one provably-correct math core — PixiJS v8 and Cocos Creator 3.8.8. Play both demos in the browser." />
<meta name="theme-color" content="#0a0613" />
<script>document.documentElement.className='js';</script>
<style>
  :root{
    --bg:#0a0613; --bg2:#160a30;
    --ink:#fdeefb; --soft:#d9c2f1; --muted:#b49bd6;
    --pink:#ff5fa1; --pink-deep:#e0247f; --gold:#ffce5e; --mint:#7ef0c0; --sky:#92cdff;
    --surface:#180e36; --surface-2:#120925; --line:rgba(255,150,215,.16); --line-2:rgba(255,150,215,.30);
    --shadow:48px 60px 120px -50px rgba(0,0,0,.85);
    --z-glints:0; --z-content:2;
  }
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0}
  html{-webkit-text-size-adjust:100%}
  body{
    font:400 16px/1.55 ui-rounded,"Segoe UI",system-ui,-apple-system,sans-serif;
    color:var(--ink); background:var(--bg); min-height:100svh; overflow-x:hidden;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  }
  /* Ambient candy field — soft radial blooms, never stripes. */
  .bg{position:fixed; inset:0; z-index:-1; pointer-events:none;
    background:
      radial-gradient(60rem 40rem at 16% -8%, #3a1556 0%, transparent 60%),
      radial-gradient(52rem 38rem at 102% 4%, #2a1066 0%, transparent 55%),
      radial-gradient(40rem 40rem at 50% 116%, #4a1a5e 0%, transparent 58%),
      linear-gradient(180deg, var(--bg), var(--bg2) 70%, var(--bg));
  }
  .glint{position:fixed; border-radius:50%; filter:blur(14px); opacity:.5; z-index:var(--z-glints); pointer-events:none; will-change:transform}

  .wrap{position:relative; z-index:var(--z-content); max-width:1060px; margin:0 auto;
    padding:clamp(30px,7vh,84px) 24px clamp(40px,8vh,80px); min-height:100svh;
    display:flex; flex-direction:column; justify-content:center}

  .kicker{display:inline-flex; align-items:center; gap:9px; align-self:flex-start;
    font-size:12.5px; font-weight:700; letter-spacing:.02em; color:var(--soft);
    padding:7px 13px; border:1px solid var(--line); border-radius:999px; background:rgba(255,255,255,.03)}
  .kicker .dot{width:7px; height:7px; border-radius:50%; background:var(--mint); box-shadow:0 0 12px var(--mint)}

  h1{margin:.34em 0 0; font-weight:800; letter-spacing:-0.035em; line-height:.98;
    font-size:clamp(2.9rem,9vw,5.6rem); text-wrap:balance}
  h1 .a{color:var(--pink)} h1 .b{color:var(--gold)}
  h1 .b::after{content:"."; color:var(--mint)}

  .lede{margin:1.05rem 0 0; max-width:54ch; font-size:clamp(1.02rem,2.3vw,1.28rem);
    line-height:1.5; color:var(--soft); text-wrap:pretty}
  .lede strong{color:var(--ink); font-weight:600}

  .facts{display:flex; flex-wrap:wrap; gap:8px 10px; margin:1.4rem 0 0}
  .fact{font-size:13px; color:var(--soft); padding:6px 12px; border:1px solid var(--line);
    border-radius:999px; background:rgba(255,255,255,.025)}
  .fact b{color:var(--ink); font-weight:650}

  .grid{display:grid; gap:20px; grid-template-columns:1fr 1fr; margin:clamp(30px,5vh,46px) 0 0}
  @media (max-width:720px){.grid{grid-template-columns:1fr}}

  .card{position:relative; display:flex; flex-direction:column; overflow:hidden;
    border:1px solid var(--line); border-radius:16px; background:linear-gradient(180deg,var(--surface),var(--surface-2));
    text-decoration:none; color:inherit; transition:transform .5s cubic-bezier(.16,1,.3,1), border-color .4s ease, box-shadow .5s ease}
  .card:hover,.card:focus-visible{transform:translateY(-6px); border-color:var(--line-2);
    box-shadow:var(--shadow); outline:none}
  .card:focus-visible{box-shadow:var(--shadow), 0 0 0 3px var(--pink)}
  .shot{aspect-ratio:16/10; background:#0d0722 center/cover no-repeat; overflow:hidden}
  .shot::after{content:""; position:absolute; inset:0 0 auto; height:54%;
    background:linear-gradient(180deg, rgba(10,6,19,.0), rgba(10,6,19,.0))}
  .card .body{padding:18px 20px 20px; display:flex; flex-direction:column; gap:6px}
  .badge{align-self:flex-start; font-size:11px; font-weight:750; letter-spacing:.04em;
    text-transform:uppercase; padding:5px 10px; border-radius:8px; color:var(--ink); border:1px solid var(--line)}
  .badge.px{background:rgba(255,95,161,.15); border-color:rgba(255,95,161,.32)}
  .badge.cc{background:rgba(126,240,192,.13); border-color:rgba(126,240,192,.3)}
  .card h2{margin:.5rem 0 .05rem; font-size:1.45rem; font-weight:750; letter-spacing:-0.01em}
  .meta{margin:0; font-size:13.5px; color:var(--soft); line-height:1.45}
  .play{margin-top:14px; align-self:flex-start; display:inline-flex; align-items:center; gap:9px;
    font-weight:750; font-size:15px; color:#22030f; padding:11px 19px; border-radius:999px;
    background:linear-gradient(96deg,var(--gold),var(--pink)); border:0;
    transition:transform .18s cubic-bezier(.16,1,.3,1), filter .2s ease}
  .card:hover .play{filter:brightness(1.06)}
  .play .tri{font-size:12px}

  footer{margin:clamp(28px,5vh,44px) 0 0; padding-top:18px; border-top:1px solid var(--line);
    display:flex; flex-wrap:wrap; gap:6px 16px; justify-content:space-between; align-items:center;
    font-size:13px; color:var(--muted)}
  footer a{color:var(--mint); text-decoration:none; font-weight:600}
  footer a:hover{text-decoration:underline}

  /* Reveal: hidden ONLY when JS runs, so no-JS / headless still ships content visible. */
  .js [data-reveal]{opacity:0}
  @media (prefers-reduced-motion:reduce){
    .js [data-reveal]{opacity:1 !important; transform:none !important}
    .card{transition:none} .glint{display:none}
  }
</style>
</head>
<body>
  <div class="bg" aria-hidden="true"></div>

  <main class="wrap">
    <span class="kicker" data-reveal><span class="dot"></span>ARTEST · BrainRocket</span>

    <h1 data-reveal><span class="a">Shining</span> <span class="b">Pop</span></h1>

    <p class="lede" data-reveal>Two production slot games running on <strong>one provably-correct,
      sim-anchored math core</strong>. The same engine, rendered through two independent front
      ends and built end to end by a single developer. Pick one and play.</p>

    <div class="facts" data-reveal>
      <span class="fact"><b>2</b> engines</span>
      <span class="fact"><b>~97%</b> RTP, sim-anchored</span>
      <span class="fact"><b>1</b> shared math core</span>
      <span class="fact">browser, <b>no install</b></span>
    </div>

    <section class="grid">
      <a class="card" data-reveal data-card href="shining-pop/">
        <div class="shot" style="background-image:url(media/pixi-board.png)"></div>
        <div class="body">
          <span class="badge px">PixiJS v8 · flagship</span>
          <h2>shining-pop</h2>
          <p class="meta">Vite single-file build · GSAP · Spine · Web Audio. 10 lines, WILD STRIKE.</p>
          <span class="play"><span class="tri">▶</span> Play this game</span>
        </div>
      </a>

      <a class="card" data-reveal data-card href="shining-pop-v2/">
        <div class="shot" style="background-image:url(media/cocos-desktop.png)"></div>
        <div class="body">
          <span class="badge cc">Cocos Creator 3.8.8</span>
          <h2>shining-pop-v2</h2>
          <p class="meta">Code-driven MVC · CCEffect shaders · Spine · candy VFX, on-symbol wins.</p>
          <span class="play"><span class="tri">▶</span> Play this game</span>
        </div>
      </a>
    </section>

    <footer data-reveal>
      <span>© Edgar Hovsepyan — one engineer, two engines, one math core.</span>
      <a href="https://github.com/EdgarHovsepyan/artest-brainrocket-task">Source on GitHub</a>
    </footer>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
  <script>
  (function(){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!window.gsap || reduce) {
      // No GSAP or reduced motion: ensure everything is simply visible.
      document.querySelectorAll('[data-reveal]').forEach(function(el){ el.style.opacity=1; });
      return;
    }
    var g = window.gsap;
    // Clear the CSS hide FIRST so every from-tween captures opacity:1 as its END
    // (a from-tween reads the element's current value as the target; if CSS still
    // says 0 at build time, it animates 0->0 and the element never appears).
    g.set('[data-reveal]', { opacity:1 });
    // Entrance — staggered reveal, exponential ease-out, no bounce.
    var tl = g.timeline({ defaults:{ ease:'expo.out' } });
    tl.from('.kicker', { y:14, opacity:0, duration:.7 })
      .from('h1 .a',   { y:24, opacity:0, duration:.9 }, '-=.45')
      .from('h1 .b',   { y:24, opacity:0, duration:.9 }, '-=.78')
      .from('.lede',   { y:18, opacity:0, duration:.8 }, '-=.55')
      .from('.fact',   { y:12, opacity:0, duration:.6, stagger:.07 }, '-=.5')
      .from('[data-card]', { y:34, opacity:0, scale:.97, duration:.85, stagger:.12 }, '-=.4')
      .from('footer',  { y:10, opacity:0, duration:.55 }, '-=.25');

    // Ambient candy glints — soft drifting blooms behind the content.
    var palette = ['#ff5fa1','#ffce5e','#7ef0c0','#92cdff','#ff5fa1','#ffce5e'];
    var W = window.innerWidth, H = window.innerHeight;
    for (var i=0;i<6;i++){
      var el = document.createElement('span');
      el.className='glint';
      var s = 90 + Math.random()*150;
      el.style.width=el.style.height=s+'px';
      el.style.background=palette[i];
      el.style.left=(Math.random()*100)+'vw';
      el.style.top=(Math.random()*100)+'vh';
      document.body.appendChild(el);
      g.to(el, {
        x:'+='+((Math.random()-.5)*220), y:'+='+((Math.random()-.5)*180),
        duration:9+Math.random()*8, ease:'sine.inOut', repeat:-1, yoyo:true
      });
      g.to(el, { opacity:.18+Math.random()*.35, duration:5+Math.random()*5, ease:'sine.inOut', repeat:-1, yoyo:true });
    }
  })();
  </script>
</body>
</html>
`;
}
