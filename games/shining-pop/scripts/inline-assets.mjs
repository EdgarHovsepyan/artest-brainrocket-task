// Post-build asset inliner — makes dist/index.html TRULY single-file for Stake
// ("no external resources"). Replaces every `url(assets/...)` in the built HTML
// (CSS @font-face faces + the bg image) with a base64 data: URI from /public.
// Run after `vite build`:  node scripts/inline-assets.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const HTML = 'dist/index.html';
const MIME = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

let html = readFileSync(HTML, 'utf8');
const before = Buffer.byteLength(html);
const cache = new Map();
const missing = [];

// Inline EVERY assets/... reference in the built HTML — CSS url() AND JS-string runtime
// fetches (PIXI.Assets.load('assets/images/shining/sym7-crown.jpg', ...)). Replacing the
// bare path works in both contexts (url(path) and 'path'). Only paths actually present in
// the HTML are inlined (the ~13 the game really loads); the rest of /public is never
// referenced, so it stays out. THIS is what makes the single file truly self-contained.
html = html.replace(/assets\/[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp|gif|woff2?|ttf|otf|mp3|ogg|wav)/g, (path) => {
  if (!cache.has(path)) {
    try {
      let buf; try { buf = readFileSync('public/' + path); } catch { buf = readFileSync('dist/' + path); }
      const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      cache.set(path, `data:${mime};base64,${buf.toString('base64')}`);
    } catch (e) { cache.set(path, path); missing.push(path); }
  }
  return cache.get(path);
});
if (missing.length) console.warn('[inline] MISSING (left external!):', missing.join(', '));

// ── SH-concatenated runtime assets. The symbol/logo/button JPGs are fetched as
// `SH + filename` where SH = "assets/images/shining/", so the full path never
// appears contiguously and the pass above can't see them. Empty the SH prefix,
// then swap each known filename string for its base64 data URI (split/join — robust).
const SH_DIR = 'public/assets/images/shining/';
// AUTO-DISCOVER every runtime .jpg in the shining dir (NOT the big *.jpeg sources,
// which the game never loads) so newly-added images are ALWAYS inlined. The old
// hardcoded list silently dropped the Buy-Bonus tier-*.jpg images → bare refs that
// 404'd → "ASSET LOAD FAILED" on a standalone serve (every prior single-file build
// was broken; dev only worked because it serves the real files). 2026-06-01.
const SH_FILES = readdirSync(SH_DIR).filter(f => f.toLowerCase().endsWith('.jpg'));
let shCount = 0;
if (html.includes('assets/images/shining/')) {
  html = html.split('assets/images/shining/').join('');   // SH -> ''
  for (const f of SH_FILES) {
    try {
      const uri = `data:image/jpeg;base64,${readFileSync(SH_DIR + f).toString('base64')}`;
      for (const q of ['"', "'", '`']) {
        const tok = q + f + q;
        if (html.includes(tok)) { html = html.split(tok).join(q + uri + q); shCount++; }
      }
    } catch (e) { missing.push('shining/' + f); }
  }
}
console.log(`[inline] SH-concat shining assets inlined: ${shCount}`);

// BUILD-02: inline /spine/crownwild/* assets (atlas + skeleton + page PNGs) as data
// URIs. SymbolRigPool registers each page with an alias matching the atlas page
// filename ('crown.png', 'crown_fx.png'), so a flat string-replace of every
// absolute /spine/... path in the bundled JS is sufficient — spine-pixi-v8 resolves
// page references by name out of the Assets cache.
const SPINE_FILES = [
  { path: '/spine/crownwild/crownwild.json',  mime: 'application/json' },
  { path: '/spine/crownwild/crownwild.atlas', mime: 'text/plain' },
  { path: '/spine/crownwild/crown.png',       mime: 'image/png' },
  { path: '/spine/crownwild/crown_fx.png',    mime: 'image/png' },
];
let spineInlined = 0, spineSkipped = 0;
for (const f of SPINE_FILES) {
  try {
    const buf = readFileSync('public' + f.path);
    const uri = `data:${f.mime};base64,${buf.toString('base64')}`;
    if (html.includes(f.path)) { html = html.split(f.path).join(uri); spineInlined++; }
    else spineSkipped++;
  } catch (e) { missing.push(f.path); }
}
console.log(`[inline] spine assets inlined: ${spineInlined}/${SPINE_FILES.length} (skipped:${spineSkipped})`);

// Neutralise PixiJS's default basis/ktx transcoder CDN URLs. The game never loads
// compressed (.ktx2/.basis) textures, so these are DEAD strings (never fetched), but
// Stake scans the HTML for external hosts — strip the CDN host so the scan is clean.
const cdnBefore = (html.match(/cdn\.jsdelivr\.net/g) || []).length;
html = html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/pixi\.js\//g, '');
const cdnAfter = (html.match(/cdn\.jsdelivr\.net/g) || []).length;
console.log(`[inline] jsdelivr CDN refs: ${cdnBefore} -> ${cdnAfter}${cdnAfter === 0 ? ' OK' : ' STILL PRESENT!'}`);

// HARD GATE (COMPLIANCE-01) — Stake "no external resources" XSS policy. Fail the build LOUDLY
// if any LOADED external resource survives inlining. Allowlist: data: URIs, the RG link
// (begambleaware), XML namespace URIs (w3.org, declared in inline SVG and never fetched),
// and the pixijs.com attribution string. Anything else fetchable fails the build.
const _ext = [];
for (const m of html.matchAll(/(?:url\(\s*['"]?|(?:src|href)\s*=\s*['"])(assets\/[^'")]+)/g)) _ext.push(m[1]);
for (const m of html.matchAll(/https?:\/\/[^\s'"()<>]+/g)) {
  const u = m[0];
  if (/^https?:\/\/(www\.)?begambleaware\.org/i.test(u)) continue;
  if (/^https?:\/\/www\.w3\.org\//i.test(u)) continue;
  if (/^https?:\/\/(www\.)?pixijs\.com\//i.test(u)) continue;
  if (/^https?:\/\/(www\.)?gsap\.com/i.test(u)) continue; // GSAP license banner (inert attribution, not fetched)
  _ext.push(u);
}
const _bad = [...new Set([..._ext, ...missing.map((x) => '(missing) ' + x)])];
if (_bad.length) {
  console.error('[inline] BUILD FAILED — external resources remain (Stake would reject this upload):');
  for (const o of _bad) console.error('   - ' + o);
  console.error('[inline] Inline them (ensure they exist under public/ or dist/) or remove the reference, then rebuild.');
  process.exit(1);
}
console.log('[inline] gate OK: 0 external loaded resources — truly self-contained.');
writeFileSync(HTML, html);
const after = Buffer.byteLength(html);
const left = (html.match(/assets\/[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp|gif|woff2?|ttf|otf|mp3|ogg|wav)/g) || []).length;
console.log(`[inline] inlined ${cache.size} asset(s) (CSS url + JS runtime fetches)`);
console.log(`[inline] dist/index.html: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
console.log(`[inline] remaining external assets/ refs: ${left}  ${left === 0 ? 'OK — TRULY self-contained' : 'STILL EXTERNAL!'}`);
