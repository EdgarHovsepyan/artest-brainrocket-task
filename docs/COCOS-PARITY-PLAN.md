# Shining Pop V2 — Master Parity Plan (Cocos vs the PixiJS flagship)

The complete case inventory: every mechanic, UI element and functional in the
PixiJS flagship, with its Cocos status. ✅ shipped & verified · 🔶 partial ·
⬜ pending. Effort: S < 1h · M = 1-3h · L = a session.

## 1. Core game loop

| Case                                                        | Pixi | Cocos | Notes                                                    |
| ----------------------------------------------------------- | ---- | ----- | -------------------------------------------------------- |
| Spin lifecycle state machine (idle→spinning→resolving→idle) | ✅   | ✅    | explicit FlowState                                       |
| Quick-stop on re-click / Space mid-spin                     | ✅   | ✅    | 0.18s arm delay, stagger cascade                         |
| Server-authoritative money (never re-sum per-event)         | ✅   | ✅    | model owns the ledger                                    |
| Win evaluation parity vs shared math-core                   | ✅   | ✅    | drift-pinned by unit test                                |
| WILD STRIKE base feature (3+ wilds multiply, cap ×3)        | ✅   | ✅    |                                                          |
| Buy-bonus modes (STICKY WILDS / STICKY CROWNS / WILD REELS) | ✅   | ✅    | costs sim-anchored ~96%                                  |
| Natural scatter free-spins trigger                          | ✅   | ⬜ L  | math model extension + wiring of `isFeature` in autoplay |
| Bet Replay mode (`?replay`)                                 | ✅   | ⬜ M  | controls locked, round playback                          |
| Stateless resume (active round on reload)                   | ✅   | ⬜ M  | needs RGS adapter wiring                                 |

## 2. Reels — feel & animation

| Case                                                           | Pixi | Cocos | Notes                                                                        |
| -------------------------------------------------------------- | ---- | ----- | ---------------------------------------------------------------------------- |
| Trapezoidal velocity curve (accel 0.10 / decel 0.34)           | ✅   | ✅    | view-config mirrors master                                                   |
| Stop stagger 88ms L→R, min spin 440ms                          | ✅   | ✅    |                                                                              |
| Anticipatory wind-up kick before launch                        | ✅   | ✅    | OFF mode only                                                                |
| Velocity-coupled motion blur                                   | ✅   | ✅    | vector velocity-stretch in ReelView.update (no shader); reduced-motion gated |
| Land squash + bottom→top symbol ripple per turbo mode          | ✅   | ✅    | `land` table                                                                 |
| Anticipation drag + glow on late reels (2+ early wilds)        | ✅   | ✅    | + anticipation audio                                                         |
| WILD landing strike (punch + hot glow + sample)                | —    | ✅    | Cocos-first; port BACK to Pixi                                               |
| Reel window chrome: per-cell glass plates, cream candy borders | ✅   | 🔶 M  | v2 has glass columns; master's per-cell candy borders pending                |
| 120 fps (uncapped frame rate)                                  | 🔶   | ✅    | Cocos `frameRate=120`; Pixi ticker check pending (Session 1 lane)            |

## 3. Betting bars

| Case                                                                                       | Pixi | Cocos | Notes                               |
| ------------------------------------------------------------------------------------------ | ---- | ----- | ----------------------------------- |
| WEB bar: account / LAST WIN / TOTAL BET / carousel / coins / ×2 / turbo / auto / SPIN ring | ✅   | ✅    | faithful port, screenshot-verified  |
| Swipe bet carousel (drag, snap, center pill)                                               | ✅   | ✅    |                                     |
| Floating VOLUME panel (track, knob, mute, close)                                           | ✅   | ✅    |                                     |
| MOBILE bar (540×684 portrait overlay)                                                      | ✅   | ✅    | pre-existing, candy palette         |
| Orientation-driven bar swap + resize rebuild                                               | n/a  | ✅    | Cocos-specific                      |
| Spin arrow 360° flourish on press                                                          | ✅   | ✅    |                                     |
| Demo-mode ribbon                                                                           | ✅   | ✅    | mobile + web (web added 2026-06-10) |

## 4. Panels & popups

| Case                                                    | Pixi | Cocos | Notes                                             |
| ------------------------------------------------------- | ---- | ----- | ------------------------------------------------- |
| AUTOPLAY (counts, stop-on-feature, stop-on-big-win)     | ✅   | ✅    | logic pure + 9 tests                              |
| SETTINGS (sound / turbo tri-state / reduced FX)         | ✅   | ✅    |                                                   |
| GAME INFO: Rules / Paytable / Info tabs                 | ✅   | ✅    | paytable derives from PAYTABLE data               |
| QUICK BET grid                                          | ✅   | ✅    |                                                   |
| MENU hub (Buy / Quick bet / Info / Settings / Autoplay) | ✅   | ✅    |                                                   |
| Buy menu with mode costs                                | ✅   | ✅    |                                                   |
| Scrollable panel bodies (long content)                  | ✅   | ⬜ M  | v2 content sized-to-fit; mask+drag scroll pending |
| Reality Check (session timer popup)                     | ✅   | ✅    | compliance.ts (5 tests) + showRealityCheck modal  |
| Error modal (dismissible, social-safe text)             | ✅   | ✅    | SlotView.showError + network modal (QA hardening) |
| One-overlay-at-a-time discipline                        | ✅   | ✅    | `closeOverlays()`                                 |

