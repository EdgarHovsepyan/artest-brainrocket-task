I have all seven surface edit-maps and four skill audits. Producing the synthesized master finalization punch-list now.

---

# SHINING POP V3 — MASTER FINALIZATION PUNCH-LIST
### Cocos Sugar Rush slot → PRODUCTION-READY, AWARDS-TIER

---

## 1. STATUS LINE

**Done:** v3 scaffold forked from v2 (Cocos, MVC) and builds (`build/web-mobile/index.html` present); `theme.ts` authored with the full Sugar Rush token system; fonts loaded (`LuckiestGuy` display, `SpaceMono` mono, `Fredoka` body); mobile bar `C{}` retinted pink (no violet survives); quick-bet engine-bound 6-level; autoplay grouped in both bars; spin dome pink (C7); LDW branch + reality-check wired; bg cool-tint present; 3-band non-overlapping layout (mobile idle clean). Math layer frozen and certified (97.8% RTP).

**Headline gap:** the Sugar Rush re-skin is **half-migrated**. `theme.ts` exists but is imported by **zero files** (R10 dead) — every surface still carries its own private `C{}`/`PAL` literals, so the canonical tokens are inert. On top of that, three surfaces still ship **v2 behavior that contradicts the v3 spec**: the win presentation animates (scale-pop + jelly + tilt) where spec demands a static cyan ring; the ceremony tier ladder is four shades of pink (no cyan/white escalation); Menu/Settings carry the wrong rows and only 3 of 6 mandated controls. Plus production-blockers: `"POP V2"` branding strings, desktop logo docked top-LEFT (spec: top-center), no WebGL legal strip, no Battery Saver / runtime-DPR lever, no autoplay loss/single-win limits, and a particle-pool that starves (450 req vs 96 cap) on the EPIC ceremony peak.

---

## 2. THE PUNCH-LIST

