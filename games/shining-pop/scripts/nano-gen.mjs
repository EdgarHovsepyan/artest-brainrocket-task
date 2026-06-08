// SHINING POP reskin — image generator via Google Gemini image models
// (Nano Banana Pro / gemini-3-pro-image). Reads keys from the secrets.env,
// rotates across them on quota (429/403), extracts the inline image and
// writes a PNG. Usage:
//   ASPECT=1:1 node scripts/nano-gen.mjs <model> <outPath> "<prompt>"
// Math/RTP untouched — this only produces art files for the reskin.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SECRETS = 'C:\\Users\\edgar\\dev\\config\\pascal-tooling\\secrets.env';

function loadKeys() {
  const txt = readFileSync(SECRETS, 'utf8');
  const keys = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^NANO_KEY_\d+\s*=\s*(.+)$/);
    if (m) keys.push(m[1].trim());
  }
  if (!keys.length) throw new Error('no NANO_KEY_* in secrets.env');
  return keys;
}

const [, , model, out, ...rest] = process.argv;
const prompt = rest.join(' ');
const aspect = process.env.ASPECT || '1:1';
if (!model || !out || !prompt) {
  console.error('usage: ASPECT=1:1 node scripts/nano-gen.mjs <model> <outPath> "<prompt>"');
  process.exit(2);
}

const body = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
};

async function gen() {
  const keys = loadKeys();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'x-goog-api-key': k, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
    } catch (e) {
      console.error(`key${i + 1} network error: ${e.message}`);
      continue;
    }
    const txt = await res.text();
    if (res.status === 429 || res.status === 403) { console.error(`key${i + 1}: HTTP ${res.status} (quota) — rotating`); continue; }
    let j;
    try { j = JSON.parse(txt); } catch { console.error(`key${i + 1}: bad JSON: ${txt.slice(0, 200)}`); continue; }
    if (!res.ok) { console.error(`key${i + 1}: HTTP ${res.status}: ${JSON.stringify(j).slice(0, 400)}`); if (i < keys.length - 1) continue; else process.exit(1); }
    const parts = j.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p.inlineData?.data);
    if (!img) { console.error(`key${i + 1}: no image part. resp: ${JSON.stringify(j).slice(0, 400)}`); if (i < keys.length - 1) continue; else process.exit(1); }
    const buf = Buffer.from(img.inlineData.data, 'base64');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`OK [key${i + 1}] ${model} ${aspect} -> ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
    return;
  }
  console.error('ALL KEYS EXHAUSTED (quota or error)');
  process.exit(1);
}
gen();
