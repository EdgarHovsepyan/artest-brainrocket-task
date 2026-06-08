// ── SHINING POP STUDIO — Vite entry (wrapper-first migration) ───────────────
// The ported game (src/game/shining-pop.game.js) was authored against the
// bundled vendor/pixi.min.js, which set a GLOBAL `window.PIXI`. To run it under
// Vite with ZERO game-code changes, we re-expose the npm PixiJS as that same
// global BEFORE the game module executes, then dynamic-import the game.
//
// Why a DYNAMIC import: static `import` statements are HOISTED and would run the
// game BEFORE the assignment below. A dynamic `import()` evaluates the game module in a
// later microtask — by which point `globalThis.PIXI` is already set synchronously here.
// We deliberately do NOT `await` it at the top level: the production single-file build
// targets es2020, which has no top-level await (TLA). The dynamic import alone guarantees
// the ordering; the `await` was never load-bearing. (We modularize away from the global
// in a later phase.)
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { SymbolRigPool } from './spine/SymbolRigPool.js';
import { makeSkin } from './ui/betting-bar-skin.js';
import { BettingBarMobile } from './ui/betting-bar-mobile.js';
import { BettingBarWeb } from './ui/betting-bar-web.js';

(globalThis as Record<string, unknown>).PIXI = PIXI;
// SPINE-04/05: expose the Crown rig pool BEFORE the game module runs so game.js
// can boot the rig at app.init time. Spine itself is bundled by importing the
// pool here (vite tree-shakes if the import is removed).
(globalThis as Record<string, unknown>).SymbolRigPool = SymbolRigPool;
// MOTION-01: expose GSAP globally (like PIXI) BEFORE the game module runs, so game.js can
// drive UI / ceremony / count-up / modal tweens off it. lagSmoothing avoids a catch-up jump
// after a stalled frame (Slow-3G). (Single-clock app.ticker drive is a tracked follow-up.)
(globalThis as Record<string, unknown>).gsap = gsap;
gsap.ticker.lagSmoothing(500, 33);
// BAR-SKIN: expose the delivered betting-panel skin factory globally (like PIXI/gsap)
// BEFORE the game module runs, so game.js can build the skin once (window.__makeSkin(PIXI))
// and conform the bottom bar to the delivered gold panel in place. Falls back gracefully
// (game guards every use with `if (skin)`) if the module is ever absent.
(globalThis as Record<string, unknown>).__makeSkin = makeSkin;
// DELIVERED BAR: expose the v8 port of the delivered BettingBarMobile component so
// game.js can mount it as THE bar (full panel), hide its native bar, and wire it.
(globalThis as Record<string, unknown>).BettingBarMobile = BettingBarMobile;
// DELIVERED WEB BAR: the landscape (2400x300) counterpart, mounted for landscape.
(globalThis as Record<string, unknown>).BettingBarWeb = BettingBarWeb;

// Spine + GSAP are installed and ready for the next phase (see docs/10_…BLUEPRINT.md).
// They are intentionally NOT imported yet — wrapper-first keeps the approved game
// behaviour identical until we wire the SymbolRig controller (src/spine/).

// Spine previews — DEV-ONLY (gated behind import.meta.env.DEV so Vite tree-shakes
// these branches AND spine-pixi out of the production Stake build). Isolated from
// the game either way.
//   ?spine=crown → Crown Wild rig (real art + generated FX) idle/land/win/bigwin
//   ?spine=true  → knight scaffold (placeholder box art) idle
const _spine = import.meta.env.DEV ? new URLSearchParams(location.search).get('spine') : null;
if (_spine === 'crown') {
  void import('./spine/crown-demo.js');
} else if (_spine === 'true') {
  void import('./spine/knight-demo.js');
} else {
  void import('./game/shining-pop.game.js');
}
