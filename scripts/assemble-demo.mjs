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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public');

const GAMES = [
  { slug: 'shining-pop', src: 'games/shining-pop/dist' },
  { slug: 'shining-pop-v2', src: 'games/shining-pop-v2/build/web-mobile' },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const g of GAMES) {
  const src = path.join(ROOT, g.src);
  if (!existsSync(src)) throw new Error(`missing build: ${g.src} — build the game first`);
  cpSync(src, path.join(OUT, g.slug), { recursive: true });
  console.log(`✓ ${g.slug}  ←  ${g.src}`);
}

mkdirSync(path.join(OUT, 'media'), { recursive: true });
for (const f of ['pixi-board.png', 'cocos-desktop.png', 'cocos-win.png']) {
  const s = path.join(ROOT, 'docs/media', f);
  if (existsSync(s)) cpSync(s, path.join(OUT, 'media', f));
}

writeFileSync(path.join(OUT, 'index.html'), LANDING());
console.log('✓ index.html  (demo landing)');
console.log(
  `\nDemo assembled → ${OUT}\n  /shining-pop      (PixiJS v8)\n  /shining-pop-v2   (Cocos Creator 3.8.8)`,
);

function LANDING() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Shining Pop — Multi-Engine Slot Studio · ARTEST | BrainRocket</title>
<meta name="description" content="Two production slot games on one provably-correct math core — PixiJS v8 and Cocos Creator 3.8.8. Play the demos." />
<style>
  :root{
    --bg:#0b0617; --bg2:#150a2e; --ink:#fdeffb; --muted:#b79fd6;
    --pink:#ff5a9c; --pinkHot:#ff007f; --gold:#ffc846; --mint:#7ef0c0; --violet:#b95cf0;
    --card:#1a0f38; --line:rgba(255,120,200,.22);
  }
  *{box-sizing:border-box} html,body{margin:0}
  body{
    font:16px/1.5 ui-rounded,"Segoe UI",system-ui,sans-serif; color:var(--ink);
    background:
      radial-gradient(1200px 700px at 20% -10%, #3a1450 0%, transparent 55%),
      radial-gradient(1000px 600px at 100% 0%, #2a0f5a 0%, transparent 50%),
      linear-gradient(180deg,var(--bg),var(--bg2));
    min-height:100vh; -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1040px; margin:0 auto; padding:clamp(28px,6vw,72px) 22px 64px}
  .kicker{letter-spacing:.32em; text-transform:uppercase; font-size:12px; color:var(--muted); font-weight:700}
  h1{
    font-size:clamp(34px,7vw,68px); line-height:1.02; margin:.18em 0 .1em; font-weight:800;
    background:linear-gradient(92deg,var(--pink),var(--gold) 55%,var(--mint));
    -webkit-background-clip:text; background-clip:text; color:transparent;
    text-shadow:0 2px 0 rgba(255,0,127,.12);
  }
  .sub{color:var(--muted); max-width:62ch; font-size:clamp(15px,2.4vw,19px)}
  .sub b{color:var(--ink)}
  .grid{display:grid; gap:22px; grid-template-columns:1fr 1fr; margin:38px 0 8px}
  @media (max-width:740px){.grid{grid-template-columns:1fr}}
  .card{
    position:relative; border:1px solid var(--line); border-radius:22px; overflow:hidden;
    background:linear-gradient(180deg,var(--card),#120a2a); display:flex; flex-direction:column;
    box-shadow:0 18px 50px -24px rgba(255,0,127,.5); transition:transform .18s ease, box-shadow .18s ease;
  }
  .card:hover{transform:translateY(-4px); box-shadow:0 26px 60px -22px rgba(255,0,127,.65)}
  .shot{aspect-ratio:16/10; background:#0d0722 center/cover no-repeat; border-bottom:1px solid var(--line)}
  .card .body{padding:20px 20px 22px}
  .badge{display:inline-block; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
    padding:5px 10px; border-radius:999px; border:1px solid var(--line); color:var(--ink)}
  .b-pixi{background:rgba(255,90,156,.16)} .b-cocos{background:rgba(126,240,192,.14)}
  .card h2{margin:.5em 0 .15em; font-size:24px}
  .meta{color:var(--muted); font-size:14px; margin:0 0 16px}
  .play{
    display:inline-flex; align-items:center; gap:9px; text-decoration:none; font-weight:800;
    color:#1a0220; padding:12px 20px; border-radius:999px;
    background:linear-gradient(92deg,var(--gold),var(--pink)); box-shadow:0 8px 22px -8px var(--pinkHot);
  }
  .play:active{transform:translateY(1px)}
  .note{margin-top:34px; color:var(--muted); font-size:13.5px; border-top:1px solid var(--line); padding-top:20px}
  .foot{margin-top:14px; color:var(--muted); font-size:13px}
  a.q{color:var(--mint); text-decoration:none} a.q:hover{text-decoration:underline}
</style>
</head>
<body>
  <main class="wrap">
    <div class="kicker">ARTEST · BrainRocket</div>
    <h1>Shining Pop</h1>
    <p class="sub">A <b>multi-engine slot studio</b> — the same provably-correct, sim-anchored
      math core rendered through <b>two</b> independent front ends. Built end-to-end by a single
      developer. Tap a game to play the live demo.</p>

    <section class="grid">
      <article class="card">
        <div class="shot" style="background-image:url(media/pixi-board.png)"></div>
        <div class="body">
          <span class="badge b-pixi">PixiJS v8 · flagship</span>
          <h2>shining-pop</h2>
          <p class="meta">Vite · GSAP · Spine · Web Audio · ~97% RTP · 10 lines · WILD STRIKE</p>
          <a class="play" href="shining-pop/">▶ Play demo</a>
        </div>
      </article>
      <article class="card">
        <div class="shot" style="background-image:url(media/cocos-desktop.png)"></div>
        <div class="body">
          <span class="badge b-cocos">Cocos Creator 3.8.8</span>
          <h2>shining-pop-v2</h2>
          <p class="meta">Code-driven MVC · CCEffect shaders · Spine · ~97.5% RTP · candy VFX suite</p>
          <a class="play" href="shining-pop-v2/">▶ Play demo</a>
        </div>
      </article>
    </section>

    <p class="note">Demos run fully client-side — no install, no account. Best on a modern desktop or
      mobile browser with WebGL. Source &amp; engineering notes:
      <a class="q" href="https://github.com/EdgarHovsepyan/artest-brainrocket-task">github.com/EdgarHovsepyan/artest-brainrocket-task</a>.</p>
    <p class="foot">© Edgar Hovsepyan — one engineer, two engines, one math core.</p>
  </main>
</body>
</html>
`;
}
