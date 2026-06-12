// Wrapper-first port: split the approved single-file Stake game into a Vite app.
// Re-run this whenever the approved shining-crown-pixi.html changes to re-sync.
//
//   node scripts/port-from-singlefile.mjs
//
// It produces:
//   index.html                      <- head + <style> + loader DOM + a module entry (pixi tag removed)
//   src/game/shining-pop.game.js    <- the game's async-IIFE script body, verbatim (uses global PIXI)
//
// The game body is NOT modified: it references a global `PIXI`, which src/main.ts
// re-exposes from the npm package before dynamically importing this module.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SRC = 'C:/Users/edgar/OneDrive/Desktop/stake-front-factory/shining-crown-pixi.html';
const OUT_HTML = 'C:/Users/edgar/OneDrive/Desktop/shining-pop-studio/index.html';
const OUT_GAME = 'C:/Users/edgar/OneDrive/Desktop/shining-pop-studio/src/game/shining-pop.game.js';

// PROCESS-01 guard: the game body is now patched IN PLACE (Spine/GSAP/i18n/compliance work).
// A blind re-port OVERWRITES those edits verbatim. Refuse if the target is dirty; set
// FORCE_PORT=1 to re-sync intentionally after reconciling.
try {
  const _dirty = execSync('git status --porcelain -- src/game/shining-pop.game.js', { encoding: 'utf8' }).trim();
  if (_dirty && process.env.FORCE_PORT !== '1') {
    console.error('[port] ABORT: src/game/shining-pop.game.js has uncommitted changes — re-porting would DESTROY them.');
    console.error('[port] Commit or stash first, or run with FORCE_PORT=1 to overwrite intentionally.');
    process.exit(1);
  }
} catch (_e) { /* not a git repo / git unavailable: best-effort guard, continue */ }

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/);

// Anchor on the bundled-pixi <script> TAG (not the comment that mentions the path).
const pixiIdx = lines.findIndex((l) => l.includes('<script') && l.includes('vendor/pixi.min.js'));
if (pixiIdx < 0) throw new Error('Could not find the <script src=vendor/pixi.min.js> tag');

// The game <script> opens on the line after the pixi tag; its body starts the line after that.
const gameBodyStart = pixiIdx + 2;
// The closing </script> for the game is the LAST </script> in the file.
let gameClose = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === '</script>') { gameClose = i; break; }
}
if (gameClose < 0) throw new Error('Could not find closing </script>');

const gameBody = lines.slice(gameBodyStart, gameClose).join('\n');

// The game body is a self-invoking async IIFE with NO imports/exports. Append an ESM
// "module marker" so the file is a proper ES module: src/main.ts does `await import()`
// on it, and without an export TypeScript flags it "not a module" (TS2306). Runtime-neutral
// — ES modules are always strict-mode and the IIFE is already self-scoped, so behaviour is
// identical to the bundled-script original.
const ESM_MARKER =
  '\n\n// ── ESM module marker (appended by scripts/port-from-singlefile.mjs) ─────────\n' +
  '// Makes this ported IIFE a real ES module so `await import()` in src/main.ts type-checks.\n' +
  'export {};\n';
writeFileSync(OUT_GAME, gameBody.replace(/^﻿/, '') + ESM_MARKER, 'utf8');

// index.html = everything up to the loader's last DOM line (drop the pixi comment + tag + game script),
// then a Vite module entry, then the closing tags.
const headPart = lines.slice(0, pixiIdx - 1).join('\n'); // pixiIdx-1 drops the "<!-- PixiJS bundled… -->" comment
const indexHtml =
  headPart +
  '\n  <!-- Vite entry: npm PixiJS re-exposed as a global, then the ported game (wrapper-first) -->\n' +
  '  <script type="module" src="/src/main.ts"></script>\n' +
  '</body>\n</html>\n';
writeFileSync(OUT_HTML, indexHtml, 'utf8');

console.log(`[port] game body: source lines ${gameBodyStart + 1}..${gameClose}  (${gameClose - gameBodyStart} lines)`);
console.log(`[port] index.html head: source lines 1..${pixiIdx - 1}`);
console.log('[port] done.');