Format: `[P0|P1|P2] file — change (exact values) — acceptance check`. All paths under `D:\projects\artest-brainrocket-task\games\shining-pop-v3\assets\scripts\` unless noted.

### SURFACE A — Theme migration + branding (the prep gate)

- **[P0] view/palette.ts** — rewrite `PAL` from a literal table into a `THEME` shim: `import { THEME }`, map `PAL.fonts → THEME.fonts`, `PAL.accent/cyan/violet/winGreen/megaFuchsia → THEME.accent.*`; delete dead `PAL.symbolGem`, `PAL.gradeTint.bonus_*`; resolve `'Luckiest Guy'`(space) vs `'LuckiestGuy'` to the `THEME.fonts` value — `grep -r "import.*THEME"` returns ≥1 hit; `npx tsc --noEmit` clean.
- **[P0] view/slot-view.ts:1711 + :2932** — replace both `mkLabel('POP  V2', …)` with `'POP'` — grep for `POP  V2` / `V2` returns 0 in v3 source; fallback renders "POP".
- **[P1] new view/draw-utils.ts** — extract shared `col()`, `make3D()`, `panelInto()` (currently duplicated across `betting-bar.ts:71`, `betting-bar-web.ts:63`, `buy-bonus-modal.ts:46`) — both bars + modal import from one util; R12 lockstep de-risked; `npx tsc` clean.
- **[P1] view/slot-view.ts, ui/*.ts, view/buy-bonus-modal.ts** — route the per-file `C{}`/inline `new Color()` tables through `THEME.accent.*`/`THEME.pink.*` (same values, single source) — a re-skin touches `theme.ts` only; no raw hex in consumers for signal colors.
- **[P1] view/symbol-view.ts** — replace magic `8` with imported `SCATTER` at `:23, :441, :452, :897` — grep `=== 8`/`|| 8` in symbol-view returns 0; tests green.

### SURFACE B — Win presentation (C1, the biggest delta)

- **[P0] view/view-config.ts** — in `win`: add `staticRing: true`; set `symbolPulseScale → 1.0`, `winBounceLoop.enabled → false`, `winTilt.enabled → false`; KEEP `winAnticipation.dip:0.9, ms:80` valid; `loserDimOpacity 95 → 140`; retune `haloTint → {hot:'#ffffff', cold:'#7fe7ff', hotHeat:1.3, coldHeat:0.9}`; add `ring:{coreColor:'#ffffff', coreWidthPx:2, glowColor:'#7fe7ff', glowBlurPx:20, glowAlpha:0.9}` — `view-config.test.ts` 11/11 green (hotHeat>coldHeat, dim∈[0,255], dip∈(0,1)).
- **[P0] view/symbol-view.ts (`playWin` 325-387)** — gate the pop/jelly/tilt block behind `staticRing`; when true run only `Tween.stopAllByTarget(this.node); this.node.setScale(1,1,1); this.node.eulerAngles = new Vec3(0,0,0)` and skip `popTween`/`bnc`/`tlt` `repeatForever`; KEEP `winActive=true`, `ensureBurst`, `liftForWin`, halo/glow, sparkles, `swapWildWinFace`, `playWinShader` — two consecutive frames of a winning cell: `node.scale` identical, `eulerAngles.z===0`; halo still pulses opacity; R2 `repeatForever`-on-`node` removed.
- **[P1] view/symbol-view.ts (build 122-133, halo 401-404)** — recolor the 10-layer glow ramp white-core→cyan-falloff (`127,231,255` = `THEME.accent.cyan`); halo lerp consumes the new `haloTint` — win ring samples white center, cyan edge, zero gold pixels; cyan only on win/scatter cells.
- **[P1] view/symbol-view.ts (playStarPop 561, playBubbles 670, playSparkles 514)** — reorder palettes cyan/mint/pink-led, gold→accent-only; sparkle `255,240,255 → 230,248,255`; `happyFace` retint (fallback-only, defer if wild win-frame present) — no gold-dominant burst on a win.
- **[P1] view/slot-view.ts (`LINE_HUES` 70-81, `paintCandyLines` 3477-3481, `buildWinBeams` 1304-1308)** — win-line stroke stack → cyan-cored ramp (outer `127,231,255` → inner `255,255,255`); tint `win-beam` sprites cyan via `sp.color` (NO `depthStencilState`, R3); keep `×N` payout pop legible (warm/white) — beam reads cyan/white core; no pink line on a win; `LINE_HUES` left inert with a comment (P2-2).

### SURFACE C — Reel cabinet, logo, HUD pills (Surface Map 1)

- **[P0] view/view-config.ts (`layout.logo` 65-73)** — `landscapeScreenX 0.085 → 0.5`, `landscapeScreenY 0.88 → 0.12`, `landscapeScale 0.4 → 0.46` — desktop logo horizontally centered top band, not bottom-left; `canvas-anomaly-detector` onscreen+z-stack pass.
- **[P0] view/slot-view.ts (`buildTitle` 1724-1729)** — add `spFloat`: gated `if (!this.reducedFx)` vertical bob on `art` (NOT `logo`), `.by(2,{position:Vec3(0,6,0)}).by(2,{position:Vec3(0,-6,0)}).union().repeatForever()` — logo bobs ±6px/4s, static under reduce-motion; `art` is build-time node (R2 safe).
- **[P1] view/slot-view.ts (`buildFrame` 1739-1817)** — rebuild cabinet to glass recipe: swap pink `portalGlow` ring `strokeColor → 127,231,255,(1-t)²·76` radius `18+sp`; fill `10,6,20,87` base + `255,255,255,41` upper-half lighten; border `lineWidth 2`, `127,231,255,140`; drop the 3-iter dark-inset loop; add 4 gold corner rivets (`233,184,78` core + `255,217,122,220` specular, `RIV=7` at `±(w/2-13, h/2-13)`) — use `THEME.accent.cyan/gold` once P0 theme lands — static capture: translucent cyan-glass cabinet, no pink, gold corner dots; containment asserts pass.
- **[P1] view/slot-view.ts (`buildHud` 2017-2022)** — replace single pink plate with 3 glass pills via new `mkGlassPill`: balance cyan border `127,231,255,200`, bet pink `255,90,156,200`, win mint `82,209,137,210` + mint value; Space Mono micro-labels via `applyFont(cap,'mono')`; preserve `balanceLabel/betLabel/winLabel` field names — `setBalance/setBet/setWin` still update live; 3 pills non-overlapping. (Dead path under `externalControls` per layout audit; verify before investing — see Surface H.)
- **[P2] view/view-config.ts (`layout.cell/gap` 19-23)** — FLAGGED: keep `cell:96, gap:5` (passes containment) — do NOT apply Part-4 `100/8` unless re-running the geometry gate.

### SURFACE D — Menu, Settings, overlay mutex (Surface Map 2)

- **[P0] view/slot-view.ts (`buildMenuHub` 2606-2612 + `MENU_PRESENT` 2596)** — replace 5 rows with `SOUND FX`(inline toggle, no hub-close), `MUSIC`(inline toggle), `GAME RULES ›`(→`buildInfoPanel('rules')`+`popOpen`), `PAYTABLE ›`(→`'paytable'`), `SETTINGS ›`(→`openSettingsPanel`); toggle rows skip `hub.active=false`, nav rows keep it — menu shows exactly those 5 in order; toggles flip an ON/OFF pill with menu open; nav rows close hub + open target.
- **[P0] view/slot-view.ts (`SettingsPanelConfig` 119, `SettingsKey` 125, `configureSettingsPanel` 2379-2433)** — widen config to `{soundVol, musicVol, quickSpin, reducedFx, batterySaver, lang, soundOn}`; `SettingsKey = 'sound'|'music'|'soundVol'|'musicVol'|'quickSpin'|'reducedFx'|'batterySaver'|'lang'`; rebuild panel to 6 rows (Sound vol slider, Music vol slider, Quick Spin, Reduce Motion, Battery Saver, Language), `h = 92 + 6*62`; `settingsChangeCb` value widens to `number|boolean|string` — Settings shows exactly 6 controls in order, each reflects state on open; `tsc` clean.
- **[P0] controller/slot-controller.ts (`applySetting` 419, `refreshSettingsPanel` 436)** — switch over new `SettingsKey`; add fields `musicOn/soundVol(0.8)/musicVol(0.6)/quickSpin/batterySaver/lang('EN')`; `quickSpin → setTurboMode(on?1:0)`; pass 6 fields to `configureSettingsPanel` — each control mutates its field + calls matching `view.*` setter; panel re-renders.
- **[P1] view/audio-manager.ts (~143)** — add `setBusVolume(bus, v)`: `buses[bus].gain.setTargetAtTime(db2lin(BUS_DB[bus])*clamp01(v), ctx.currentTime, 0.02)`; view passthroughs `setSfxVolume`(sfx+gameplay+win), `setMusicVolume`(music), `setMusicEnabled` — Sound vol changes SFX buses independently of Music; verified via gain.
- **[P1] view/perf.ts + slot-view.ts** — `VfxGovernor.setQualityCeiling(scale)` + DPR clamp; `view.setBatterySaver(on)` sets ceiling to `minScale` + caps `cc.screen.resolutionScale ≤1.0` (R7) — Battery Saver ON drops vfx% + caps DPR, verified via `formatVfxHud`.
- **[P1] view/slot-view.ts** — `setLanguage(code)` localization stub (no-op map until string table) — invoked with chosen code; no `logic/` touch.
- **[P2] ui/betting-bar.ts:685 + betting-bar-web.ts:398** — READ-ONLY confirm menu icon emits `menu` (not `settings`); grep `openSettingsPanel` call sites = only menu row + controller re-open — Settings unreachable without opening menu.

### SURFACE E — Betting bars + icons (Surface Map 3)

- **[P1] ui/betting-bar.ts (`makeHitAreas` 667)** — add `add('hitBetMenu', 240, 480, 60, 52, emit('betmenu'))` over center BET value (gap x∈[240,300], clear of steppers) — mobile tap-on-value opens 6-level `quickBetPanel`; no double-trigger with `−/+`.
- **[P1] ui/betting-bar.ts (`drawDecor` 189)** — draw a `col(C.ring,0.7)` down-caret cue at `(270,524)` under the value — subtle "tappable" cue, centered, no overlap with dividers.
- **[P1] view/view-config.ts (`bar.web.carousel` 498)** — `pillCenterX 388 → 1480`, `cellW 132 → 120` — 6 cells centered in mask, active pill over active cell, `idxAtPillX` returns 0–5; containment pass.
- **[P1] ui/betting-bar.ts + betting-bar-web.ts (both `fit()`)** — floor small hit nodes to ≥44px effective: `ui.setContentSize(Math.max(designW, 44/s), …)` keeping center, glyph visuals unchanged (R12 both) — every control ≥44×44 at smallest viewport; no new overlap.
- **[P1] ui/betting-bar.ts + betting-bar-web.ts (turbo, both)** — add `caramel:'#ff9a3c'` to each `C{}`; point turbo bolt fill + `ic_bolt` tint + pip at `C.caramel` (web keep `#8a5200` outline) — turbo reads caramel both bars; pink=brand, cyan=win, gold=coins preserved.
- **[P2] ui/betting-bar.ts + betting-bar-web.ts (`icon()` both)** — bump procedural glyph `lineWidth` floor (mobile menu `2.6→3`, sound `2→2.4`) — no stroke shimmer at min viewport; vector fallback is production art (no PNGs ship).

