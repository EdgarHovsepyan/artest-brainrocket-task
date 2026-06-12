// SHINING POP reskin — FREE image generator (Pollinations / Flux, no API key).
// Fallback for when Google Gemini image gen is billing-blocked (free tier = limit:0).
// Lower-tier than Nano Banana Pro but produces real art at zero cost.
// Usage:  W=1024 H=1024 SEED=7 node scripts/free-gen.mjs <outPath> "<prompt>"
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , out, ...rest] = process.argv;
const prompt = rest.join(' ');
if (!out || !prompt) { console.error('usage: W=1024 H=1024 SEED=7 node scripts/free-gen.mjs <out> "<prompt>"'); process.exit(2); }
const W = +(process.env.W || 1024), H = +(process.env.H || 1024), seed = +(process.env.SEED || 42);
const model = process.env.MODEL || 'flux';
const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${W}&height=${H}&model=${model}&nologo=true&seed=${seed}&private=true`;

const ctrl = new AbortController();
const to = setTimeout(() => ctrl.abort(), 150000);
try {
  const res = await fetch(url, { signal: ctrl.signal });
  clearTimeout(to);
  if (!res.ok) { console.error(`HTTP ${res.status} ${res.statusText}`); process.exit(1); }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) { console.error(`suspiciously small (${buf.length}b) — likely an error page`); process.exit(1); }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  console.log(`OK [${model} ${W}x${H} seed${seed}] -> ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
} catch (e) { console.error('error:', e.message); process.exit(1); }
