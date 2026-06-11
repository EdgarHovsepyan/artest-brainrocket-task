# Shining Pop V2 (Cocos) — Production Polish Plan ("basic → award-tier")

Single source of truth for the frontend-only push to a BAFTA/SiGMA-grade,
production-ready Cocos build. **No math** — render what the model supplies.
Parallel session is done; this session owns the whole frontend now.

Status legend: ⬜ pending · 🔶 doing · ✅ done. Each item names the lens skill.

## Guard rails (every change)

- Frontend/visual only. Math + books locked. Money via `logic/money.ts`.
- Keep 44+ node:tests green; typecheck changed files; build (exit 36 = OK).
- Headless preview throttles the loop when hidden — verify motion with
  `cc.game.step()` + state reads, or in a real browser (`:7457`).
- commitlint: lowercase subject ≤100 chars, body ≤100/line, `-F` BOM-free file.
- No-circles-as-spinners, interruptible ceremonies, reduced-motion stays pretty,
  flash <3/s, ≥44px touch targets, ≥4.5:1 contrast (WCAG / approval floor).

## PHASE 1 — Betting bar: compact + elegant + mobile-correct · `casino-ui-ux-audit`, `pixijs-responsive-mobile-first`, `mobile-safe-area-canvas`, `ui-slot-ux-designer`

- ⬜ 1.1 Compact the web bar band height (slimmer, denser) without crushing text; re-tune the fit cap so it reads elegant on desktop AND popout widths.
- ⬜ 1.2 Re-balance element spacing/hierarchy (account · LAST WIN · TOTAL BET · carousel · coins · ×2 · turbo · auto · SPIN) — breathing gaps, aligned baselines.
- ⬜ 1.3 Mobile/portrait bar: verify the 540×684 overlay at Mobile L/M/S, safe-area insets, ≥44px targets, no overlap with reels.
- ⬜ 1.4 7-preset no-scroll sweep (Desktop→Popout S, Mobile L/M/S). Visual-QA critique each.

## PHASE 2 — Buy-bonus FAB (from the Pixi flagship) · `slot-vfx-artist`, `event-animation-designer`

- ⬜ 2.1 Port `buyFab` (game.js:4138): buy-bonus.png art + glow + pill + label, idle breathe/float, press squash. Asset already loads as `ui2/buy_bonus`.
- ⬜ 2.2 Dock to the live grid side-margin (anchor to the board rect, not a fixed fraction) like the flagship; hide in replay/locked states; opens the premium BuyBonusModal.

## PHASE 3 — Symbols / crystals: basic → premium · `slot-vfx-artist`, `high-end-visual-design`, `cocos-aaa-visual-gate` (SY1–SY8, RQ2/RQ9)

- ✅ 3.1 Per-symbol idle breathing (phase-offset, heavier highs) — kill the static grid. [bbe8fec — verified by engine-step]
- ⬜ 3.2 Land impact: squash-stretch + dust + neighbor recoil, per turbo mode.
- ⬜ 3.3 Win-pop wave-blink + behind-glow (already partial — refine, keep the ≤8-cell white-out gate).
- ⬜ 3.4 Material identity on the "crystal"/high symbols: specular sweep + Fresnel rim (shader if WebGPU/perf allows, else Graphics fallback).

## PHASE 4 — Win lines + win celebration + shaders · `slot-vfx-artist`, `pixijs-filters`-equiv, `cocos-aaa-visual-gate` (WL1–WL8, WC1–WC9)

- ⬜ 4.1 Win-line draw L→R with a hot leading-edge spark + idle pulse (not a flat line).
- ⬜ 4.2 Multi-line color identity + sequential cadence; tap-to-skip / turbo / reduced-motion safe.
- ⬜ 4.3 Win ceremony: tier-locked log count-up choreography, banner arrival, restrained camera punch (gated to big tiers), coin shower; bloom thresholded.
- ⬜ 4.4 Shader pass (gated by Phase 6 WebGPU result): threshold bloom on win, dissolve/burn where useful. Graphics fallback otherwise.

## PHASE 5 — Reel spin → spin-button motion/feel · `pascal-slots-reel-engine`, `pascal-slots-spin-mechanics`, `web-animations`

- ⬜ 5.1 Spin-start wind-up + speed-line kick; per-reel stop stagger w/ anticipation widen.
- ⬜ 5.2 Spin button state morph idle↔spinning↔stop (clean, no alpha-dip), tied to the reel motion; the halo already smoothed.

## PHASE 6 — WebGPU evaluation · `webgpu`, `pascal-slots-asset-performance`