## 5. Win presentation & VFX

| Case                                                                         | Pixi | Cocos | Notes                                  |
| ---------------------------------------------------------------------------- | ---- | ----- | -------------------------------------- |
| Tiered ceremony, CONTINUOUS intensity (rays/shock/shake scale with multiple) | ✅   | ✅    | light-not-box rebuild                  |
| 3-beat choreography (held breath → detonation → savour)                      | ✅   | ✅    |                                        |
| Kinetic count-up + landing pop + tally ticks                                 | ✅   | ✅    |                                        |
| Tap-to-skip ceremonies                                                       | ✅   | ✅    |                                        |
| Win-line cycle presentation                                                  | ✅   | ✅    |                                        |
| Per-symbol win pulse + light-frame                                           | ✅   | ✅    | brand magenta                          |
| Sticky-lock held-glow confirmation                                           | —    | ✅    | Cocos-first                            |
| Shard particle bursts from win cells                                         | ✅   | ✅    | reduced-FX gated                       |
| Spine crown rig in MEGA ceremony                                             | ✅   | ⬜ L  | spine-pixi only; cc.Spine port + atlas |
| Per-mode bonus atmosphere (standard/hot/mega washes)                         | ✅   | ✅    | setBonusAtmosphere cross-fade wash     |
| Free-spin counter HUD (spins left + running total)                           | ✅   | ✅    | setBonusHud strip above board          |

## 6. Audio

| Case                                                      | Pixi | Cocos | Notes                 |
| --------------------------------------------------------- | ---- | ----- | --------------------- |
| 37-clip bank, 4-bus dB mix, sample-first + synth fallback | ✅   | ✅    | same clips, same mix  |
| Music beds with crossfade (base ↔ bonus)                  | ✅   | ✅    |                       |
| Reel rush loop + turbo stops + wild land + sticky lock    | ✅   | ✅    |                       |
| First-gesture-anywhere unlock                             | ✅   | ✅    |                       |
| LDW rule (no triumphant audio ≤1× return)                 | ✅   | ✅    | controller-owned gate |
| Bet tick throttle, modal open/close, buy sounds           | ✅   | ✅    |                       |
| Volume slider drives master gain                          | ✅   | ✅    |                       |

## 7. Boot, intro & identity

| Case                                              | Pixi | Cocos | Notes                                         |
| ------------------------------------------------- | ---- | ----- | --------------------------------------------- |
| Branded HTML loader (logo, gliding bar, shine)    | ✅   | ✅    | build-template port                           |
| Loader progress driven by REAL asset loading      | ✅   | ✅    | hooks cc.assetManager.loadAny in index.ejs    |
| TAP-TO-PLAY intro with logo + pulsing CTA         | ✅   | ✅    |                                               |
| Intro art parity (master uses full art treatment) | ✅   | ✅    | brandFrames.logo + studio mark; verified live |
| Real logo / candy symbols / painted bg            | ✅   | ✅    | black-keyed offline                           |
| Page title + meta branding                        | ✅   | ✅    |                                               |

## 8. Compliance & responsiveness

| Case                                                     | Pixi | Cocos | Notes                      |
| -------------------------------------------------------- | ---- | ----- | -------------------------- |
| Labeled money readouts, 2dp everywhere                   | ✅   | ✅    |                            |
| Bet levels from a designed ladder (never raw arithmetic) | ✅   | ✅    |                            |
| Steppers/buy locked during autoplay + spin               | ✅   | ✅    |                            |
| Reduced-effects accessibility mode                       | ✅   | ✅    | WCAG 2.3.3                 |
| Keyboard map (Space/A/T/M/B/S/I)                         | ✅   | ✅    | I pending wire check       |
| 7-preset no-scroll verification sweep                    | ✅   | ⬜ M  | run the QA loop per preset |
| Silent production console                                | ✅   | ✅    | engine logs only in debug  |
| i18n + multi-currency                                    | ✅   | ⬜ L  | last big parity item       |

## Execution order for the remaining ⬜/🔶