### SURFACE F — Win ceremony, buy-bonus, free spins (Surface Map 5)

- **[P0] view/view-config.ts (`ceremony.tiers` 284-329)** — set colors only: `EPIC '#ffffff'`, `SUPER '#7fe7ff'`, `MEGA '#ff2ad0'`, `BIG '#ff8ab8'`; KEEP `minMultiple` 100/50/30/10 (coupled to controller audio sting `:553`) — `ceremony(12/35/60/120)` → pink/fuchsia/cyan/white headers; banding + parity unchanged.
- **[P1] view/ceremony-view.ts (`build` ~91)** — add `dimNode.on(TOUCH_END, () => this.fastForward())` so backdrop tap skips; verify `fastForward` sets `setAmount(fmt(countTarget))` = model `winCents` — tap inside OR backdrop snaps count to exact model winCents, dismisses <0.35s, all 4 tiers + reduced-motion.
- **[P1] view/slot-view.ts (`BUY_PRESENT` 2207-2211)** — accents+volatility tags: `wilds {accent:'#ff2ad0', special:'TOP VOLATILITY · Wilds stick & bounce'}`, `crowns {accent:'#52d189', special:'BALANCED · Crowns lock…'}`, `reels {accent:'#7fe7ff', special:'Full wild reels strike in'}`; iteration order already cost-sorted — modal: WILD REELS(cyan)/STICKY CROWNS(mint BALANCED)/STICKY WILDS(fuchsia TOP VOLATILITY), all "8 FREE SPINS".
- **[P1] view/slot-view.ts (`buyModal.on('buy')` 2220-2224) + new `showConfirm`** — insert confirm-before-debit: BUY press → `showConfirm('CONFIRM PURCHASE', 'Buy {name} for {cachedCost}?', 'BUY','CANCEL', onOk→buyCb, onCancel)`; cache `buyCostByMode[mode]` in `refreshBuyCosts` (view never recomputes cost) — CANCEL leaves balance unchanged; BUY debits exactly `round(betCents×cost)`; controller `balance<bonusCost` guard stays authoritative.
- **[P1] view/slot-view.ts (`setBonusAtmosphere` 416-421 + HUD `ACID`)** — FS world tints: `crowns [82,209,137,44]`(mint), `reels [127,231,255,44]`(cyan), `wilds [127,231,255,26]`(cyan/teal — common scatter-FS case; accept tile-accent≠world-tint for bought sticky-wilds); bonus HUD accent → mint `#52d189` — bought crowns=mint world, reels=cyan, any FS HUD mint; no warm-gold tints.
- **[P2] view/slot-view.ts (`pulseSticky` ~3769, FS banner)** — retint `FREE SPIN ×N` banner text to mint; no fabricated multiplier (only `step.payout`-derived) — FS steps show mint ×N; sticky pulses in bought mode accent.