- ✅ 6.1 **DECISION: STAY ON WebGL2 + Graphics FX — no change.** Audited: `settings/v2/packages/engine.json` has `gfx-webgpu` `{_value:false}` and excluded from `includeModules`; the compiled engine's AUTO renderMode would pick WEBGPU if `navigator.gpu` exists, BUT the WebGPU device class is never compiled in (0 hits for requestAdapter/WGSL/createShaderModule in the bundle), so init safely falls back to WebGL2. The whole FX tier is faked with `cc.Graphics` + Node/Component tweens (no `.effect`/Material assets anywhere); this is a 2D batched, draw-call/CPU-bound workload, so WebGPU offers no upside and adds an experimental mobile-flaky device path. Enabling it while renderMode stays AUTO would silently switch capable browsers to the immature backend with no fallback. Custom-shader tier (true specular/bloom/dissolve, SY8/4.4) does NOT need WebGPU — it can use CCEffect materials on WebGL2 today; deferred as a future enhancement, not a blocker.

## PHASE 7 — Intro / info surfaces · `high-end-visual-design`, `web-animations`, `game-info-author`, (optional) `remotion-best-practices`

- ⬜ 7.1 Intro shows game identity + a "how to play / symbols / bonus" peek (paytable + bonus-symbol info), best-practice onboarding, skippable.
- ⬜ 7.2 Loader/intro motion polish; evaluate remotion for a pre-rendered splash (flag the real-time-vs-video tradeoff) and/or cuter animated symbol intros.
- ⬜ 7.3 Game-info panel: symbols grid + payouts + bonus-mode explainer (derives from data, never drifts from math).

## PHASE 8 — Visual QA + production sign-off · `cocos-aaa-visual-gate`, `stake-approval-visual-gate`, `casino-ui-ux-audit`, `verification-before-completion`

- ⬜ 8.1 Run the AAA gate against the build → punch-list → fix top items.
- ⬜ 8.2 Run the approval floor (stake-approval-visual-gate) → zero P0.
- ⬜ 8.3 7-preset + mobile + reduced-motion + console-silent + perf pass. Final build.

## Recommended ecosystem skills to install (owner asked to find)

- `zpqq132555/skills@cocos-creator-v3` (Cocos 3.x patterns) · `akillness/oh-my-skills@responsive-design` · `onewave-ai/claude-skills@responsive-layout-builder`.
- Install: `npx skills add <owner/repo@skill> -g -y`.

## Execution order

P1 (bar, most-requested) → P2 (FAB, quick win) → P3 (symbols) → P4 (win FX) →
P5 (reel/spin feel) → P6 (WebGPU gate) → P7 (intro/info) → P8 (QA sign-off).
Each phase: edit → test/typecheck → build → QA-loop verify → commit → tick here.

## SESSION STATUS (2026-06-11)

Shipped + verified on a fresh web-mobile build (build-qa @ :7461, 1280×720), tsc
clean for assets/scripts, 44/44 node tests, console-silent through boot → intro →
spin → resolve → ceremony:

- **Bugs**: reel-crush on win/lose (ceremony shake now kicks pos+angle only, fit()
  owns scale — verified reel scale held 1.24 through a 50× ceremony); pre-spin
  symbol flash (result dropped at settle via `pendingFinal`); reel size jitter at
  launch (blur gated behind `launching`); spin button rebuilt as concentric annuli.
- **Count-ups** (correctness): both ceremony + HUD migrated off plain-object tweens
  to `Component.schedule` steppers — verified the ceremony amount counts 0 → 500.00.
- **Win-lines**: charged L→R reveal + hot spark + per-line colour (10 hues) +
  accelerating cadence + idle breathe; reduced-motion instant fallback.
- **Ceremony**: unclamped intensity band (>100× keeps escalating), living
  warm→crystal tint, capped shake, AV-sync (impact braam + count pips).
- **Free spins**: per-spin money moments (win lines + tiered sting + savour dwell,
  brisk dead spins), big-step banner, LDW-safe floored finale.
- **Intro**: removed EXTRA STUDIO mark; data-derived game-info peek (top-4 symbols +
  ×payouts + RTP/vol/lines + buy names); single clean close fade (no white-flash
  flicker, full-cover bloom).
- **Bar (landscape/web)**: compacted via a single `Y()` CROP offset — H 300→214,
  reads as a slim slab, reels reclaim space; carousel hardened (empty guard, index
  clamp, drag rubber-band).
- **Buy-bonus FAB**: ported from Pixi — docked in the left margin, breathe/float/
  glow life, press squash, hides behind its picker + during features.

**Outstanding (spawned as a follow-up task):** PORTRAIT/mobile bar layout —
`betting-bar.ts` centres itself over the reels so the spin cluster + title logo
overlap the grid; needs a portrait bottom-inset + safe-area + 44px targets +
shrink-to-fit. Landscape (web bar) is the verified-good path; do not regress it
(shared board fit). Both games confirmed running: Cocos build-qa @ :7461, Pixi
flagship dev @ :5173.
