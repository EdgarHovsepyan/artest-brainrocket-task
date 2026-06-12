// SHINING POP reskin — batch-generate the full symbol set via Pollinations/Flux
// (free, no key). One shared style language so 9 separately generated relics read
// as ONE award-winning family. All isolated on flat black → runtime stripCanvas keys.
// Usage:  node scripts/reskin-batch.mjs [onlyId]
import { writeFileSync, mkdirSync } from 'node:fs';

const STYLE = 'candied cut-crystal and polished platinum chrome, glowing neon-magenta rim light, faint cyan crystal edge dispersion, glossy candy-glass finish, ultra detailed, symmetrical, dramatic studio key light, isolated on a pure flat black background, generous even margin, no text, no watermark, no cropping, high resolution';
const pre = 'premium casino slot game symbol, a single centered';

// id → { subject, seed }   (crown already locked from crown_free; regenerated here for the set)
const SYMBOLS = [
  ['cherry', 'pair of candied-crystal cherries, deep ruby-red faceted glass bodies, chrome stems and a crystal leaf', 11],
  ['lemon',  'candied-crystal lemon, translucent amber-yellow faceted glass, subtle chrome calyx', 21],
  ['plum',   'candied-crystal plum, deep violet-purple faceted glass with amethyst internal refraction', 31],
  ['grapes', 'candied-crystal grape cluster, violet-magenta faceted glass orbs, chrome stem and a crystal leaf', 41],
  ['melon',  'candied-crystal watermelon wedge, emerald-green crystal rind and pink-red crystal flesh with tiny white gem seeds', 51],
  ['bell',   'royal candied-crystal bell, polished platinum chrome body with amethyst crystal panels and a ruby-magenta clapper jewel, filigree', 61],
  ['seven',  "bold glossy number '7' sculpted from candied magenta-ruby crystal with a chrome bevel and an inner ruby glow", 71],
  ['crown',  'ornate royal crown, ornate filigree band, crystal spires graduating amethyst purple to clear white, a central ruby-magenta cabochon heart gem', 7],
  ['star',   'five-point star cut from brilliant candied crystal, white-to-magenta faceted glass with a ruby-magenta core and a chrome edge bevel, radiant', 91],
];

const only = process.argv[2];
const W = 1024, H = 1024;
const outDir = 'public/assets/images/shining/_reskin/';
mkdirSync(outDir, { recursive: true });

async function one(id, subject, seed) {
  const prompt = `${pre} ${subject}, ${STYLE}`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${W}&height=${H}&model=flux&nologo=true&seed=${seed}&private=true`;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 150000);
  try {
    const res = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    if (!res.ok) { console.error(`${id}: HTTP ${res.status}`); return false; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) { console.error(`${id}: too small (${buf.length}b)`); return false; }
    writeFileSync(outDir + 'sym_' + id + '.png', buf);
    console.log(`OK ${id} (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) { console.error(`${id}: ${e.message}`); return false; }
}

for (const [id, subject, seed] of SYMBOLS) {
  if (only && only !== id) continue;
  await one(id, subject, seed);
}
console.log('done.');
