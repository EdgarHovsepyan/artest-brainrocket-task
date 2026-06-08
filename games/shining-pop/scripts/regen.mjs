// SHINING POP reskin — targeted REGEN of the symbols the free model botched.
// Lesson learned: lead with the REAL object (anchor the subject), force a solid
// black background hard, and add strong negatives (no can/frame/ring/plate) so the
// crystal styling doesn't hijack the shape. Keeps the good ones untouched.
// Usage:  node scripts/regen.mjs [onlyId]
import { writeFileSync, mkdirSync } from 'node:fs';

const NEG = 'on a solid pure black background, black backdrop, isolated, centered with empty black space around it, no container, no can, no bottle, no jar, no glass cup, no frame, no border, no ring, no circle, no plate, no disc, no text, no watermark';
const STY = 'glossy crystal sculpture, candy-glass shine, faceted translucent crystal, polished chrome accents, soft glowing neon-magenta rim light, dramatic studio key light, ultra detailed, octane render, high resolution';

// id → [prompt, seed]   (full standalone prompts for maximum subject control)
const JOBS = {
  lemon: [`a ${STY.replace('glossy crystal sculpture', 'glossy crystal sculpture of a single whole lemon fruit')}, bright translucent amber-yellow crystal, one small green crystal leaf, a clearly lemon-shaped citrus fruit, ${NEG}, no apple`, 305],
  plum:  [`a glossy crystal sculpture of a single whole plum fruit, deep violet-purple translucent faceted crystal, one tiny crystal leaf and stem, a clearly round plum, ${STY}, ${NEG}, no apple`, 315],
  melon: [`a glossy crystal sculpture of a single triangular watermelon slice wedge, green crystal rind with red-pink translucent crystal flesh and small dark crystal seeds, a clearly triangular melon wedge, ${STY}, ${NEG}, no whole fruit, no sphere`, 325],
  star:  [`a glossy crystal sculpture of a single classic FIVE-pointed star, exactly five points, brilliant white-to-magenta translucent faceted crystal with a glowing magenta-ruby core and chrome edge, ${STY}, ${NEG}, no six points, no extra points, no snowflake`, 335],
};

const only = process.argv[2];
const W = 1024, H = 1024;
const outDir = 'public/assets/images/shining/_reskin/';
mkdirSync(outDir, { recursive: true });

async function one(id, prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${W}&height=${H}&model=flux&nologo=true&seed=${seed}&private=true&enhance=true`;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 150000);
  try {
    const res = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    if (!res.ok) { console.error(`${id}: HTTP ${res.status}`); return; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) { console.error(`${id}: too small`); return; }
    writeFileSync(outDir + 'sym_' + id + '.png', buf);
    console.log(`OK ${id} seed${seed} (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) { console.error(`${id}: ${e.message}`); }
}

for (const [id, [prompt, seed]] of Object.entries(JOBS)) {
  if (only && only !== id) continue;
  await one(id, prompt, seed);
}
console.log('done.');