1. **Reel chrome + intro art + loader progress** (the "looks not correct" trio) — M+M+M, one session.
2. **Free-spin counter HUD + bonus atmosphere** — M+M.
3. **Scrollable panels + Reality Check + error modal** — M+M+M.
4. **Motion blur hook** — M.
5. **7-preset sweep + demo ribbon + keyboard I** — S+S+M.
6. **Replay + resume + scatter trigger + i18n + Spine crown** — the L items, one each per session.

## PRIORITY CASE — betting bar quality rewrite (owner review: renders badly)

Owner verdict on the Cocos web bar: element rendering broken/low quality vs the
flagship. Next session executes with the full build->boot->screenshot loop:

1. SCALE: fit() caps bar at 30% viewport height -> elements render tiny at
   1280x720. Use the master rule instead: fitBottom = width-fit (s = viewW/2400,
   cap ~0.62), bar overlays the bottom, board fits ABOVE barTopY (=y+118\*s).
2. LABEL GEOMETRY: lbl() uses contentSize(10,10) + default anchors -> baselines
   and centering drift (BALANCE/value/USD overlap, banner pairs misalign).
   Give every label a real contentSize + explicit anchor; banner pairs need the
   master relayout() (label+value measured, centered as a pair, value shrinks).
3. CAROUSEL: verify Mask.Type.GRAPHICS_RECT clips on 3.8.8 web; cells need
   anchored centers; restyle() pill contrast (dark text on candy pill).
4. CLICK FX: every control gets press scale-in 0.95 + release back (master
   hit() pattern) + ui_click; spin arrow 360 flourish exists - keep.
5. BALANCE: replace string-length currency offset with measured label width
   (force updateRenderData then use UITransform width).
6. REELS CONTAINER: owner wants the flagship container look — dark glass
   window, per-cell cookie tiles (shipped 9b765b0, verify on screen), plus the
   master's outer frame proportions; check symbol cell padding (540px art in
   96px cells may need ~6% inset).
7. After bar reads right: re-screenshot vs the Pixi bar side-by-side and
   iterate until anatomy matches at a glance.

### STATUS 2026-06-10 evening — EXECUTED (two sessions, swept commits 96260bd + 6345c7f + 33e0a7d)

All 7 points shipped and verified on a live build (scene-graph eval + screenshots):

1. ✅ SCALE — width-fit s=min(viewW/2400, 0.62, 0.42·viewH/300), bar docked; board
   contain-fits ABOVE the solid band via `SlotView.setBottomInset`. Live: barScale
   0.5333 @ 1280x720, board 0.8196 @ y+48.5.
2. ✅ LABELS — explicit anchors everywhere; banner pairs now use the TRUE master
   relayout(): caption+value measured (updateRenderData), centred as a pair,
   value shrinks to fit the banner.
3. ✅ CAROUSEL — GRAPHICS_RECT clips on web build; pill contrast in restyle();
   FIXED the 12px drift (track lives under a 12px-inset mask → pill centre in
   track space is 388, not 400). Live: drift exactly 0.
4. ✅ CLICK FX — per-control press 0.94 + spring back (container-per-button);
   every tap emits `ui:click` → controller routes to `audio.click()`. Carousel
   surface is silent (bet:set already ticks). Spin 360° flourish kept + real
   btn_spin art layered on the ring.
5. ✅ BALANCE — measured width (updateRenderData + UITransform) + the master
   shrink-if-wider-than-180px rule; USD rides the measured edge.
6. ✅ REELS CONTAINER — master frame proportions ported: no hard bezel box,
   layered soft pink halo, translucent glass (0.72), smoke-white outer rim +
   pink inner edge, top bevel bands + bottom shadow; cookie tiles verified on
   screen; symbol art inset to CELL·0.92 (`layout.symbolFill`).
7. ✅ Verified on the rebuilt bundle (markers grep + live eval + screenshots).
   Live Pixi side-by-side was NOT obtainable headless (shared preview-server
   registry between parallel sessions + WebGL capture timeout) — parity was
   proven numerically instead (coordinate-faithful port + measured geometry).

Residuals / notes for the next session:

- FS 1.1 type-scale bump (master "bigger all texts") not yet applied to the
  Cocos bar — a fonts pass was in flight in the parallel session at write time.
- Sound-glyph press-scale skipped: glyph draws in a full-bar Graphics canvas
  (scaling pivots at bar origin); needs a local-node restructure first.
- `build/web-mobile/application.js` is READ-LOCKED by an orphaned CocosCreator
  handle (SIGTERM build collision) — until reboot, serve `build-qa/web-mobile`
  (entry `shining-pop-v2-qa2`, :7461, in D:\.claude\launch.json). build-qa/ is
  untracked; do NOT commit it; it goes stale the moment build/ rebuilds.
- Two CLI builds at once SIGTERM each other's build-script worker and corrupt
  ~/.CocosCreator state — serialize builds across sessions (check
  `Win32_Process` for a `--build` CocosCreator first).
