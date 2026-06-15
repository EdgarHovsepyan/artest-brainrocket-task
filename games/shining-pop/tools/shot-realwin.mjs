// Brute-force a REAL win celebration: drive live spins in turbo, poll the live
// winFx state via the ?debug __dbg hook, and burst-capture the frames of the
// first few ceremonies that actually fire (cold-calling celebrate() won't render
// — the overlay is driven off live win state). This verifies the crown-jewel
// cinematic the way a player actually sees it.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(process.cwd(), 'games/shining-pop/dist');
const OUT = join(process.cwd(), 'tmp/real');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.atlas': 'text/plain', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const p = join(ROOT, normalize(url === '/' ? '/index.html' : url));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }).end(await readFile(p));
  } catch { res.writeHead(404).end('nf'); }
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(OUT, { recursive: true });
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/?debug=true`, { waitUntil: 'load' });
await wait(3500);
await page.mouse.click(220, 720);
await wait(2500);

// Bump bet to the max so even a modest line-multiple clears the BIG ceremony
// floor sooner (more frequent celebrations to verify), then turbo on.
await page.evaluate(() => { try { window.__dbg.bmtSnapTo && window.__dbg.bmtSnapTo(999); } catch (e) {} });
let captured = 0, spins = 0;
const seen = [];
while (captured < 3 && spins < 80) {
  const phase = await page.evaluate(() => (window.__dbg && window.__dbg.State && String(window.__dbg.State.phase)) || '?');
  if (phase === 'IDLE' || phase === '0') { await page.keyboard.press('Space'); spins++; }
  await wait(120);
  const st = await page.evaluate(() => {
    const d = window.__dbg; if (!d) return null;
    return { on: !!(d.winFx && d.winFx.on), tier: (d.winFx && d.winFx.tier) || 0, phase: String(d.State && d.State.phase) };
  });
  if (st && st.on && st.tier >= 2 && !seen.includes(spins)) {
    seen.push(spins);
    // Long window (~6s) + poll the centered ceremony overlay alpha so we can tell
    // whether the BIG WIN celebration actually fires after the line-win reveal.
    for (let f = 0; f < 28; f++) {
      const ov = await page.evaluate(() => {
        const d = window.__dbg;
        return {
          disp: d && d.winDisplay ? +(d.winDisplay.alpha || 0).toFixed(2) : -1,
          fx: !!(d && d.winFx && d.winFx.on),
          phase: String(d && d.State && d.State.phase),
        };
      });
      await writeFile(join(OUT, `win${captured}-t${st.tier}-f${String(f).padStart(2, '0')}.png`), await page.screenshot());
      if (f % 4 === 0) console.log(`  f${f} winDisplay.alpha=${ov.disp} fxOn=${ov.fx} phase=${ov.phase}`);
      await wait(220);
    }
    captured++;
    console.log(`captured ceremony ${captured} tier=${st.tier} at spin ${spins}`);
    await wait(800);
  }
}
await browser.close();
server.close();
console.log('done. spins=', spins, 'captured=', captured, '→', OUT);
