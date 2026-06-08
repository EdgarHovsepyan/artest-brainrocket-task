# CLAUDE.md — SHINING POP (master onboarding for every session)

> **Read this first.** It is the single source of truth for working on this game.
> The deep playbook is `docs/blueprints/11_RESPONSIVE_BAR_AND_STAKE_BUILD_PLAYBOOK.md`
> (DPR testing, the responsive bar model, the build pipeline, fixed bugs, the debug API).

---

## 1. What this is

**SHINING POP** — a **Stake Engine** compatible **5×3** video slot (5 reels × 3 rows, **10 fixed paylines**; `REELS=5, ROWS=3, NLINES=10` at `src/game/shining-pop.game.js:242`). Black / dark theme. **Art is now a candy / cream-gloss set** (mint + pink symbols, cream borders, candy logo + 3D-candy bg — `71345f5`), layered over the existing **neon-magenta villain VFX/UI** (win-lines, modals, ceremonies). Whether to recolour the VFX to candy or keep magenta as contrast is an **OPEN palette decision** (owner-driven). Studio brand: **EXTRA STUDIO**.
3 free-spin bonus modes: **STANDARD / HOT / MEGA**. Buy Bonus available.
> **Art pipeline / reskin / compression / dist-cleanup:** see `docs/blueprints/12_ASSET_PIPELINE_AND_CANDY_RESKIN.md` (the engine **black-keys** all proc'd art → deliver symbols/tiers/logo **on solid black**; `bg.jpg` is raw).

- **Engine:** PixiJS **v8** + Vite 5 + `vite-plugin-singlefile`. No framework, no Spine in prod.
- **The whole game is ONE file:** `src/game/shining-pop.game.js` (~10k lines). Inline `<style>`/fonts live in `index.html`. Everything (state machine, RGS client, layout, render loop, VFX, procedural Web-Audio sound, all modals) is in that one JS file.
- Procedural canvas VFX only — **no GLSL custom shaders** (approval-fatal on Stake), no image-gen.

## 2. Repo & locations

| What | Where |
|---|---|
| **Git repo** | `github.com/EdgarHovsepyan/extra-studio.git` · branch **`feat/magenta-villain-reskin`** |
| **Project root (cwd)** | `C:\Users\edgar\OneDrive\Desktop\shining-pop-studio\` |
| **The game** | `src/game/shining-pop.game.js` |
| **Build scripts** | `scripts/inline-assets.mjs` (base64-inline for single file), `scripts/package-stake.mjs` |
| **Fonts / assets** | `public/assets/fonts/*.woff2`, `public/assets/images/shining/*.jpg` |
| **Docs / blueprints** | `docs/blueprints/` (esp. `11_*` playbook), `docs/ARCHITECTURE.md` |
| **Skills (reference)** | `skills/` (stake-engine-architect, book-generator, etc.) |
| **STAKE UPLOAD DELIVERABLE** | `C:\Users\edgar\OneDrive\Desktop\STAKE-BUILDS\shining-pop\` → `front/index.html` (+ `front.zip`) and `math/` (LOCKED, + `math.zip`) and `store-tiles/`. **This is what you upload to Stake ACP.** It is NOT a git repo — copy the built file in after each build. (`_archive/` there is old duplicates, safe to ignore/delete.) |

## 3. Commands

```bash
npm run dev            # vite dev server → http://localhost:5173  (HMR; live coding)
npm run build          # vite build → dist/ (index.html + external assets/) — THE OWNER PLAYS THIS (served on :8124)
npm run build:stake    # vite build + inline-assets.mjs → stake-build/front/index.html (self-contained ~2.7MB)
npm run package:stake  # build:stake + package-stake.mjs (writes stake-build/front + back + READMEs)
```
After `package:stake`, **copy `stake-build/front/index.html` → `STAKE-BUILDS/shining-pop/front/index.html`** and regenerate `front.zip` (Compress-Archive of that one file).

**Owner's local-play loop (the canonical preview).** The owner serves `dist/` via `http-server ./dist -p 8124` and opens **`http://localhost:8124/index.html?lang=en&currency=USD`**. So after ANY source edit: run **`npm run build`** → `dist/` updates → the owner refreshes the tab (`Ctrl+R`). ⚠ `dist/` is MULTI-FILE (external `assets/`) = the LOCAL play build, **NOT** the Stake upload. The Stake upload is the single-file `front/index.html` (self-contained) — keep it synced separately and **never upload `dist/` to Stake** (external resources = reject). Three artifacts, one source: `dist/` (8124, local play) · `front/index.html` (Stake upload) · `:5173` (dev HMR).

URL params: `?debug=true` (exposes `window.__app` + `window.__dbg`, un-silences console), `?replay=true`, `?social=true`, `?currency=BTC`, `?lang=ja`, `?device=mobile`, `?rgs_url=…`.

## 4. HARD RULES (violating these = broken game or Stake rejection)

- **Math is LOCKED** (approved). Never touch `STAKE-BUILDS/shining-pop/math/` (RTP / books / weights / `index.json`). Modes + costs: `base 1.0 · bonus_standard 23.82 · bonus_hot 121.29 · bonus_mega 173.57`.
- **Console MUST be silent** in production. Gate every `console.*` behind `?debug=true`. Verify: serve the built file WITHOUT `?debug` → 0 messages.
- **No custom GLSL** (approval-fatal). **No `Math.random`** — use the seeded `vrnd()`. **No external resources** (CDN/fonts/scripts) — everything is bundled/inlined.
- **7 Stake presets, no scrolling** anywhere except info-modal/autoplay body. Presets: Desktop 1200×675 · Laptop 1024×576 · Popout L 800×450 · **Popout S 400×225 (hardest — `tiny`)** · Mobile L 425×812 · M 375×667 · S 320×568.
- **UKGC LDW:** a return ≤1× must NOT play triumphant audio/visual.
- **Never hardcode** bet levels or currency symbols (read from `/wallet/authenticate`). Every numeric readout must be **labeled** (BALANCE / WIN / BET). Keep `+` visible at max bet.
- **Bet Replay** (`?replay=true`) is mandatory for approval; disable stepper/autoplay/sound/spin in replay.
- Commit / push **only when asked**. Branch is a feature branch — commit there. End commit messages with the `Co-Authored-By: Claude …` trailer.

## 5. Critical learnings (the durable gotchas — don't relearn the hard way)

- **Headless DPR = 0.8.** In Playwright, `resize(W,H)` makes the game see `window.innerWidth = W/0.8`. To test a real preset set **viewport = preset × 0.8** (e.g. Popout S 400×225 → viewport `320×180`; Mobile S 320×568 → `256×454`). Always verify `__app.screen.{width,height}` == the target. There's a ~1200px max-canvas cap. `tiny = app.screen.height < 330`.
- **ALWAYS verify by SERVING the built single file**, not just dev. Dev serves real asset files and masks build bugs. `inline-assets.mjs` auto-discovers `public/assets/images/shining/*.jpg` (`readdirSync`) — a hardcoded list once dropped the Buy-Bonus tier images → "ASSET LOAD FAILED" on a standalone serve. Healthy build log: `SH-concat … inlined: 16`, `CDN 4 -> 0`, `remaining external assets/ refs: 0`.
- **Fonts in the single file** are base64-inlined `@font-face` (Fredoka + Luckiest Guy). Under `file://` browsers block `data:` `@font-face` → a FontFace-API fallback (in boot, after `document.fonts.load`) re-loads them. Served over http (Stake) it's a no-op.
- **Render resolution = devicePixelRatio** for retina crispness (PixiJS v8 best practice). `_pickRes(w,h)` caps **2× on weak GPU / 3× on strong** — never 1.5× (that's upscale blur on real phones). `_gpuWeak` (mobile + ≤4 cores OR ≤4 GB) gates heavy VFX via `fxScale`, NOT base resolution.
- **`fitW(sprite,w)`** scales by `sprite.texture.width` — it is a SPRITE fit. Applying it to a **Graphics** (no `.texture`) → `scale = NaN` → invisible **in prod only**. Never `fitW` a Graphics.
- **Bottom-bar WIN slot (portrait):** WIN lives in a slot `[balanceValue.right+gap, SPIN.left−gap]`, re-derived **every frame** in the render loop from the live balance width (the balance coin-up / win credits change widths after `layout()`). SPIN spans both rows, so WIN's right bound is SPIN's left edge.
- **`modalIn` captures the resting-Y FRESH each open** (not a permanent cache) — a cached Y goes stale after a resize/rotation and the modal opens off-screen at the old centre.
- **Bet selector = a swipe CAROUSEL** (single horizontal row, drag→snap→select, centred tile = selection, `‹ ›` nudge, tap-to-jump). Drag uses v8 `globalpointermove`.
- **Scale-compensated hit areas (recurring bug — fixed for icons AND +/− steppers).** Any tappable built from a sprite scaled via `fitW()` gets `scale ≈ 0.1`, so a raw local `hitArea = Rectangle(-26,-26,52,52)` renders to ~5–8 px on screen → "can't click". Fix: size the LOCAL rect = `targetPx / scale` so the SCREEN target is ≥48 px (e.g. `railPitch/s`, `Math.max(48,stepSz+14)/s`). Verify: on-screen size = `hitArea.width × worldTransform scale`.
- **Server-authoritative money.** Credit `serverTotalX6 = round(betX6 * result.payX100 / 100)`, NEVER the per-event re-sum (`baseWinX6 + fsWinX6`) — round-then-sum drifts from the server total (±0.01 = Stake reject). Per-event amounts drive the reveal DISPLAY only.
- **`settleRound` MUST have a `catch`.** A throw in the settle/ceremony chain otherwise leaves `State.phase` stuck (every future spin no-ops = soft-lock) AND skips `finishRound` (the RGS round never ends). Catch → `RGS.endRound`, `stopAutoplay`, IDLE, dismissible error. Plus a `window 'unhandledrejection'` swallow in prod (keeps the console silent).
- **Win-line z-order.** The paylines PREVIEW (`linesPreviewG`) renders UNDER the symbols (inserted below `reelsWrap`) — an elegant under-shine, NOT an overlay covering the fruit. The win-REVEAL laser (`lineG` z80) stays ON TOP of the popped hero symbols (intended/dramatic).
- **FS-win finale tier.** Don't floor the ceremony tier at 5 (MEGA) — it nukes a modest win with 12 rays + dual rings + lightning. Floor at 3 (NICE) and let the realised win scale it up. Celebrations are interruptible: tap/Space sets `winFx.fastFwd` → existing teardown.
- **THE stale-build trap.** The live `stake-engine.com` build is frequently WEEKS old (the upload needs a human Stake login — an agent can't OAuth). Most "still broken" reports are the old deployed build. ALWAYS test the current build (`npm run dev` / a local serve of the built file), and re-upload after changes.
- **One writer per file.** Two Claude sessions editing `src/game/shining-pop.game.js` (one 10k-line file) WILL clobber each other. Coordinate: one owns source edits, the other does QA/build/upload.
- **Two-writer split via `:5173`.** When two sessions ARE running, the established split is: **parallel session owns source edits**; the QA session **verifies on `localhost:5173`** (vite dev / HMR — reflects source instantly, no build step). `:8124` (dist) is only for the OWNER's local-play loop (refreshed by `npm run build`) and for final Stake-build parity tests. Three serve-targets, one source: `5173` (HMR / live source) → `8124` (dist / owner local-play) → `STAKE-BUILDS/.../front/index.html` (single-file Stake deliverable). Trying to source-edit while the parallel session is active reproducibly hits *"file has been modified since read"* — surface it, don't fight it. (2026-06-05.)
- **Stage-level `ColorMatrixFilter` + `setGradeMode()` for per-bonus grade modulation.** ★★★ #1 shipped this pattern (`src/game/shining-pop.game.js` ~:1647): ONE built-in `ColorMatrixFilter` on `app.stage` with `contrast(0.12) → saturate(0.16) → +faint magenta-warm matrix offsets`, `filterArea = app.screen` (pins region so Pixi skips per-frame `getBounds()`), then a `_baseGradeMatrix` snapshot + `setGradeMode('base'|'bonus_standard'|'bonus_hot'|'bonus_mega')` that re-loads the baseline and composes the mode's tint (`saturate`/`brightness`/`contrast`/`tint` ops with `multiply=true`). Transition via `filter.alpha` pump (~280 ms out → reapply matrix → ~320 ms in) — reads as a brief grade dissolve, no scene-graph reflow, one filter pass per frame. Studio-tier cohesion + audit-clean (no custom GLSL). The base setup composes its mode tint with the saved baseline matrix on every mode change to avoid drift.
- **DPR in Claude's browsers ≠ the playbook's 0.8.** The Chrome-DevTools MCP `emulate` sets DPR directly — use `viewport: "393x852x3,mobile,touch"` to test true retina mobile; the Playwright MCP runs at DPR 1. (The 0.8 figure is specific to the playbook's own Playwright harness.)
- **PixiJS v8.3 rename: `BlurFilter.blur{X,Y}` → `strength{X,Y}`.** `blurX`/`blurY` setters are still present (back-compat) but emit `console.warn` deprecation → Stake §4 console-silence violation the moment the filter is used. Always use `strengthX`/`strengthY` on per-axis access; keep `.strength` for uniform.

## 6. Debug API (`?debug=true`)

- `window.__app` — the PIXI `Application` (`__app.screen`, `__app.renderer`, `__app.canvas`).
- `window.__dbg` — `{ State, reels, RGS, Phase, COMPLY, STAKE, layout, startSpin, evalGrid, celebrate, flashWinValue, showFeatureBanner, showInfoModal, populateInfoTab, openDrawer, showBuyBonusModal, showRealityCheck, showError, showLinesPreview, playMegaLogoCeremony, playStandardFsCeremony, playHotFsCeremony, Sound, CELL, spinBtn, minusBtn, plusBtn, winValue, winLabel, showBetMenu, hideBetMenu, betMenu, betValue, bmtSnapTo, bmtCentered, … }`.
- Pixi v8 `getBounds()` → read `.rectangle` for screen-space coords. No `Math.random`/`Date.now` in deterministic paths.

## 7. Verification workflow

Test on **`localhost:5173`** with Playwright. Resize to `preset × 0.8`, open the relevant UI via `__dbg`, read geometry with `getBounds().rectangle`, screenshot. The Stake sandbox URL with `redirect=http://localhost:5173/` loads this dev build in a preset-sized iframe (= reproduces the sandbox). Trigger a win with `__dbg.flashWinValue(amountX6, mx100)`. Synthetic pointer DRAG doesn't trigger PixiJS `globalpointermove` in headless — verify drag logic via exposed fns / real device.

## 8. Status (2026-06-05)

**Latest (2026-06-05 evening) — Responsive audit + 9 Popout-S P0s SHIPPED:**
- **Multi-agent responsive audit** (wf `629b9f7d-7d0`, 12 agents in parallel) surveyed all 10 surfaces × 4 small presets (Popout S / Mobile S / M / Laptop) → identified **19 P0 Popout-S blockers + 77 total items**. Full backlog persisted at `docs/RESPONSIVE_AUDIT_2026-06-04.json`.
- **16 P0s shipped** to `feat/magenta-villain-reskin` across commits `8eec08e`, `d0bec5d`, `d791630`, `5e37eb7`, `e0175d2`, `eeafe44`, plus the in-session Buy Bonus + Info modal fitScale fixes earlier:
  - **RESP-01** Reality Check modal `_fitScale=0.64` (was cardH 336 > 225 viewport → CONTINUE/STOP unreachable). `~:4549`.
  - **RESP-03** Spin button explicit viewport floor `2*(H − barY − barH/2 − padB)` (shadow was clipping 4-8px). `~:6618`.
  - **RESP-04** Stepper `hitArea` formula `Math.max(44/s, stepSz+14)/s` (renders >=44px screen regardless of sprite scale). `~:6637`.
  - **RESP-05** HUD `labelSz` floor `tiny ? 0.92 : 0.72` (BALANCE was 8.79px illegible at Popout S). `~:6680`.
  - **RESP-06/11** `styleClose()` now scale-compensates the close-button `hitArea` from `parent._fitScale` → fixes EVERY modal's close in one helper (Buy/Bet/Info/RC/Settings all >=44px screen). `~:3037`.
  - **RESP-07** Buy modal text `_minPx(basePx, screenMin=11)` floor on `bmTitle/bmDesc/bmWarn` — disclaimer was 5px (illegal/illegible) → now >=11px screen. `~:3357`.
  - **Buy Bonus modal `_fitScale`** (mirrors layoutBetMenu pattern). At Popout S `_fitScale=0.502` → full modal reachable (was: title cut top, CANCEL/BUY cut bottom). `~:3340`.
  - **Info modal `_fitScale`** keyed off `cardContentNeed=320` so HOW-TO-PLAY rules visible (was: line 5 of 6 cut). `~:4391`.
  - **RESP-16** Settings drawer `drawerPanel._fitScale` — `drawerWantH` up to 560 vs 225 viewport (the GAME section accordion was pushing the panel off the bottom on Popout S). `~:4136`.
  - **RESP-22** Error modal `errCard._fitScale` — `cardH=210` was bleeding into Popout S 225 bottom safe-area. `~:4658`.
  - **RESP-23** Error modal `btnH 42 → 44` (was below WCAG 2.5.5 minimum). `~:4665`.
  - **RESP-02** Buy modal `bmCancel/bmConfirm` explicit scale-comp `hitArea` — `Math.max(btnH, 44/_fit)` so on-screen target stays >=44px at fitScale=0.5 (was rendering ~22px). Verified screen 57x44 / 124x44. `~:3522`.
  - **RESP-24** Replay bar `rbAgain.hitArea` explicit `Math.max(60,btnW/2) × 22` local → >=44px screen on any preset. `~:11046`.
  - **RESP-25** Replay bar Y/height tinyRP-aware (`H<330` → `barH 74→58`, `Y = H - barH - 4`). Was hardcoded `H-86`. `~:11037`.
  - **RESP-26** Intro CTA `ctaSize` floor at 14px (was dropping to 11px on Popout S, sub-legibility + sub-44px tap). `~:5100`.
  - **RESP-08 attempted & reverted** — portrait stack on tiny landscape made it WORSE (portrait cardH 540 × 0.4 fit packs tighter than landscape 420 × 0.5 fit). Landscape 3-col stays.
- **★★★ deltas already shipped this session** (committed in earlier owner sync `0bbc828` + my work): SPINE-05 Crown rig wired into MEGA logo ceremony · MOTION-04 big-win push-in · VFX-02 per-mode mood lerp · ART-04 directional vignette · ART-05 modal scrim · the AAA Buy-Bonus tier-card redesign (3× medallions + per-tier VFX + hover lift + chromatic offset rings + $26pt hero cost). Audio unblocked too (owner's `b47a861` procedural SFX+music bank, 37 clips, no API key).
- **🔴 3 audit P0s REMAINING** for next focused pass (see `docs/RESPONSIVE_AUDIT_2026-06-04.json`) — all are M-L effort needing more architectural work: **RESP-12/13/14/15** (Info modal sub-issues — proper internal scroll for Rules/Paytable + chrome-vs-content fitScale decoupling), **RESP-17** (Settings paytable mask verify), **RESP-18-21** (Autoplay panel — content overflow at 109px viewport, padding, font legibility; could fit-scale or rework as compact grid), **RESP-27/28** (Intro CTA height 24-43px on small presets + resize-after-open clip mask). All file:line grounded.
- **🟢 fitScale pattern is the canonical Popout-S fix** (mirror `layoutBetMenu`): compute `_fit = Math.min(1, (H-pad)/cardH, (W-pad)/cardW)`, set `card._fitScale = _fit; card.scale.set(_fit)`. Modal-resize hook (line ~7301) re-runs the layout on resize so rotation/refit Just Works. The shared `styleClose()` scale-compensates the close hitArea from `parent._fitScale`. Same approach for any new modal added.

**Prior (2026-06-05) — ★★★ pass #1 SHIPPED + two-session workflow locked in:**
- **★★★ #1 (Global color-grade + palette discipline) — SHIPPED.** Stage-level `ColorMatrixFilter` on `app.stage`: `contrast(0.12)` + `saturate(0.16)` + matrix-offset magenta-warm tint (R+0.012 / G−0.006 / B+0.006), `alpha=1.0`, `filterArea = app.screen` (no per-frame bounds calc). Plus `setGradeMode('base'|'bonus_standard'|'bonus_hot'|'bonus_mega')` with `_baseGradeMatrix` snapshot and a `filter.alpha`-pump cross-fade (~280 ms out → reapply → ~320 ms in). MEGA: desat + electric-violet `tint(0x8a2be2)` + contrast bump (cold/ominous). Verified live on `:5173`: matrix diag `1.2395`, offsets `-0.048/-0.066/-0.054` (magenta-warm lean), `filterCount=1`, console silent at Desktop 1200×675 and Popout S 400×225, no scroll. (`src/game/shining-pop.game.js ~:1611-1693`.)
- **★★★ #2–#6 PENDING.** Reel-frame chrome → background depth/key-light → win VFX choreography/anticipation → motion polish → symbol presentation. Spec: `docs/STAR3_VISUAL_SPEC.md`.
- **Two-session split via `:5173`.** **Parallel session = source writer** (`src/game/shining-pop.game.js`); **this session = QA on `:5173`** (HMR, no build wait). Build only at checkpoints. Avoids the recurring "file modified since read" clobber. (See §5 durable learning.)
- **🔴 LIVE compliance risk.** `src/game/shining-pop.game.js:7336/7337` still uses `rl.blurF.blurY` / `.blurX` (v8.3-deprecated). On first reel spin with `blurAmt>0.015`, Pixi emits two `console.warn` deprecation messages → Stake §4 production-console-silence violation. Drop-in fix: rename to `.strengthY` / `.strengthX` (keep `.strength` for uniform). 1-line each.

**Prior (2026-06-05) — candy reskin + asset compression + dist cleanup:**
- **Candy art set** (9 symbols + 3 tiers + logo + bg) sliced from `symbols-buy-bonus.zip`, black-key-aware (art-on-black), committed `71345f5`. Filenames unchanged → no `game.js` change.
- **Compression** role-tuned (bg q85 / logo q88 / symbols q90): asset set **893 → 780 KB (−12.6 %)**, no visible loss; runtime FPS unchanged (same texture dims). Already in `71345f5` (System.Drawing is deterministic → re-derive = identical bytes → no git diff).
- **dist cleanup**: 63 MB of dead `shining/*.jpeg` legacy sources → `art-source/` (gitignored). dist **150 → 87 MB**. `kit/ clean/ transparent/ symbols/` LEFT IN PLACE for the parallel 3-star session (ART-01 parallax / Spine crownwild / BUILD-02b — do NOT move).
- **OPEN**: palette (candy art vs magenta VFX), bg brightness behind reels, symbol cell-fill (90 %). Owner verifies on **8124**; once OK → re-`package:stake` + redeploy `STAKE-BUILDS/.../front/index.html` + `front.zip`.
- Full asset-pipeline playbook: `docs/blueprints/12_ASSET_PIPELINE_AND_CANDY_RESKIN.md`.

**Prior baseline (2026-06-03) — approval-readiness: solid ★★ — no known P0 blockers remain.** All committed + pushed to `feat/magenta-villain-reskin`, all in the refreshed deliverable:

- **P0 — bet +/− stepper tap targets** were ~5 px at Popout S (raw local hitArea on a `fitW`-scaled sprite). Scale-compensated → ≥48 px every preset. `96383a6` (icons) + `43498ef` (steppers). *The one verified hard approval-blocker — fixed.*
- **Server-payout parity** — credit = `round(betX6*payX100/100)`, never the per-event re-sum (±0.01 reject vector). `0876432`.
- **Robustness** — settle-chain `catch` (no soft-lock / un-ended round) + `unhandledrejection` guard; autoplay resumes after a Reality Check. `43498ef`.
- **Interruptible celebration** — tap/Space skips a long win ceremony; end-round ordering preserved. `51485c0`.
- **Visual** — symbol mipmaps `e02848b` · elegant brushed-energy win-lines (no dots) `27ba427` · brightness clamp `f84c8af` · compact mobile logo + neutral pre-play WIN `—` `1a205ee` · minimalist FS-win finale (tier floor 5→3, thin burst) `92d98c6` · paylines PREVIEW lines now render UNDER the symbols `fd5f3e4`.
- **a11y** — main landmark + meta description, Lighthouse ~97. `66a5afd`.
- **QA evidence** — 60-round spin/stop stress (180 rapid mid-spin taps) = 0 crashes / 0 stuck / 0 errors; MEGA bonus clean; console 0/0 on the no-debug build. Report: `docs/QA_FINAL_REPORT.pdf` (+ `QA_FINAL_REPORT.md`).

- **Deliverable** `STAKE-BUILDS/shining-pop/` current: `front/index.html` (~2.7 MB self-contained) + `front.zip`, `math/` LOCKED + `math.zip`, `store-tiles/`, `QA_FINAL_REPORT.pdf`.
- **NOT YET UPLOADED to Stake** — the live site is still the old build; uploading needs a human Stake login (see §5 stale-build trap).
- **Path to ★★★** (the studio visual-elevation workflow's plan): procedural palette/color-grade cohesion, premium reel-frame/chrome, background depth + lighting, VFX choreography, motion feel — all Stake-safe, shippable now. Ceiling-breakers need resources: adaptive music → an **ElevenLabs key**; bespoke symbol art → an **image-gen MCP** (none enabled).

> Quality target: **★★ on first Stake submission** (full compliance, responsive, no friction); the ★★★ extras (adaptive music, character animation, real bonus mini-scenes, localization) must ship in the FIRST submission — post-approval is locked (no rethemes / math / new modes).
