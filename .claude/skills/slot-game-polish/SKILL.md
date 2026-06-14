---
name: slot-game-polish
description: >-
  Knowledge base + method for polishing the Shining Pop slot games (PixiJS
  `shining-pop` and Cocos Creator `shining-pop-v2`, shared `@artest/math-core`).
  Use when adding or improving VFX, win celebrations, juice/feel, UX, mobile
  layout, audio, or game-economy tuning — distilled from 10 canonical game-dev
  books into 100 concrete, codebase-grounded actions, with the verified
  workflow, engine facts, test guardrails, and gotchas needed to ship safely.
  Trigger on: "polish / juice / make it feel better / award-tier / win
  celebration / shaders / VFX / mobile / RTP / bonus" for these two games.
---

# Slot Game Polish — Book-Derived Knowledge Base

One place for everything needed to bust these two slots toward award-tier, using
the 10 books' best practices. Self-contained: method, engine facts, the verified
capture harness, the 100 approvals (by book), the guardrails that protect a
change, and the gotchas that cost real time.

> **North star:** every spin alive · every win earned · big wins tell a story.
> **Invariant:** the pure core decides _what_ happens; the view decides _how it
> feels_; never mix the two.

---

## 0. Operating method (the workflow that actually works)

1. **Map before you touch.** Both engines are large (Pixi is one ~12.6k-line
   file; Cocos spreads across ~15 view files + 11 shaders). Grep/read the exact
   region first; never edit blind.
2. **Tune what you can SEE.** Changes you can't verify get rejected. Prefer the
   **Pixi engine** for see→fix→verify (it builds with Vite and screenshots
   headless). **Port the proven recipe to Cocos** second.
3. **Data over code.** The only tuning surfaces are `game-config.ts` (economy)
   and `view-config.ts` (feel/beats). Change knobs, not engine code.
4. **Guard every change.** Add/extend a test (logic, layering, feel-contract,
   token-drift) so CI catches a regression. `npm test` must stay green.
5. **Reduced-motion + odds are sacred.** Every VFX needs a calm fallback; never
   touch odds/RTP in the view (they live in `@artest/math-core`).
6. **Commit small, conventional, pushed.** Types: `feat|fix|vfx|ux|perf|refactor|test|docs|ci|chore`. Subject lowercase. Husky runs lint+prettier on commit.

---

## 1. Engine facts (don't rediscover these)

**`shining-pop` (Pixi v8)** — single-file `src/game/shining-pop.game.js` (~12.6k
lines) + `src/ui/*`. Builds `vite build` → committed `dist/index.html` (the
playable review build, **kept in sync**). GSAP tweens. Canvas caps at 1200×675
and **letterboxes** inside larger viewports (→ thin UI buttons don't line up
with screen pixels under automation; drive via keyboard instead). Starts at
**$1,000**. Dev build stamp renders only on localhost/file/?debug (correctly
hidden in prod — not a bug).