### SURFACE G — Info / paytable (Surface Map 6)

- **[P0] logic/info-content.ts (`SYMBOL_DISPLAY` 15-26)** — relabel: `1:CROWN, 2:HEARTS, 3:DIAMOND, 4:AMETHYST, 5:MINT DROP, 6:CANDY CANE, 7:GUMMY BEARS, 9:CHERRY DROP` (0 WILD/8 SCATTER kept) — paytable rows read candy names, pays still from `PAYTABLE`; ties render identical; parity green.
- **[P1] logic/game-config.ts (`SYMBOL_NAMES` 16-27)** — align fallback labels to candy (Crown/Hearts/…/Scatter); do NOT touch `SYMBOLS`/`PAYTABLE`/`REEL_WEIGHTS`/`PAYLINES`/`BONUS_MODES` — missing-art fallback reads candy; parity green.
- **[P1] logic/info-content.ts (`RTP_DISPLAY` 63)** — `'97.50%' → '97.80%'` — info/footer shows 97.80% (matches cert sheet).
- **[P1] logic/info-content.ts (`maxWinMultiple` 59-61)** — `return Math.min(PAYTABLE[WILD][5]*WILD_STRIKE.maxMultiplier, 5000)` + export `MAX_WIN_CAP_MULTIPLE=5000` — all 3 consumers show "5,000×"; no math touched.
- **[P1] view/particle-layer.ts (`CANDY` 10-18, +import THEME)** — `[THEME.pink.p500, .pink.p200, .accent.cyan, .accent.mint, .accent.fuchsia, .accent.gold]` each `.clone()` (no singleton mutation); `COIN`/`WHITE` stay — bursts pink-led w/ cyan/mint/fuchsia; coin geyser gold; `tsc` clean.
- **[P1] view/slot-view.ts (`infoTab` 223, `buildInfoPanel` 2445)** — widen to 4 tabs `'paytable'|'paylines'|'features'|'rules'` (default paytable); render 4 buttons `(i-1.5)*124`; add `paylines` branch (10 mini 5×3 grids from `PAYLINES`/`GRID`), rename old `info` catch-all → `features` — 4 tabs in order; Paylines lights exact `PAYLINES[i]` cells; Features RTP 97.80%/MAX 5,000×/LINES 10; `tsc` + parity green.

