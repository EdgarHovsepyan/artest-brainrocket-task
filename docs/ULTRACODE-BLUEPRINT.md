# SHINING POP — Ultracode Blueprint (handoff to coding models)

> **What this is:** a per-task execution plan for the 7-epic overhaul, grounded against the live `shining-pop-v2` repo (Cocos Creator 3.8.8, web-mobile, strict MVC). Every task carries a **status** (with file evidence), a **target architecture in this codebase**, exact **files**, **ordered steps**, **engine constraints**, **acceptance criteria**, and **risk**. Hand each task card to a coding model verbatim. Obey the **Reality-Check Charter** first — the source spec contains several engine-impossible asks that are corrected here.

---

## 0 · REALITY-CHECK CHARTER (read before any task)

These are non-negotiable for _every_ downstream model. The spec gets them wrong; do not propagate the errors.

1. **Renderer is WebGL2, NOT WebGPU.** `gfx-webgpu` is not compiled into the build and offers zero upside for this 2D batched workload; enabling it risks a blank-canvas backend with no fallback. Every "custom Fragment Shader / GPU-driven / vertex displacement" item = a **CCEffect (`.effect`) material on `Sprite.customMaterial`**, which compiles to GLSL and runs on WebGL2 today. Each shader ships with a **Graphics fallback** and is gated by a global `vfx.materialsEnabled` switch.
2. **No Spine assets exist** (zero skeletons, no runtime wired). Tasks 5.3 (per-symbol Spine) and the Epic-Win mascot are **ASSET-BLOCKED**: flag the art dependency and ship the **all-Graphics fallback** that matches the project's existing FX strategy.
3. **`cc.Graphics` has NO gradients.** Fake depth with stacked alpha rects/discs (the codebase does this everywhere — frame bevel `slot-view.ts:919`, spin ring `betting-bar-web.ts:629`).
4. **`tween()` on a PLAIN object does NOT tick** in this 3.8.8 web runtime. Drive value/number/uniform animation with `Component.schedule` frame-steppers, or tween **Node/Component** props (`UIOpacity.opacity`, node `scale`/`position`/`angle`). A `repeatForever` plain-object tween that redraws a destroyed Graphics crashes — guard `isValid`.
5. **Math/RTP/weights/books are LOCKED.** The frontend only _renders_ the model's numbers. Every "math engine / tier threshold / multiplier" is a **presentation** value — display it, never compute or alter odds. Tier bands (Epic 5) are frontend presentation thresholds and may be re-banded freely.
6. **The "control panel" is the betting bar, not the board deck.** `boot()` calls `view.init(true)` (externalControls), so `slot-view.buildControlDeck` (`slot-view.ts:999`) is dead. There are **two bars**: `betting-bar-web.ts` (landscape) and `betting-bar.ts` (portrait). Several spec items are web-only (x2 gamble, swipe carousel) or portrait-only.
7. **Cover scaling already exists.** Canvas `_alignCanvasWithScreen:true` + the `index.ejs` resize-kick handle the engine cover. The board's own contain-fit is `SlotView.fit()`. Do **not** add `setDesignResolutionSize`/`ResolutionPolicy` — `designWidth/Height 760` is only `fit()`'s denominator.
8. **Zero hardcoding.** Promote magic numbers into `view-config.ts` tunables (see §6) so designers tune feel without code. `fit()` runs on every resize from 5+ paths — keep it cheap (sync `setScale/setPosition`, no allocations, no tween starts inside it).
9. **Verification protocol.** Headless preview throttles the loop and cannot screenshot a full-size canvas. Prove logic/geometry with `cc.game.step()` + `preview_eval` reads; defer the human-eye check to a **real-browser screenshot**. (Eval gotcha: `cc.UITransform`/`cc.UIOpacity` are `undefined` on the global `cc` in the minified build — don't `getComponent(cc.UITransform)` in eval.)

---

## 1 · GLOBAL STATUS DASHBOARD

Legend: ✅ done · 🟡 partial (substrate exists, deltas listed) · ⬜ todo · 🔒 asset-blocked

| #        | Task                                      | Status | One-line reality                                                                                                         |
| -------- | ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1.1      | Viewport cover scaling + boot mask        | 🟡     | Engine cover + HTML `#brandLoader` + resize-kick exist; delta = bg overscan so no letterbox + tunable headroom           |
| 1.2      | Reels re-center + edge artifacts          | 🟡     | Reels already centered at x=0; delta = soft top/bottom **feather** over the hard `GRAPHICS_RECT` mask                    |
| 1.3      | Logo top-left + Buy-FAB + collision guard | 🟡     | Logo upper-left & FAB right-margin already in `fit()`; delta = real **collision clamp** + resolve left/right conflict    |
| 2.1      | Let bg breathe behind bar                 | 🟡     | Flat slab already gone; delta = make the slab **translucent** (alpha tunables)                                           |
| 2.2      | Re-anchor "x2" + padding                  | 🟡     | Already a centered node; delta = extract the magic x into a **gap tunable** (web-only)                                   |
| 2.3      | Quick-bets carousel responsive            | 🟡     | Already hardened (rubber-band, empty-guard, fade); delta = **data-drive** cellW/fade + optional width-measure (web-only) |
| 2.4      | 3D-shaded Spin/Autoplay art               | 🔒     | No art exists. **Track A** Graphics bevel ships now; **Track B** needs `btn_autoplay.png` (RGBA) or a CCEffect gloss     |
| 2.5      | 4 button states + custom cursor + ease    | 🟡     | Press-scale exists; delta = formal idle/hover/pressed/disabled + custom pointer (desktop-gated) + cubic-bezier ease fn   |
| 3.1      | Outside-click-close all popups            | 🟡     | Buy modal has it; 5 panels don't — add one `mkScrim` helper (errorModal/rcModal stay non-dismissible)                    |
| 3.2      | Thematic "X" on every popup               | 🟡     | Buy modal + close X exist; add reusable `mkCloseX` to the 5 panels                                                       |
| 3.3      | Info typography + wrap/bound              | ⬜     | Labels are fixed-decrement, no wrap box — add wrapping `mkLabel` + measured layout (localization-safe)                   |
| 3.4      | Premium menu redesign                     | 🟡     | `surfChrome` exists; delta = row-card menu w/ accent gems + `MENU_PRESENT` table                                         |
| 4.1      | Arcane payline glow                       | 🟡     | Lines already charged L→R + 10-hue + spark; delta = **additive CCEffect bloom** sibling (Graphics stays as fallback)     |
| 4.2      | Reel portal warp + grid merge             | ⬜     | **No cascade mechanic** — re-scope to spin entry/exit warp + one bonus-entry wipe                                        |
| 4.3      | Flanking idle crystals                    | ⬜     | The crystals **don't exist** — build them (Graphics) + idle pulse, optional displacement material                        |
| 4.4      | Intro→game loading mask                   | 🟡     | White-flash/preloader already solved in `index.ejs`; delta = **verify** + optional in-engine cross-dissolve              |
| 4.5      | Buy-Bonus ambient (glint + plasma)        | 🟡     | FAB glow exists; delta = swept **glint** (Graphics, ship-first) + swirling **plasma CCEffect** (real shader)             |
| 5.MATRIX | 4-tier band (Big/Mega/Super/Epic)         | 🟡     | 3-tier continuous engine exists; re-band to 4 + add Super board-dim + panel light                                        |
| 5.1      | Heartbeat payout ticker                   | 🟡     | Count-up is schedule+quartOut; delta = per-milestone **scale-pop** inside the same stepper                               |
| 5.2      | 2-scatter anticipation + aura             | 🟡     | Anticipation layer + decel exist (keyed to wilds); delta = retarget to **scatters** + arcane lightning aura              |
| 5.3      | Per-symbol Spine overhaul                 | 🔒     | No Spine. Ship per-symbol **idle-profile** Graphics fallback; flag skeleton art dependency                               |
| 5.4      | Particle object pool (50–70)              | ⬜     | No pool — build `particle-pool.ts`, refactor `particle-layer` to borrow/return, add coin geyser                          |
| 6.1      | Pre-spin interpolation mask               | 🟡     | Flash already fixed via `pendingFinal`; delta = name the window as a tunable + optional cross-fade                       |
| 6.2      | Elastic over-travel bounce                | 🟡     | The **one genuinely-missing** motion piece — add overshoot+`elasticOut` settle + physics tunables                        |
| 6.3      | Svarka plasma win-line                    | 🟡     | Reveal + spark exist; delta = multi-disc **plasma core** + downward **spark cascade** + symbol shake                     |
| 7.1      | Reels ≥90% width portrait                 | 🟡     | Width term uses 760 envelope; delta = `portraitWidthFill` lever on `gw`                                                  |
| 7.2      | Unified deck: Buy next to Spin            | 🟡     | Mobile bar overhauled; delta = add a **Buy control** in the portrait deck + hide the board FAB in portrait               |
| 7.3      | Clean value capsules / un-squish          | 🟡     | All-Graphics bar (no atlas to redraw) — verify-first, fill-luminance/`fitValue` pass                                     |
| 7.4      | Footer flush band                         | 🟡     | **No broken asset/diagonal exists** — band is already flush; optional divider for visual separation                      |

**Headline for the downstream team:** ~22 of 27 tasks are **partial** (substrate shipped this cycle), only **3 are true todo** (3.3 info-wrap, 4.2 portal, 5.4 pool), and **2 are asset-blocked** (2.4 button art, 5.3 Spine). The high-value _new build_ is the **shared shader-material kit (§5)**, the **particle pool (5.4)**, the **elastic bounce (6.2)**, and the **Svarka/heartbeat juice (6.3/5.1)**.

---

## 2 · CROSS-CUTTING SYSTEMS (build these once; many tasks depend on them)

### CC-1 · Shared CCEffect material kit + master switch _(deps: 4.1, 4.2, 4.3, 4.5, 5.2, 6.3)_

- New folder `assets/resources/effects/` with one `.effect` per FX: `payline-glow`, `reel-portal`, `grid-merge`, `crystal-idle`, `buy-plasma`, `svarka-additive`. All: single technique/pass, `BLEND src=ONE dst=ONE` (additive) or `SRC_ALPHA/ONE`, depthTest/Write off, a `u_time` float uniform.
- `slot-view.loadAssets()` loads each as a `Material` field; pass into the consuming view/reel.
- **Master switch** `VIEW_CONFIG.vfx.materialsEnabled` (default `true`): when false, every consumer skips `customMaterial` and uses its Graphics fallback (low-end devices / shader-regression debugging). Each FX **also** honors `reducedFx`.
- Uniform animation = a `Component.schedule` stepper advancing `u_time` (never a plain-object tween).
- **Contract:** the Graphics layer is always the guaranteed-visible base; the material is an _additive overlay on top_. If the material fails to compile, the game still reads correctly.

### CC-2 · Particle pool _(this is Task 5.4; deps: 6.3 svarka sparks, Epic-win geyser)_

`assets/scripts/view/particle-pool.ts` — fixed ring of pre-built reusable diamond/coin nodes (`Graphics + UIOpacity`); `get()` (null if `liveCount >= poolCap`), `put(n)` resets + deactivates. `particle-layer.burst()` borrows/returns instead of `new/destroy`, animates with **Node tweens**. Add `sparkCascade(x,y)` (6.3) + `coinGeyser()` (Epic-win). Pre-draw the shape once; retint on borrow.

### CC-3 · Formalized reel state machine _(deps: 6.1, 6.2; mostly already implemented in `reel-view.ts`)_

`IDLE → ANTICIPATION RECOIL → TRANSITION BLUR(launching gate) → HIGH-SPEED LOOP(reelEase cruise) → DECELERATION → ELASTIC OVER-TRAVEL → STABLE(settle drops pendingFinal + playLand)`. Recoil, blur-gate, trapezoid cruise/decel, and deferred-result already exist; **6.2 adds the over-travel bounce segment.** Drive everything off `VIEW_CONFIG.spin.*`.

### CC-4 · `view-config.ts` tunable surface

All new tunables consolidated in §6. The rule: **no magic numbers in components** — every feel/threshold/geometry value a designer might touch lives in `view-config`.

---

## 3 · PER-TASK BLUEPRINT CARDS

> Format per card: **Target** · **Files** · **Steps** · **Constraints** · **Accept** · **Risk**. Truly-done substrate is noted so models don't rebuild it.

### EPIC 1 — Global Layout & Canvas Architecture

**1.1 Viewport cover + boot mask (🟡)**

- **Target:** keep engine cover + `index.ejs` resize-kick + the HTML `#brandLoader`. Decouple the painted bg from letterboxing by **oversizing** the bg base + `bg_art` (they're board children, so scaling them at source guarantees bleed). Replace magic `contentTop=410`/`gap=34` with tunables.
- **Files:** `slot-view.ts` (`fit()` band math, `buildBackground()`), `view-config.ts`, `index.ejs` (verify only).
- **Steps:** add `layout.contentTopPx:410`, `layout.boardBottomGapPx:34`, `layout.bgCoverOverscan:1.15`; swap the literals in `fit()`; multiply bg base-fill + `bg_art` size by `bgCoverOverscan`; verify `#brandLoader` fades only after `director.getScene()` is up (no half-built flash).
- **Constraints:** no `ResolutionPolicy`; bg overscan via stacked rect/sprite (no gradient); `fit()` stays synchronous.
- **Accept:** no `#0a0610` band at 16:9/21:9/9:16/9:21 (real-browser); headless eval `bgNode.worldBounds ≥ getVisibleSize()` on ultrawide + tall; loader never reveals a half-built board.
- **Risk:** medium — keep bg a board child (oversized), don't double-apply scale.

**1.2 Reels re-center + edge feather (🟡)**

- **Target:** centering is already correct (`reelsRoot` at x=0, symmetric reels). Add a **top+bottom edge feather** (5 stacked translucent dark rects fading inward over `windowFeatherPx`) drawn on a node above the masked strip so symbols dissolve into the bezel instead of snapping at the `GRAPHICS_RECT` mask edge.
- **Files:** `slot-view.ts` (`buildFrame()` feather, `buildReels()` centre-guard comment), `reel-view.ts` (confirm mask `windowH`), `view-config.ts` (`layout.windowFeatherPx:18`).
- **Steps:** add the feather node after `reelsRoot` (higher siblingIndex), spanning `gw`, mirrored top/bottom; assert reel x stays 0.
- **Accept:** headless eval reels x=0 + symmetric reel columns; real-browser shows soft dissolve at top/bottom, no hard cut; no dead band below reels in externalControls.
- **Risk:** low — z-order (feather must render above symbols).

**1.3 Logo top-left + Buy-FAB + collision guard (🟡)**

- **Target:** keep the orientation-gated placement (landscape: logo upper-left 0.6 + FAB right margin; portrait: logo top-centre). Add a real **collision clamp**: `fabDockX(sign)` computes `frameHalfW = (gw+24)/2 + halo`, docks at `sign*(frameHalfW + gap + fabHalfW)`, clamps inner edge ≥ `frameHalfW + minClearance` and outer edge ≤ `screenHalfW/scale − edgePad` (shrink/hide on narrow viewports). **Resolve the spec conflict:** portrait = Buy lives in the mobile deck (Task 7.2) so **hide** the board FAB in portrait; landscape = right-margin FAB. Promote magic numbers (14/100/322/0.6/30) to `layout.fab{}` / `layout.logo{}`.
- **Files:** `slot-view.ts` (`buildBuyFab`, `fit()` FAB/logo block, new `fabDockX`), `view-config.ts`, `betting-bar.ts` (confirm portrait Buy exists before hiding FAB).
- **Accept:** collision assertion `|buyFab.x| − fabHalfW ≥ frameHalfW + minClearance` both orientations; portrait `buyFab.active===false` AND buy reachable via the bar; narrow-landscape FAB never clips off-screen.
- **Risk:** medium — only hide the portrait FAB once 7.2's deck Buy exists; guard re-docking against `buyModal.isOpen()`.

### EPIC 2 — Control Panel & Button Gamification

**2.1 Let bg breathe (🟡)** — slab already slim. **Target:** make it a translucent wash via `bar.web.{bgBaseAlpha:0.62,bgGroundAlpha:0.55,bgGroundFrac:0.6}` + `bar.mobile.{bandAlpha:0.9,fadeAboveBandPx:24}`; soften the mobile `BAND_TOP` cut with a short stacked-alpha fade. **Files:** `betting-bar-web.ts` (onLoad bg 122-142), `betting-bar.ts` (`drawDecor` 207-269), `view-config.ts`. **Accept:** bg readable through upper bar, values stay high-contrast (add per-readout backing chip if they wash), `fit()` inset unchanged. **Risk:** low.

**2.2 Re-anchor x2 (🟡, web-only)** — already a centered node. **Target:** `gambleX = clusterCoinsX + bar.web.gambleGapPx(110)`. **Files:** `betting-bar-web.ts` `buildRightCluster` 520-596. **Accept:** eval x-delta == `gambleGapPx`, 76px hit rects don't intersect, `bet:double` still fires. **Risk:** very low.

**2.3 Quick-bets carousel (🟡, web-only)** — already rubber-banded + empty-guarded + fade-clamped. **Target:** data-drive `bar.web.carousel.{cellW,pillCenterX,fadeScale[],fadeOpacity[]}`; optional measure widest value (`updateRenderData`) so wide currencies never crop. **Files:** `betting-bar-web.ts` 393-506, 921-970. **Accept:** `cells.length===levels.length`, cells at d≥2 opacity 0, drag clamps to ±1 cell, mid-scroll never clips. **Risk:** low (call `updateRenderData` before width read).

**2.4 Spin/Autoplay art (🔒)** — **Track A (ship now):** fake-3D bevel on circle buttons (bottom-shadow arc + top sheen ellipse + inner AO ring, copy spin-ring stacked technique) → `bar.web.buttonBevel.{shadowAlpha,sheenAlpha}`. **Track B (asset-blocked):** add `['ui2/btn_autoplay','autoArt']` to `loadAssets` + a `setAutoplayArt()` mirroring `setSpinArt`, wired in `buildBar` (no-op until art lands). **ASSET REQUEST:** `btn_autoplay.png` (+ optional `btn_turbo.png`) RGBA with `hasAlpha:true`, or a candy-gloss CCEffect. **Accept:** discs read dimensional; absent art falls back silently (no console error / no black box). **Risk:** medium-blocked.

**2.5 4 button states + cursor + ease (🟡)** — press-scale exists. **Target:** formal idle/hover/pressed/disabled per control; **custom pointer** = `document.body.style.cursor='none'` + a follower node, **desktop/landscape-gated**, reverted on touch + teardown; transitions tween the **Node** scale with a custom cubic-bezier `(t)=>number` easing fn. Tunables `bar.buttons.{hoverScale,pressScale,hoverMs,pressMs,releaseMs,ease,enableHover}`, `bar.cursor.useCustom`. **Constraints:** never animate a plain `{scale}` object; hover only where a pointer exists. **Accept:** all 4 states visible in real browser; no OS cursor on desktop + follower tracks; touch devices keep native behavior. **Risk:** medium (cursor-hide accessibility on touch — must gate).

### EPIC 3 — Modals, Menus & UX Flow Purge

**3.1 Outside-click-close (🟡)** — only Buy modal has it. **Target:** one `mkScrim(parent,onTap)` helper (full-bleed Graphics rect @ `PALETTE.scrim` × `modal.scrimAlpha`, TOUCH_END→onTap); wrap the 4 singleton drawers + menuHub in a stable `*Overlay` node holding `[scrim, panel]`, toggle the **overlay's** active. **errorModal + rcModal stay non-dismissible** (compliance — their scrims swallow input). Tunables `modal.{scrimAlpha:0.78,scrimFadeMs:160,dismissOnScrim}`. **Files:** `slot-view.ts`, `view-config.ts`, `palette.ts`. **Accept:** synthesize TOUCH_END on each scrim → overlay `.active=false`; error/RC modals unaffected. **Risk:** low.

**3.2 Thematic "X" (🟡)** — **Target:** reusable `mkCloseX(parent,w,h,onClose)` — faceted crystal backing plate (stacked stops + cyan hairline) + bold X strokes + ≥44px hit + press-squash, at `(w/2−inset, h/2−inset)` in all 5 panels. Tunable `modal.closeX.{size:44,inset:30,strokeWidth:4,hitPadding:6}`. **Accept:** every panel shows a button-like X top-right; tap closes; Info gets X added. **Risk:** low.

**3.3 Info typography + wrap (⬜ — true todo)** — **Target:** add an opt-in wrapping label (`l.overflow=RESIZE_HEIGHT; l.enableWrapText=true` + real content width = panel inner − margins); render `RULES_LINES`/`CONTROLS_LINES` as measured wrapped blocks (decrement y by `label.height + lineGap`, not a fixed 26). Tunables `info.{panelW,panelH,titleSize,headerSize,bodySize,captionSize,lineGap,leftMargin,colGap,maxBodyHeight}`. **Files:** `slot-view.ts` (`buildInfoPanel`, extend `mkLabel`), `view-config.ts`. **Accept:** headless — no body label right-edge exceeds panel inner; lines stack without overlap; a German-length test string still wraps inside the box. **Risk:** low-medium (call layout pass before reading height).

**3.4 Premium menu (🟡)** — **Target:** rewrite `buildMenuHub` into row-cards (candy tile + left accent gem + display-font label + caption + right chevron + press-squash), crystal/neon panel + title divider; add a `MENU_PRESENT` table (accent+caption per entry, mirroring `BUY_PRESENT`). Tunables `menu.{panelW,titleSize,labelSize,captionSize,rowH,rowGap,gemSize,accentAlpha}`. **Accept:** menu reads in-family with the Buy modal (cards + gems + hierarchy), each row opens the right panel. **Risk:** low-medium (sizing/scroll if >5 rows).

### EPIC 4 — Cinematic VFX & Shaders _(all build on CC-1)_

**4.1 Arcane payline glow (🟡)** — **Target:** keep the Graphics `winLineG` stroke as the fallback; add a sibling additive Sprite `winLineGlow` with `payline-glow.effect` (UV-scroll soft-falloff additive bloom) re-positioned/rotated per segment to trace the **same** polyline. Tunables `win.glow.{intensity,scrollSpeed,widthPx,alpha,fallbackEnabled}`. **Accept:** headless — `winLineGlow` exists, active, `customMaterial` non-null; real-browser shows soft bloom hugging each line on top of the crisp stroke; `materialsEnabled=false` → Graphics-only still correct. **Risk:** medium (material load path / batching).

**4.2 Reel portal warp + grid merge (⬜ — true todo, re-scoped)** — **No cascade exists** → re-scope to: portal **entry** glow at spin-start (fired from `reel-view.spinTo` launch), portal **exit** at settle, and one **grid-merge wipe** on bonus entry (`controller.startBonus`). CCEffect `reel-portal.effect` (vertex wobble + chromatic fringe) on thin additive sprites docked at reel top/bottom; `grid-merge.effect` vertical sweep. Graphics fallback = a quick scale/alpha pulse. Tunables `spin.portal.{entryMs,exitMs,warpAmp,fringeColor}`, `bonus.mergeWipe.{ms,dir,fallbackEnabled}`. **Constraints:** confirm-no-cascade with owner; gate under reducedMotion. **Accept:** headless — `reelPortalTop` activates on launch, `reelPortalBottom` on settle; real-browser warp at spin-start/stop + a merge wipe entering bonus. **Risk:** medium.

**4.3 Flanking idle crystals (⬜ — true todo)** — **The crystals don't exist; build them.** Part A: `buildFlankCrystals()` — two faceted-crystal Graphics nodes docked just outside the frame L/R at `reelCenterY`, orientation-gated in `fit()` (portrait right margin holds the FAB → gate via `decor.flankCrystal.portraitVisible`); base idle breathe + glow pulse (Node tween, reducedFx-safe). Part B: optional `crystal-idle.effect` (vertex-displacement wobble + pulse). Tunables `decor.flankCrystal.{sizePx,marginPx,pulseSpeed,displaceAmp,portraitVisible,fallbackEnabled}`. **Accept:** crystals symmetric about x=0 at `reelCenterY`, breathe, don't overlap symbols; portrait honors the gate. **Risk:** medium (don't crowd the FAB/logo margins).

**4.4 Intro→game mask (🟡 — mostly verify)** — white-flash/preloader already solved in `index.ejs`. **Target:** record a boot video proving no white frame (core acceptance — headless can't prove it). If a sliver shows: add a one-shot in-engine `introFade` (full-bleed `#0a0610` UIOpacity 255→0 over `intro.fade.ms`) overlapping the CSS loader fade-out (extend `index.ejs` `.gone` start ~120-240ms) for a cross-dissolve. **Accept:** no white frame first-paint→interactive. **Risk:** low.

**4.5 Buy-Bonus ambient (🟡)** — **Glint (ship-first, Graphics):** copy `symbol-view.playSheen` — a diagonal parallelogram streak swept across the FAB face on a schedule loop, **masked** to the button shape, reducedFx-gated. **Plasma (real shader):** `buy-plasma.effect` (fbm/swirl) on a Sprite clipped to the button frame, additive under the art, `u_time` via schedule; fallback = a slow-rotating tinted Graphics swirl. Tunables `buy.ambient.{glintSweepMs,glintGapMs,plasmaSpeed,plasmaAlpha,fallbackEnabled}`. **Accept:** periodic glint clipped to the button; `buyPlasma` node has non-null `customMaterial`; board still renders if material fails. **Risk:** medium.

### EPIC 5 — Win Celebrations & Core Polish

**5.MATRIX 4-tier band (🟡)** — keep the continuous-intensity engine (superior to stepped popups; already handles >100×). Re-band `ceremony.tiers` to 4 (high→low: EPIC 100 / SUPER 50 / MEGA 30 / BIG 15) + per-tier `{coinParticles,boardDimAlpha(0..0.6, SUPER/EPIC only),panelLight,textPopScale}`; re-map intensity normaliser `t=clamp((multiple−15)/85)` (keep the >100× boost). Super dim = **stacked-alpha vignette** (NOT a real blur — Cocos 2D has no BlurFilter; NO hard black). **Accept:** `__v2.ceremony(18/35/70/150)` → header BIG/MEGA/SUPER/EPIC; Super shows a soft graded dim + lit number panel, never a black box. **Risk:** low (presentation only).

**5.1 Heartbeat ticker (🟡)** — **Target:** inside the existing `tickCount` stepper, on each milestone crossing (10ⁿ boundary or N even steps) set `amountLabel.node` scale to `tier.textPopScale` then decay toward 1 per-frame (`popScale += (1−popScale)*min(1, decayPerSec*dt)`) — beats are dense early, sparse late (the log feel). Tunables `counter.heartbeat.{popScale:1.18,decayPerSec:9,milestoneCount:6}`. **Constraints:** stay in the schedule stepper — never a plain-object tween. **Accept:** eval `amountLabel.node.scale.x` spikes >1 several times during roll, settles ~1; denser early. **Risk:** low.

**5.2 2-scatter anticipation + aura (🟡)** — retarget the trigger from WILD to `SYMBOLS.SCATTER` (`anticipation.minEarlyScatters:2`); keep the existing `extraSeconds` decel. Rebuild `anticipation-layer` aura = stacked-alpha magenta column + jagged lightning polylines re-randomised on a schedule (`boltCount`, `reStrikeMs`, `auraColor`); optional additive CCEffect. **Accept:** reels 3-4 run measurably longer after 0-2 settle; aura column + bolts present during the drag. **Risk:** low-medium.

**5.3 Per-symbol Spine (🔒)** — **ASSET REQUEST:** per-symbol `.skel/.json + atlas` (Spine 3.8) + wire the spine-cocos runtime → `setAnimation('idle'/'anticipation'/'win')` + `setMix(0.15)`. **Fallback (ships now):** `symbols.idleProfiles[id]{amp,freq}` so each symbol breathes at its own rate (`symbol-view.update` uses per-id freq, not the hardcoded 1.9); `symbols.mixSeconds:0.15` as a fake blend on win-state transitions. **Accept:** game builds/runs with no Spine; two different ids show distinct idle scale at the same frame. **Risk:** asset-blocked for the true ask; fallback is low-risk.

**5.4 Particle pool (⬜ — true todo = CC-2)** — build `particle-pool.ts` (cap `particles.poolCap:64`, `prealloc:48`), refactor `particle-layer.burst()` to borrow/return (Node tweens), add `coinGeyser` for Epic-win (`particles.coin.{count:30,launchSpeed:900,gravity:2200,spreadDeg:60}`). **Accept:** child count plateaus ≤ poolCap across 1 vs 10 bursts (reuse, not new/destroy); Epic ceremony fires a coin geyser; 60fps held. **Risk:** medium (reset discipline on `put`).

### EPIC 6 — Motion Dynamics & Reel State Machine

**6.1 Pre-spin mask (🟡 — already glitch-free)** — flash fixed by `pendingFinal` + the `launching` blur gate. **Target:** promote the implicit lock to `spin.preSpinMaskMs:50` (replace the hardcoded 50 at `reel-view.ts:193`); optional UIOpacity cross-fade (window cells dim to `preSpinFadeToAlpha` over the window) only if QA still reports a snap. **Accept:** headless — window cells' `spriteFrame` is UNCHANGED from idle until settle (pendingFinal proven). **Risk:** low.

**6.2 Elastic over-travel bounce (🟡 — THE missing feel piece)** — **Target:** split the stop into 2 strip-Node tween segments: run `reelEase` overshooting to `y = −(cell*overtravelFrac*elasticity)`, then settle to 0 with `easing:'elasticOut'` over `bounceMs*weight`; fire `settle()` (result drop + `playLand`) on the **second** segment's `.call` so the squash coincides with rest. Expose `spin.bounce.{overtravelFrac:0.10,bounceMs:260,easing:'elasticOut',weight:1,speed:1,elasticity:1}`. **Constraints:** these are Node tweens (tick fine); keep reducedMotion = no bounce. **Accept:** headless — `strip.position.y` dips negative then returns to 0; result drops on the rest frame, not the dip bottom; designers can tune weight/elasticity live. **Risk:** low-medium (settle timing).

**6.3 Svarka plasma win-line (🟡)** — **Target:** (A) replace the single `winSpark` diamond with a 3-4 disc **plasma core** (stacked-alpha fake-additive, optional true `svarka-additive.effect` `SRC_ALPHA/ONE`) that pulse-scales as it rides the head; (B) on head-crosses-cell, spit **downward spark cascade** via `particle-pool.sparkCascade` (gravity, lifetime, hot-cyan); (C) winning symbols **shake/pulse** in tandem (`symbol-view` jitter). Tunables `win.svarka.{coreDiscs,corePulseScale,corePulseMs,sparkPerStep,sparkGravity,sparkLifeMs,sparkColor,shakeAmp,shakeMs,additiveMaterial}`. **Constraints:** `cc.Graphics` can't be additive — that's why the bright core is stacked-alpha or a material Sprite. **Accept:** plasma core has ≥3 discs tracking the head; sparks spawn at head + self-expire; symbols shake with the sweep. **Risk:** medium (depends on CC-2 pool).

### EPIC 7 — Mobile-First Architecture _(mobile bar already overhauled by a prior pass — verify + finish)_

**7.1 Reels ≥90% width (🟡)** — the constraint is **width** (the 760 envelope wins in portrait), not height. **Target:** `layout.portraitWidthFill:0.92` + `landscapeWidthFill:1.0`; in `fit()` set `sWidth = isLandscape ? vis.width/designWidth : (vis.width*portraitWidthFill)/gw`, then `s = min(sWidth, availH/contentH)`. **Accept:** portrait `reelsRoot.worldScale.x*512/vis.width ≥ 0.90`; reels stay above the bar band. **Risk:** medium (confirm FAB hidden in portrait per 1.3).

**7.2 Unified deck: Buy next to Spin (🟡)** — **Target:** add `buildBuyControl()` to `betting-bar.ts` (candy pill ~ right of the spin ring, ≥62 design-px hit), emit a new `'buy'` event; wire `this.bar.on('buy', ()=>view.openBuyMenu())` + `view.setBuyFabVisible(false)` in the portrait `buildBar` branch; add `setBuyEnabled` for spin/bonus gating. Tunables `bar.buyControl.{x,y,size}`. **Accept:** portrait Buy in the deck opens the modal; board FAB hidden in portrait; landscape unchanged. **Risk:** low-medium (bar union type needs the event).

**7.3 Clean capsules / un-squish (🟡)** — **No atlas exists (all Graphics)** → verify-first with a portrait screenshot, then a fill-luminance / `fitValue` maxW pass; confirm spin ring scale is uniform. Tunable `bar.capsule.{fill,radius,edgeWidth}`. **Accept:** clean rounded capsules, legible values, uniform spin at a 1,000,000.00 balance. **Risk:** low.

**7.4 Footer flush band (🟡)** — **No broken asset/diagonal exists** (grep-confirmed) → "delete" is N/A. Band is already flush + safe-area-lifted. Optional: a hairline divider between the control cluster and the account row. Tunables `bar.footer.{y,height,dividerY}`, promote `BAND_TOP` to config. **Accept:** footer reads as a distinct flush band, lifts above the home indicator with a simulated safe-area inset. **Risk:** very low.

---

## 4 · ASSET REQUEST LIST (unblocks 🔒 tasks)

| Asset                                                      | For                | Spec                                                                                                                                       |
| ---------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ui2/btn_autoplay.png` (+ optional `btn_turbo.png`)        | 2.4 Track B        | RGBA, **`hasAlpha:true` in `.meta`** (this project hit + fixed a black-box alpha bug — see `buy_bonus.png` re-key), pre-rendered 3D-shaded |
| Per-symbol Spine skeletons `.skel/.json + atlas` (×10 ids) | 5.3                | Spine 3.8, animations `idle`/`anticipation`/`win`, authored for `setMix(0.15)`                                                             |
| Epic-win mascot Spine                                      | 5.MATRIX Epic tier | looping celebration skeleton                                                                                                               |
| (Optional) candy-gloss / plasma `.effect` materials        | 2.4/4.5            | if pre-rendered art isn't produced, author CCEffect instead                                                                                |

Until each lands, the listed **Graphics/idle-profile fallbacks ship the game** at PREMIUM tier (just short of the art-dependent ceiling).

---

## 5 · SEQUENCING (waves for the downstream team)

1. **Wave A — Foundations & shared systems:** CC-1 material kit + master switch, CC-2 particle pool, CC-4 tunable surface. (Unblocks Epic 4/5/6 FX.)
2. **Wave B — Feel & motion (highest player-felt ROI):** 6.2 elastic bounce, 6.1 mask formalize, 5.1 heartbeat, 5.MATRIX re-band. (Pure tunable/Node-tween work; no assets.)
3. **Wave C — Shader overlays:** 4.1 payline glow, 6.3 Svarka, 4.5 plasma, 4.3 crystals, 4.2 portal, 5.2 aura. (Each = CCEffect + Graphics fallback.)
4. **Wave D — UX purge:** 3.1 outside-click, 3.2 close-X, 3.3 info-wrap, 3.4 menu, 2.5 button states, 2.1/2.2/2.3 bar cosmetics.
5. **Wave E — Layout verify/finish:** 1.1/1.2/1.3 collision + feather + overscan, 7.1 width-fill, 7.2 deck Buy, 7.3/7.4 capsule/footer verify.
6. **Wave F — Asset-dependent:** 2.4 Track B, 5.3 Spine, Epic-win mascot — when art lands.

---

## 6 · CONSOLIDATED `view-config.ts` TUNABLE SURFACE (the design control panel)

```
layout: { contentTopPx, boardBottomGapPx, bgCoverOverscan, windowFeatherPx,
          portraitWidthFill, landscapeWidthFill,
          fab:{sizePx,gapPx,minClearancePx,edgePadPx},
          logo:{topY,landscapeY,landscapeScale,landscapeLeftInset} }
vfx:    { materialsEnabled }                       // master shader kill-switch
bar:    { web:{ bgBaseAlpha,bgGroundAlpha,bgGroundFrac, gambleGapPx,clusterCoinsX,
                carousel:{cellW,pillCenterX,fadeScale[],fadeOpacity[]},
                buttonBevel:{shadowAlpha,sheenAlpha} },
          mobile:{ bandAlpha,fadeAboveBandPx },
          buttons:{hoverScale,pressScale,hoverMs,pressMs,releaseMs,ease,enableHover},
          cursor:{useCustom}, buyControl:{x,y,size}, capsule:{fill,radius,edgeWidth},
          footer:{y,height,dividerY}, bandTop }
modal:  { scrimAlpha,scrimFadeMs,dismissOnScrim, closeX:{size,inset,strokeWidth,hitPadding} }
info:   { panelW,panelH,titleSize,headerSize,bodySize,captionSize,lineGap,leftMargin,colGap,maxBodyHeight }
menu:   { panelW,titleSize,labelSize,captionSize,rowH,rowGap,gemSize,accentAlpha }   // + MENU_PRESENT table
spin:   { preSpinMaskMs, preSpinFadeToAlpha,
          portal:{entryMs,exitMs,warpAmp,fringeColor},
          bounce:{overtravelFrac,bounceMs,easing,weight,speed,elasticity} }
win:    { glow:{intensity,scrollSpeed,widthPx,alpha,fallbackEnabled},
          svarka:{coreDiscs,corePulseScale,corePulseMs,sparkPerStep,sparkGravity,sparkLifeMs,sparkColor,shakeAmp,shakeMs,additiveMaterial} }
ceremony.tiers: [EPIC100,SUPER50,MEGA30,BIG15] each {color,shakeAmp,coinParticles,boardDimAlpha,panelLight,textPopScale}
counter.heartbeat: {popScale,decayPerSec,milestoneCount}
anticipation: {minEarlyScatters,boltCount,reStrikeMs,auraColor,extraSeconds}
symbols: {mixSeconds, idleProfiles[]{amp,freq}}
particles: {poolCap,prealloc, coin:{count,launchSpeed,gravity,spreadDeg}}
decor.flankCrystal: {sizePx,marginPx,pulseSpeed,displaceAmp,portraitVisible,fallbackEnabled}
bonus.mergeWipe: {ms,dir,fallbackEnabled}
intro.fade: {ms,holdMs,color}
buy.ambient: {glintSweepMs,glintGapMs,plasmaSpeed,plasmaAlpha,fallbackEnabled}
```

---

## 7 · HANDOFF GUARDRAILS (prepend to every coding-model prompt)

- Frontend/visual only — never touch `logic/`, `model/`, RTP, weights, books.
- WebGL2 + CCEffect, never WebGPU. No Spine unless skeleton art is attached. No `cc.Graphics` gradients. No plain-object tweens — `schedule` or Node/Component tweens only.
- Every magic number → a `view-config` tunable. Every shader → a Graphics fallback + honors `vfx.materialsEnabled` + `reducedFx`.
- Build: `& 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe' --project D:\projects\artest-brainrocket\games\shining-pop-v2 --build 'platform=web-mobile;debug=false;buildPath=project://build-qa'` (exit 0/36 = success).
- DoD per task: `tsc` clean for `assets/scripts`, 44/44 node tests green, the task's acceptance criteria proven via `cc.game.step()`+`preview_eval`, and a real-browser screenshot for anything visual.
- Mobile (`betting-bar.ts`) was recently overhauled by a parallel stream — verify before editing; don't regress the landscape web bar (shared `fit()`).