**`shining-pop-v2` (Cocos Creator 3.8.8)** — strict **MVC**:
`assets/scripts/{logic,model,view,controller}`. 11 GLSL `.effect` shaders under
`assets/resources/effects/`. Pooled particles (`particle-pool.ts`) +
real physics integrator (`particle-layer.ts`). Spine (cupid-wf callout,
cupid-fs-bg world). **The committed `build/web-mobile` is invisible until
rebuilt in Cocos Creator** — source edits don't show in the playable build
without an editor rebuild (this is the #1 feedback-gap gotcha).

**Shared:** `@artest/math-core` (pure TS, zero engine imports) — odds truth,
headless-simulatable. **Both keyboard-drivable:** Space=spin, B=buy, T=turbo,
A=autoplay, I=info, M=mute.

**Economy (from `npm run sim`):** RTP ≈ **97.5%** (base lines 73.5% + WILD
STRIKE ~24%), hit-freq ≈ **21.8%**, observed max **756× total bet**. **WILD
STRIKE is always ×3** (`minWilds=3`, `maxMultiplier=3` → `min(wilds,3)` never
scales). **No strike inside free spins.** Buy-feature EV ≈96% vs base 97.5%.
Bonus costs (× total bet): WILD REELS 33.64 · STICKY CROWNS 96.99 · STICKY WILDS
110.68. Demo balance must cover the priciest (guarded by a test).

---

## 2. Verified capture harness (Playwright — this is the unlock)

Chromium is at `/opt/pw-browsers`; Playwright is global at
`/opt/node22/lib/node_modules`. ESM import by absolute path:

```js
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
// serve the build dir over http (canvas needs http, not file://), then:
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
// PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node shot.mjs
```

- Serve `games/shining-pop/dist` (Pixi) or `games/shining-pop-v2/build/web-mobile` (Cocos) with a tiny node static server.
- **Drive with keyboard** (letterbox-proof): `page.keyboard.press('Space')` to spin, `'KeyB'` to open buy. Pixi splash: click "TAP TO START" low-centre first. Cocos load: wait ~10s headless.
- Screenshot at portrait (mobile-first, e.g. 420×860) AND landscape. To catch a win, burst-screenshot every ~220ms after a spin. Inspect with the Read tool; send key frames to the user with SendUserFile.
- Pixi is rebuildable here (`vite build`); **Cocos is not** — screenshot the _current_ Cocos build only.

---

## 3. The 10 books → core pattern → where it lives

| Book                                  | Pattern                                    | In our code                                                    |
| ------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Schell — _Art of Game Design_         | **Lenses** (interrogate before building)   | review-gate checklist; catches "won't read" early              |
| Sylvester — _Designing Games_         | **Events→emotions; beats as data**         | `view-config.ceremony.beats` (hush→detonation→climax→savour)   |
| Nystrom — _Game Programming Patterns_ | **Pool · State · Observer · Dirty-Flag**   | `particle-pool.ts`, `FlowState`, `EventTarget` HUD push        |
| Gregory — _Game Engine Architecture_  | **Strict layering + tools pipeline**       | `logic→model→view→controller`; CI sims; `architecture.test.ts` |
| Koster — _A Theory of Fun_            | **Novelty budget**                         | distinct 3 bonus worlds; tier escalation                       |
| Swink — _Game Feel_                   | **<100ms ack + juice layers**              | press-physics, reel bounce, win-focus, dt-tweens               |
| Rogers — _Level Up!_                  | **Three Cs + thumb-zone**                  | betting bar mobile layout, first-spin warmth                   |
| Schreier — _Blood/Sweat/Pixels_       | **Vertical slice; verify the built thing** | Pixi-verify→Cocos-port; Playwright harness                     |
| Sellers — _Systems Approach_          | **Economy as a balanced system**           | `math-core` + RTP/bonus sims; the strike/EV dials              |
| Salen & Zimmerman — _Rules of Play_   | **Meaningful, discernible play**           | win-line colour + win-focus + math-sourced paytable            |

_(Reference-tier for VFX deep-dives: Real-Time Rendering — read only the
transparency/blending, bloom/post, and particle chapters. Free practical shader
refs: thebookofshaders.com, iquilezles.org, Shadertoy, Pixi v8 Filters, Cocos
Effect docs.)_

---

## 4. The 100 approvals (by book — pick 3–5 into a slice)

### I. Schell — Lenses

1. Gate every win-VFX change on 3 lenses: understand / fair / surprising.
2. Storyboard the first 60s; fix the weakest beat.
3. Audit predictable spins; add one _honest_ surprise (near-trigger tease).
4. RTP + max-win one tap away in info (sourced from math).
5. List every reward; verify each is _felt_ (visual+audio+haptic).
6. Flow: spin→result→next never stalls (cap ceremony hold; honor turbo).
7. Curiosity: a subtle "what's in the bonus?" tease on the buy FAB idle.
8. Accessibility: colour-blind-safe payline palette + high-contrast theme.
9. Endogenous value: the balance count-up should feel like _earning_.
10. One-screen "how to win" that never lies.
11. Every interactive element gives feedback < 100ms.
12. Is the base game fun to _fidget_ with before any win? Tune idle life.

### II. Sylvester — events→emotions

13. ✅ Ceremony beats as data (`ceremony.beats`).
14. Port the beat-timeline to the Pixi ceremony.
15. "Emotion log" dev overlay (tag each event with intended emotion).
16. Sensory harmony: every flash has a same-frame audio transient.
17. Fiction-fit: candy theme should telegraph its volatility (vs 21.8% hit-freq).
18. Anticipation arc should _crescendo_ (pitch + edge glow), not just delay.
19. Ease `boardDimAlpha` in (180ms) so the savour breathes, not cuts.
20. A distinct "feature complete" beat (relief+triumph) ≠ a line win.
21. Spectacle budget: cap simultaneous VFX so the climax has headroom.
22. A/B two celebration variants behind a flag; measure delight.
23. A "decompression" beat after a big win (don't yank back to base).

### III. Nystrom — patterns

24. ✅ MVC dependency-direction enforced in CI.
25. Formalize `FlowState` as an explicit transition table.
26. Dirty-Flag the HUD push (`setBalance`/`syncDeliveredBar` repaint on change).
27. One pool budget for coins/embers/beams; assert no `new` in the win path.
28. Observer audit: cross-module calls go through events, not reach-ins.
29. Service Locator for audio/particles/rng (view never news them up).
30. Confirm all motion is `dt`-based for 120fps.
31. Split the betting bar into composable control components.
32. State pattern for the spin button (kills the double-spin guard hack).
33. Event-queue audio cues so a win flurry never stacks into a wash.
34. Snapshot-test the `FlowState` transitions so an illegal edge fails CI.

### IV. Gregory — architecture

35. ✅ Layering test (pure core imports no `cc`).
36. ✅ CI: lint/format/test/RTP-sim every push.
37. ESLint `no-restricted-imports` mirroring the layering test.
38. Asset-budget CI gate (Pixi single-file ~1.4MB).
39. Lazy-load bonus-only assets (Spine scene, bonus loop) on first feature.
40. Deterministic seed path for reproducible capture + bug repro.
41. Frame-time dev HUD (fps + draw calls), toggled by a debug key.
42. Performance governor: auto-scale VFX density by frame time (close the loop).
43. Memory: no texture/material leak across 1000 spins.
44. Script the Cocos `build/web-mobile` regen if at all possible.
45. Single design-token source → generate `palette.ts` + Pixi `THEME` (codegen).
46. Per-folder README documenting the layer contract.

### V. Koster — fun/novelty

47. Novelty-budget doc: each tier/bonus must add one new pattern.
48. ✅ Three visually-distinct bonus worlds (gold/pink/violet).
49. Light non-monetary meta ("wilds seen") for a long arc.
50. Vary anticipation by trigger type (scatter vs wild).
51. Tiers must be _discriminable_ — BIG vs MEGA at a glance.
52. Cut any VFX that carries no information (the "magenta geometry" lesson).
53. One-time "what you get" buy-feature preview, then never nag.
54. Mastery curve: turbo/quick-stop for experts; full ceremony for newcomers.
55. Rare honest "double detonation" on a max-win.
56. Paytable ordering makes the symbol hierarchy learnable.
57. After N dead spins, an honest near-win tease (never fake a result).

### VI. Swink — game feel

58. Define a "feel budget": every control acks < 100ms.
59. Unify press-physics (0.94 squash + elasticOut) across ALL buttons.
60. ✅ Win-focus dim so winners dominate (Pixi, verified).
61. Reel-stop weight: 60ms bottom-anchored squash on land.
62. Tune reel-stop bounce elasticity per turbo mode.
63. Wild landing drama: 0.12s slow-mo + impact ring.
64. Spin-button rest-breathing (4s sine 1.0↔1.015).
65. Coin-clink on balance-credit land; pitch-climb during tally.
66. Haptics: light spin / medium win-land / heavy detonation (gated).
67. Camera push-in 4–6% on big wins, settle on dismiss.
68. Input buffering: a tap in the last 150ms queues the next spin.
69. Sub-frame settle overshoot on the win-counter's final lock.
70. Every visual transient has a low-end thump (felt, not just seen).
71. Consistent easing: enter ease-out, exit ease-in, never linear.

### VII. Rogers — mobile / 3 Cs

72. Thumb-zone audit: spin is the hero, ≥44px targets everywhere.
73. First-spin warmth: one-time logo shimmer + soft chord.
74. Animate portrait↔landscape relayout (0.3s glide).
75. [PX] Fix portrait header so the logo never overlaps the top reel row.
76. [PX] Close the portrait dead-space; enlarge the board.
77. Safe-area insets on every edge control.
78. One-handed reach: steppers + spin without a grip shift.
79. Loading → first-frame: loader _becomes_ the logo (shared-element).
80. Tap-target forgiveness (8px invisible padding).
81. Onboarding coach-marks (dismissible, once) for buy + autoplay.

### VIII. Schreier — production

82. ✅ Verify-don't-guess: the Playwright capture harness.
83. Ship in vertical slices (P0→P3); never a big-bang VFX PR.
84. Document the "Cocos build invisible until rebuilt" gotcha in the README.
85. Keep the human CHANGELOG (design narrative survives team changes).
86. A one-page "celebration design bible" so intent can't drift.
87. Every new VFX declares its reduced-motion fallback in the same PR.
88. DoD: screenshot-verified (Pixi) or editor-verified (Cocos).
89. PR template: compliance, RTP, max-win, reduced-motion, mobile checklist.
90. Storybook/gallery page of every modal/banner/button state.

### IX. Sellers — economy/systems

91. WILD STRIKE scaling: raise `maxMultiplier` (3→5); re-sim RTP.
92. Decide + disclose strike-in-bonus; re-anchor costs.
93. Buy-EV: equalize or disclose 96% vs base 97.5% per jurisdiction.
94. Add the bonus-EV sim to CI (sampled budget).
95. Hit-frequency dial vs volatility (candy theme wants frequent small wins).
96. Verify the advertised 5,000× is reachable (full wild screen + strike) and rare.
97. Economy regression: snapshot RTP/hit-freq; CI fails on > ±0.3% drift.
98. Per-bonus RTP-contribution report.

### X. Salen & Zimmerman — meaningful play

99. "LINE n ×m" readout so every win is _discernible_.
100. Honest wins only (never celebrate a loss; LDW-safe wording — audit both).

_(Cross-cutting: telemetry on spin/win/buy/feature so all of the above is
measured, not guessed; and the "one more spin" test — if a change doesn't make
you want one more spin for the right reasons, cut it.)_

---

## 5. Guardrails already in place (keep them green)

`games/shining-pop-v2/tests/` (run `npm test`, must stay green):

- `architecture.test.ts` — pure core imports no `cc`; deps flow one-way (controller→view→model→logic).
- `view-config.test.ts` — feel contract (tiers escalate, opacities/durations valid, beat-timeline well-formed).
- `design-tokens.test.ts` — Cocos palette + ceremony tiers locked to `games/design-tokens.json`.
- `feature.test.ts` — all 3 bonuses affordable at demo start; WILD STRIKE; math parity.

CI: `.github/workflows/ci.yml` runs lint · format · build+tests · RTP sim on every push.

---

## 6. Gotchas (paid for in real time)

- **Cocos build is stale** until rebuilt in the editor — your source edits are invisible in `build/web-mobile`. Always say so.
- **Cocos 3.8.8 web runtime never ticks `tween({v:0})`** (plain-object targets) — use a scheduled frame-stepper for count-ups (the codebase already does).
- **`[...set]` mis-compiles** in Cocos 3.8.8 Babel → use `Array.from(set)`.
- **Shake target scale is owned by `fit()`** — only kick position/angle, never write scale there.
- **No engine import below the view** — or `architecture.test.ts` fails (by design).
- **Pixi canvas letterboxes** (1200×675) — automate via keyboard, not pixel clicks on thin buttons.
- **Commit subjects must be lowercase** and a conventional type, or commitlint rejects.

---

## 7. Companion docs (depth)

`games/BOOK-PLAYBOOK.md` (full 130 actions) · `ARCHITECTURE-STRATEGY.md` (10
books → patterns + 5 waves) · `ROADMAP-LEGENDARY.md` (100 prioritized) ·
`PARITY-MATRIX.md` (feature × engine) · `CHANGELOG.md`.

**To use this skill:** pick a goal → matching book section → 3–5 numbered
approvals → Pixi-verify → Cocos-port → add/extend a guard test → commit & push →
tick the playbook + parity matrix.