### SURFACE H — Splash, compliance, autoplay, demo (Surface Map 7)

- **[P0] logic/autoplay.ts (5-8, 10-17, 26, 59-71)** — add `lossLimitCents`/`singleWinLimitCents` (0=off) to options+state; add `'lossLimit'|'singleWin'` to `StopReason`; track cumulative net loss; `evaluateContinuation` stops on `winCents≥singleWinLimit` and cumulative `bet-won≥lossLimit` — node:test: single-win≥limit halts, loss≥limit halts, both-off=legacy; parity green (UI safeguard, not RGS math).
- **[P0] view/slot-view.ts (`AutoplayPanelConfig` 112, `configureAutoplayPanel` 2298-2367) + controller/slot-controller.ts (`refreshAutoplayPanel` 470, `evaluateContinuation` call 597)** — add loss-limit + single-win-limit rows (cycling cents pills), `h: 2*56 → 4*56`; pass net-loss tally to `evaluateContinuation`; new reasons route through `stopAuto()` — panel exposes count+loss+single-win; limits actually halt; no row overlap (measured).
- **[P1] controller/slot-controller.ts (base-spin 534-558, `finishBonus` 660-670)** — explicit `const ldw = winCents>0 && winCents<=betCents`; when ldw: no `playCeremony`, no `audio.win`, no `setWinPrestige`, neutral banner; gate ALL LDW presentation on `comply.allowLdwCelebration` (currently dead) — false (UKGC/SE/DE) forces neutral — win≤bet shows no ceremony/sting, honest banner; wins>bet celebrate normally.
- **[P1] build-templates/web-mobile/index.ejs (~153)** — ADD `<div class="brand legal" style="bottom:14px;…">WEBGL · 18+ · PLAY RESPONSIBLY</div>`; no "PixiJS" string (v3 is Cocos) — built `index.html` grep finds `WEBGL`, 0× `Pixi`.
- **[P1] controller/slot-controller.ts (intro 145-166) + slot-view.ts `buildIntro`** — make intro require an explicit visible "TAP TO PLAY" tap that fires `onReady`→`audio.unlock()`; keep global `unlockOnce` fallback — no music before gesture; `unlock()` runs once, no double `main_base_loop`.
- **[P1] build-templates/web-mobile/index.ejs (148-151)** — cap `LOADING → LOADING ASSETS`; add `A PREMIUM CANDY SLOT` tagline under logo (Fredoka, no new infinite anim) — loader shows tagline + "LOADING ASSETS …%"; reduced-motion still suppresses anims.
- **[P0] scripts/assemble-demo.mjs (26-29)** — append `{ slug:'shining-pop-v3', src:'games/shining-pop-v3/build/web-mobile' }` after v2 (build dir exists → safe now); do NOT add a v3 rewrite to `vercel.json` (Pixi-only `/spine/` rewrite stays) — `node assemble-demo.mjs` logs `✓ shining-pop-v3`, copies to `public/shining-pop-v3/`.

### SURFACE I — Symbol art remap + code hygiene (audits)

