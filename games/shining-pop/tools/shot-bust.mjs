// Verify-the-built-thing capture (slot-game-polish §2). Serves the committed
// Pixi dist over http (canvas needs http, not file://), drives via keyboard
// (letterbox-proof), and screenshots portrait + landscape + a spin burst so we
// can inspect the REAL build for visual anomalies before tuning anything.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(process.cwd(), 'games/shining-pop/dist');
const OUT = join(process.cwd(), '/tmp/bust');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.atlas': 'text/plain',
  '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const p = join(ROOT, normalize(url === '/' ? '/index.html' : url));
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});

async function capture(label, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(base, { waitUntil: 'load' });
  await wait(3500);
  // Pixi splash: tap low-centre to start.
  await page.mouse.click(w / 2, h * 0.8);
  await wait(2500);
  await page.screenshot({ path: join(OUT, `${label}-idle.png`) });

  // Drive a few spins and burst-screenshot to catch a win frame.
  for (let s = 0; s < 4; s++) {
    await page.keyboard.press('Space');
    for (let f = 0; f < 6; f++) {
      await wait(240);
      await page.screenshot({ path: join(OUT, `${label}-spin${s}-f${f}.png`) });
    }
  }
  await page.close();
}

import { mkdir } from 'node:fs/promises';
await mkdir(OUT, { recursive: true });
await capture('portrait', 420, 860);
await capture('landscape', 1280, 720);

await browser.close();
server.close();
console.log('done →', OUT);
