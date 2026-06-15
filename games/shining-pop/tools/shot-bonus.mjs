// Capture the bonus cinematic surfaces directly via the ?debug __dbg hook:
// the feature-unlock banner (self-renders) and the buy-bonus modal. These are
// the highest-"wow" surfaces and are deterministically triggerable, so we can
// actually verify them rather than wait for a rare live trigger.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(process.cwd(), 'games/shining-pop/dist');
const OUT = join(process.cwd(), 'tmp/bonus');
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

async function session(label, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://127.0.0.1:${port}/?debug=true`, { waitUntil: 'load' });
  await wait(3500);
  await page.mouse.click(w / 2, h * 0.8);
  await wait(2500);

  // 1) Buy-bonus modal (a key UX surface).
  const buy = await page.evaluate(() => { try { window.__dbg.showBuyBonusModal(); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
  await wait(700);
  await writeFile(join(OUT, `${label}-buymodal.png`), await page.screenshot());
  await page.evaluate(() => { try { window.__dbg.hideBuyBonusModal(); } catch (e) {} });
  await wait(400);

  // 2) Feature-unlock banner (the "wow" beat) — capture its timeline.
  const fb = await page.evaluate(() => { try { window.__dbg.showFeatureBanner('STICKY WILDS · FREE SPINS', 2600, 'bonus_mega'); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
  for (let f = 0; f < 14; f++) { await writeFile(join(OUT, `${label}-banner-f${String(f).padStart(2, '0')}.png`), await page.screenshot()); await wait(150); }
  console.log(label, 'buy=', buy, 'banner=', fb);
  await page.close();
}

await session('port', 440, 900);
await session('land', 1280, 720);
await browser.close();
server.close();
console.log('done →', OUT);