- **[P1] view/slot-view.ts (`SYM_RES` 83-94)** — apply `ART_REMAP` so most-premium candy art sits on highest-pay id, id0=Wild/id8=Scatter fixed; remap ART INDEX only, never PAY/weights; honor ties (id3≡id4, id6≡id7 cosmetic); do NOT reorder filenames (UUID binding) — visual hierarchy tracks paytable; `npm test` parity green.
- **[P0] symbol-view/slot-view perf — view/particle-pool.ts (95-104) + particle-layer.ts (`fireEmbers` 123-163)** — decide shard render mode (Sprite+material) at prealloc, raise `prealloc → poolCap(96)` (no `addComponent`/`allocate` mid-play); clamp `fireEmbers` to remaining pool headroom, `perCell 22 → 10-12`, `Math.min(centers.length,6)` for per-cell loop — 0 `addComponent` after warmup; live shards ≤96 (0 `get→null`) on 15-cell win; first-big-win frame within 2ms of steady-state.
- **[P1] view/slot-view.ts (`tickUTime` 940, 1537-1557)** — tick only active shader materials (track `activeShaderKeys` set, `Array.from` per R1) or gate behind "any win/bonus FX live"; `crystal-idle` may tick alone — idle base-game ≤1 `setProperty`/frame.
- **[P1] view/symbol-view.ts (`playWin` rich-cell loops)** — cap rich treatment to top-N (≤5) winning cells, rest get cheap-sparkle path; scale `playStarPop`(9)/`playBubbles`(7) by `1/winningCells`; consult `VfxGovernor.scale` — ≤~120 concurrent symbol win-tweens at peak; dense FS win ≥55fps.
- **[P2] view/symbol-view.ts (404, halo lerp) + particle-layer coinGeyser** — hoist `fromHEX`/`new Color` out of per-cell loops (module-const cold/hot + `Color.lerp(out,…)`); reuse scratch `Vec3`; route coin geyser through phys integrator not per-coin tween pairs — 0 `fromHEX` in per-cell win loops; lower alloc rate.
- **[P2] view/* hygiene** — remove `void i`/`void close` markers (2625/2573); type `(n as unknown as {__baseFs})` via WeakMap; gate `console.warn` (ceremony 181/200/264, slot-view 518) behind debug; comment empty `setSteppers(){}` web-bar no-op — lint-clean, no behavior change.

---

## 3. BUILD BATCHES

The Cocos build serializes on the `:7457` lock — one rebuild + one render/measure verify per batch. Batches are ordered so a broken batch can't block the next (config/logic-only batches first; each batch compiles + renders standalone).

### BATCH 1 — Prep gate (theme shim + branding + trivial copy)
**Items:** A-palette shim, A-`POP V2`×2, A-draw-utils, A-SCATTER constant, G-`SYMBOL_DISPLAY`, G-`SYMBOL_NAMES`, G-`RTP_DISPLAY`, G-`maxWinMultiple cap`, G-particle `CANDY`→THEME, G-`PAYLINES.length` caption (P0-4 from review).
**Why first:** unblocks every downstream `THEME` reference; pure token/label/logic-display edits, lowest risk.
**Verify:** `npx tsc --noEmit` (grep own files); `npm test` 75/75; one build → grep `index.html` for no `POP V2`/`Pixi`; static capture: candy labels in paytable, particle bursts pink-led.

### BATCH 2 — Config-only retune (win + ceremony + dim)
**Items:** B-`view-config win` block (staticRing/pulse/bounce/tilt/dim140/haloTint/ring), F-`ceremony.tiers` colors.
**Why second:** pure `view-config.ts` data; gated by tests; renders even before the symbol-view code consumes the flags (old code still valid).
**Verify:** `view-config.test.ts` 11/11; `__v2.ceremony(12/35/60/120)` headers pink/fuchsia/cyan/white; build + capture tier colors.

### BATCH 3 — Win presentation code (symbol-view + win-line)
**Items:** B-`playWin` static-ring gate, B-glow/halo cyan recolor, B-confetti/bubble/sparkle palette, B-win-line/beam cyan, I-rich-cell cap, I-`fromHEX` hoist, B-SCATTER (if not in B1).
**Why third:** depends on BATCH 2 flags; isolated to symbol-view + win-line paint.
**Verify:** `measure-win.mjs` (GPU/ANGLE Playwright, R5) — two-frame `node.scale` identical, `eulerAngles.z===0`, cyan ring sampled, no pink line; `npm test` green.

### BATCH 4 — Cabinet + logo + bars + icons (layout/geometry)
**Items:** C-logo anchor (config) + spFloat, C-`buildFrame` glass cabinet, C-HUD pills, E-mobile bet-menu hit + caret, E-carousel `pillCenterX`, E-44px hit floors (both bars), E-turbo caramel (both), E-glyph stroke floor.
**Why fourth:** geometry cluster; verify together with `canvas-anomaly-detector` containment/onscreen/overlap at both orientations + post-splash desktop capture.
**Verify:** build; desktop post-TAP + mobile captures; containment (cabinet⊇15 cells), logo top-center on-screen, 3 pills non-overlap, carousel 6 cells centered, hit rects ≥44px, turbo caramel both bars.

### BATCH 5 — Menu / Settings / Autoplay (overlays + new seams)
**Items:** D-menu hub rows, D-Settings 6-control + types, D-controller `applySetting`, D-`setBusVolume`/view passthroughs, D-Battery Saver governor+DPR, D-`setLanguage` stub, H-autoplay loss/single-win logic, H-autoplay panel rows + controller wiring, F-buy modal accents+volatility, F-`showConfirm` debit gate, F-FS world tints + HUD mint.
**Why fifth:** largest controller/view surface; new audio/perf seams; overlay mutex. Self-contained — overlays don't affect reels/win.
**Verify:** `tsc` + `npm test` (+ new autoplay tests); manual/`__v2`: 5-row menu, 6-control Settings each driving its subsystem, Battery Saver drops vfx%+DPR≤1, autoplay limits halt, buy confirm gates debit (CANCEL no debit), one overlay active at a time.

### BATCH 6 — Info tabs + ceremony skip + LDW + splash + demo
**Items:** G-4-tab info page (+paylines grid), F-ceremony backdrop-tap skip, H-LDW honesty + `allowLdwCelebration` gate, H-WebGL legal strip, H-tap-to-play gate, H-loader tagline, H-`assemble-demo` v3 slug.
**Why sixth:** index.ejs is outside the Cocos build (rebuild not strictly required for it, but bundle the info/ceremony/LDW code edits here); demo slug runs post-build.
**Verify:** build → grep `index.html` `WEBGL` present / `Pixi` absent; 4 tabs render (paylines lights `PAYLINES[i]`); LDW spin (win≤bet) no ceremony/sting + honest banner; backdrop-tap skips ceremony to exact `winCents`; `node assemble-demo.mjs` logs `✓ shining-pop-v3`.

### BATCH 7 — Perf hardening + hygiene
**Items:** I-particle-pool prealloc/Sprite-at-prealloc, I-`fireEmbers` headroom clamp, I-`tickUTime` active-only, I-reel/symbol idle-update gating, I-art remap (`SYM_RES` ART_REMAP), P2 hygiene sweep.
**Why last:** perf-only + art-index; verified on a GPU/ANGLE profile under a scripted EPIC ceremony so a regression here can't block feature batches.
**Verify:** `cocos-crispstop.mjs` + `vfxStats()` — `live` never pins at 96 on 15-cell win, `emaFps≥55` through EPIC on throttled profile, 0 `addComponent` after warmup; art hierarchy tracks paytable; `npm test` parity green.

---

## 4. RISK + MATH-SAFETY NOTE

**No item touches the math.** Every edit is view / config-token / display-string / view-layer choreography / UI-safeguard logic. Specifically untouched: `PAYTABLE`, `REEL_WEIGHTS`, `PAYLINES`, `BET_LEVELS_CENTS`, `SCATTER_PAY`, `FREE_SPINS_AWARD`, `WILD_STRIKE`, `BONUS_MODES`, `SYMBOLS`, `bonusCost`, spin/bonus engines. Confirmed safe-by-construction:
- **Display strings** (RTP 97.80%, max-win 5,000× via `Math.min(engine,5000)`, candy labels) are disclosure/render only — never recompute a number; `maxWinMultiple` stays engine-derived.
- **Win count-up** = model `winCents` only; do NOT re-multiply by `wildStrike` (already in `winCents`, R6) — the in-grid ×N callout and scatter-pay readout READ `outcome.wildStrike`/`outcome.scatterCents`, never recompute.
- **Quick-bet** stays index-bound to the 6 engine levels (panel size = `BET_LEVELS_CENTS.length`); mobile bet-menu reuses the same `configureQuickBetPanel`/`setBetTo` path — no out-of-range `bet:set`.
- **Buy cost** always `fmt(model.bonusCost(mode))` at live bet; the confirm dialog reuses the cached model-supplied string (R17). Controller `balance<bonusCost` remains the authoritative debit guard.
- **Autoplay loss/single-win limits** are UI safeguards in `logic/autoplay.ts` — they read spin results, never alter RNG/payout; parity gate unaffected.

**Parity/visual tests to keep green:**
- `npm test` (75/75) — `feature.test.ts` (`wildStrikeMultiplier`, `out.wildStrike>=1`, scatter), parity/math-drift gate, autoplay/compliance node:tests (+ new autoplay limit tests).
- `view-config.test.ts` (11/11) — `loserDimOpacity∈[0,255]` (140 OK), `haloTint hotHeat>coldHeat`, `winAnticipation.dip∈(0,1)/ms≤160` (keep valid even when `staticRing` skips it), `beams.*` ranges, `ceremony tiers escalate`, `wildHappyFace` keys, `resolveBigWinTier`.
- `npx tsc --noEmit` — widened `SettingsKey`/`AutoplayPanelConfig`/`infoTab` unions flow clean (grep own files; ignore engine `.d.ts`).

**Cocos gotchas every item must respect:**
- **R1** no `[...Set]` — use `Array.from` (the two existing spreads are on plain arrays, safe; `activeShaderKeys` set must use `Array.from`).
- **R2** no `repeatForever` on destroyable targets — `spFloat` is on build-time `art` (safe); removing `playWin`'s `repeatForever`-on-`node` (B) actively de-risks pooled/FS symbols; ceremony/symbol loops stay `Tween.stopAllByTarget`-stopped.
- **R3** no `depthStencilState` added to any `.effect` — recolor `win-beam` via `sp.color`/vertex, not a stencil block (else glow escapes the board mask).
- **R6** non-finite guards — use `fmt()` (guards `Number.isFinite`) for every cents render; never raw string-concat.
- **R5** swiftshader won't paint shaders — verify shader/fill-rate on d3d11/ANGLE GPU Playwright; Graphics/Label states are swiftshader-renderable.
- **R7** Battery Saver must clamp DPR (`resolutionScale≤1`) + governor ceiling.
- `.clone()` all `THEME.*` Color singletons before per-particle alpha mutation (particle `CANDY`).
- **R12** bars edited in lockstep (hit-floors, turbo caramel, glyph stroke, draw-utils).
- **Build lock**: check for a running `--build` on `:7457` before launching; corrupt editor `window.json`/`layout.json` if `CocosCreator.exe` is killed mid-build (delete the corrupt JSON → full reimport). WORKTREES FORBIDDEN (single shared tree); re-read shared files (`slot-view.ts`) before each apply (parallel-session edit-staleness).

---

## 5. PRODUCTION-READY CHECKLIST (final gates)

- [ ] **tsc clean** — `npx tsc --noEmit` passes on all new/edited files (`palette.ts` shim, widened `SettingsKey`/`AutoplayPanelConfig`/`SettingsPanelConfig`/`infoTab` unions, `draw-utils.ts`, `setBusVolume`/Battery-Saver/`setLanguage` seams); engine `.d.ts` noise ignored.
- [ ] **Tests 75/75** — `npm test` green, including new autoplay loss/single-win-limit node:tests; `view-config.test.ts` 11/11; parity/math-drift gate green (proves zero `logic/` math edits).
- [ ] **Headless build emits index.html** — Cocos `--build web-mobile` produces `build/web-mobile/index.html`; no mid-build corruption.
- [ ] **Demo slug post-build** — `scripts/assemble-demo.mjs` has the v3 entry; `node assemble-demo.mjs` logs `✓ shining-pop-v3` and copies to `public/shining-pop-v3/`; `vercel.json` Pixi `/spine/` rewrite untouched (no v3 rewrite).
- [ ] **Compliance / LDW / autoplay-stop present** — WebGL legal strip (`WEBGL · 18+ · PLAY RESPONSIBLY`, no "Pixi") in built `index.html`; LDW spin (win≤bet) shows no ceremony/sting + honest banner, gated by `allowLdwCelebration` (UKGC/SE/DE neutral); reality-check fires; autoplay loss-limit + single-win-limit + count + stop-on-feature/big-win all halt; explicit tap-to-play audio-unlock gate.
- [ ] **60fps EPIC ceremony** — on a throttled mid-tier GPU/ANGLE profile, `emaFps≥55` through a scripted EPIC ceremony; particle pool `live` never pins at cap (0 `get→null`); 0 `addComponent` after warmup; idle base-game ≤1 shader `setProperty`/frame; Battery Saver drops DPR≤1 + caps particles.
- [ ] **WCAG flash / motion / contrast** — 2.3.1 no harmful flash on ceremony detonation; 2.3.3 reduce-motion suppresses spFloat/jelly/shake/coin/Spine while keeping count-up + ceremony banner; 1.4.3 dimmed losers at ~55% (140/255) keep readable contrast; cyan reserved for win/scatter signal (no collision with cabinet cyan = different surface); all hit targets ≥44×44px.
- [ ] **Visual spec gates** — static cyan win-ring (no scale-pop/jelly/tilt); ceremony tiers pink/fuchsia/cyan/white escalation; cabinet cyan-glass + gold rivets; desktop logo top-center; 5-row menu + 6-control Settings; 4-tab info (Paytable/Paylines/Features/Rules) with candy labels, RTP 97.80%, max-win 5,000×; buy modal cyan/mint/fuchsia + BALANCED/TOP VOLATILITY + confirm-before-debit; both bars caramel turbo + ≥44px hits.

**Final two owner flags (out of frontend scope, deliberate):** (1) ceremony threshold prose (5/15/40/100×) vs code (10/30/50/100×) — only `color` changed to avoid desyncing the audio sting; aligning thresholds is a separate two-site retune. (2) Logo PNG remains the weakest asset (flat bubble-type) — asset refresh, not a code fix. (3) bought STICKY WILDS tile (fuchsia) vs scatter-FS `wilds` world tint (cyan/teal) share mode — tile-accent≠world-tint accepted by design.