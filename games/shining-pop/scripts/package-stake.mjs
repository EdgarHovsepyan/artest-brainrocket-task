// Organises the Stake ACP upload into the two halves Stake expects, as separate
// directories under /stake-build:
//   front/  — the self-contained single-file frontend (dist/index.html)
//   back/   — the math package (books JSONL + lookup CSV + index.json) — a HANDOFF
//             slot; the locked math lives in the approved repo, copy it in here.
// Run:  npm run package:stake   (= build:stake then this)
import { mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

const ROOT = 'stake-build';
mkdirSync(`${ROOT}/front`, { recursive: true });
mkdirSync(`${ROOT}/back`, { recursive: true });

// FRONT — the inlined single-file build (what you upload to ACP -> Import Files -> Front End)
if (!existsSync('dist/index.html')) {
  console.error('[package] dist/index.html missing — run `npm run build:stake` first.');
  process.exit(1);
}
// Defensive gate (mirrors inline-assets.mjs) — refuse to package a build that still has
// external resources (e.g. a plain `vite build` dist with no inline step).
{
  const _h = readFileSync('dist/index.html', 'utf8');
  const _bad = [];
  for (const m of _h.matchAll(/(?:url\(\s*['"]?|(?:src|href)\s*=\s*['"])(assets\/[^'")]+)/g)) _bad.push(m[1]);
  for (const m of _h.matchAll(/https?:\/\/[^\s'"()<>]+/g)) {
    const u = m[0];
    if (/^https?:\/\/(www\.)?begambleaware\.org/i.test(u)) continue;
    if (/^https?:\/\/www\.w3\.org\//i.test(u)) continue;
    if (/^https?:\/\/(www\.)?pixijs\.com\//i.test(u)) continue;
  if (/^https?:\/\/(www\.)?gsap\.com/i.test(u)) continue; // GSAP license banner (inert attribution, not fetched)
    _bad.push(u);
  }
  if ([...new Set(_bad)].length) {
    console.error('[package] ABORT — dist/index.html still has external resources. Run `npm run build:stake` (not a plain build):');
    for (const o of [...new Set(_bad)]) console.error('   - ' + o);
    process.exit(1);
  }
}
copyFileSync('dist/index.html', `${ROOT}/front/index.html`);

// BACK — math handoff README (the math is LOCKED and lives in the approved repo)
writeFileSync(`${ROOT}/back/README.md`, `# back/ — Math package (Stake ACP -> Math)

The frontend is a deterministic PLAYBACK machine; the math is the source of truth and is
**locked** (RTP 96%, max win 5,000x). It is NOT generated here. Drop the math files for the
upload into this folder:

- \`index.json\`              — mode descriptor
- \`lookUpTable_*.csv\`       — payout lookup tables (one per mode)
- \`books_*.jsonl\` (+ .zst)  — event books (one per mode)

These come from the approved math project (the Python math-sdk output in
\`stake-front-factory/\`). Verify RTP before upload:

    awk -F, '{w+=$2; p+=$2*$3} END {print p/w/100}' lookUpTable_base_0.csv   # must print 0.96

> The two ACP uploads are independent: **Front End** (../front/index.html) and **Math** (these files).
`);

// Top-level explainer
writeFileSync(`${ROOT}/README.md`, `# stake-build/ — Stake ACP upload package

Two independent uploads, kept in separate directories (per Stake's ACP):

| dir | upload | contents |
|---|---|---|
| \`front/\` | ACP -> Import Files -> **Front End** | \`index.html\` — self-contained single file (PixiJS + assets all inlined, no external resources) |
| \`back/\`  | ACP -> **Math** | \`index.json\` + \`lookUpTable_*.csv\` + \`books_*.jsonl\` — the locked math (handoff; see back/README.md) |

Rebuild front:  \`npm run package:stake\`  (= \`build:stake\` then \`package-stake.mjs\`).
`);

console.log(`[package] wrote ${ROOT}/front/index.html + ${ROOT}/back/README.md + ${ROOT}/README.md`);
console.log('[package] front = self-contained single file; back = math handoff (locked, from approved repo).');
