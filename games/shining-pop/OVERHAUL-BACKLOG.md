# Shining Pop — Master-Class Overhaul · Status & Next-Session Backlog

_Last updated: 2026-06-10. All "DONE" items are committed + pushed to `origin/main`._

PixiJS v8 flagship slot · `games/shining-pop` · Vite. Big frontend/visual/audio overhaul.

---

## ✅ DONE (pushed to main)

**Audio**
- [x] ElevenLabs mp3 bank actually loads now (first-gesture bootstrap) — was silently failing → everything was the procedural synth.
- [x] Bank compressed **3.3 MB → 1.7 MB** (dropped unused `main/bonus_loop.wav` dupes; `reel_loop`/`coin_cascade` WAV→mp3).
- [x] `reel_loop` de-clicked (crossfade `_makeSeamless`) — killed the ~2 s pop.
- [x] Metallic `spin_start.mp3` disabled → soft procedural press-tick.
- [x] Cute count-up tally pip (triangle + octave sine, was a buzzy square).

**Buy Bonus**
- [x] Candy art wired (`public/assets/images/shining/buy-bonus.png`, black bg auto-keyed).
- [x] Floating button: desktop left-of-reels · mobile bottom-left **2× smaller**.
- [x] Stays **visible during spins** (only hidden while the picker is open).
- [x] VFX: breathe + float loop · BlurFilter glow · ColorMatrixFilter shimmer · elastic press.

**UI / Theme**
- [x] **GAME INFO** entry added to the settings drawer (menu).
- [x] **Candy theme** applied to ALL 3 bar files (`betting-bar-skin/-mobile/-web.js` each had their own crystal palette) — glossy grape-violet, candy-pink edge, cyan glass rim, glassy top-sheen.
- [x] Sound button: explicit pink **mute-slash** (was only a faint dim).

**Bonus scenes**
- [x] Removed the per-mode frame re-tint (`_applyGradeMode` mega `tint(0xff2ad0)` etc.) — "the filter changing render colour is bad". Base grade + hue-neutral brightness only.
- [x] Mega ceremony backdrop near-black `0x05030a` → candy-dark `0x18092e` (first pass on "crown on black").

---

## ⏳ NOT DONE / IN PROGRESS (next session — verify in a REAL browser first)

- [ ] **Verify the candy theme direction** in browser (bars / mega bonus / mute-slash). Palette lives in 3 files + skin — one-place tune if off.
- [ ] **Quick-bets icon → bet menu**: confirm the stack/quick-bets icon opens `showBetMenu()`/`betMenu` (not a tooltip, not buy-bonus). Wire if missing.
- [ ] **Info panel from the menu icon**: today it's menu → settings drawer → GAME INFO. User wants info reachable more directly from the menu icon — make the menu a hub (Settings + Game Info) or add a direct info entry.
- [ ] **Mega "crown on black"**: confirm the warmer backdrop is enough; if still flat, boost the light-pool/pedestal behind the crown or add a candy radial glow.
- [ ] **Volume "many bugs"**: confirm the mute-slash resolves it; check the web-bar volume slider path (`on2('volume')`) for drag/icon bugs.
- [ ] **Mobile ↔ web parity**: autoplay + turbo behave/position differently between `betting-bar-mobile.js` and `-web.js` — reconcile.
- [ ] **Icon quality pass**: menu / sound / stepper / autoplay / turbo glyphs → refine proportions + gloss to top-tier.
- [ ] **Game-wide candy colour consistency**: apply the candy language beyond the bar (modals, HUD, popups) — "theme not unique in other places".

## 🆕 NOT STARTED (improvements to schedule)

- [ ] **Award-winning loader / spinner / intro motion** — deeper GSAP/motion pass (loader already gamified; spinner + transitions next). Skills: `gsap-timeline`, `web-animations`, `pixi-v8-shader-fx-engineering`.
- [ ] **Bonus-scene intro refine** — beyond the colour fix: re-time/re-stage the standard/hot/mega intros for award feel. Skills: `slot-vfx-artist`, `pascal-vfx`, `event-animation-designer`.
- [ ] **`buy-bonus.png` compression** — 601 KB → webp / smaller PNG (proc downscales to 700 at load; only file/inline cost).
- [ ] **Stake single-file build** — inline the audio bank as base64 (`scripts/inline-assets.mjs`) so sounds work in the packaged `dist` (today only dev loads `/assets/audio`).
- [ ] **Run `/casino-ui-ux-audit`** on the bar (30-point) → punch-list.
- [ ] **Run `/stake-approval-visual-gate`** (frontend approval, P0/P1/P2) before submission — focus on visuals/UX.
- [ ] **Unique art direction** — `theme-factory` / `brandkit` / `art-bible` for a distinctive identity.

---

## ⚠️ Hard constraint — verification
The headless preview (Claude_Preview MCP) is **broken for this game**: viewport collapses to 0×0 (workaround `preview_resize` to explicit 1280×800), screenshots hang, and the rAF ticker pauses (GSAP/visibility don't advance live — verify motion by manually advancing `window.gsap.globalTimeline.time(t+0.45)`). **All visual work is done blind and must be eyeballed by Edgar in a real browser** (`http://localhost:5173/`, hard reload). Dev handles exposed on localhost: `window.__SND`, `window.__buyFab`, `window.__buyModal`.
