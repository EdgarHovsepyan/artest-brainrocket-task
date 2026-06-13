# Shining Pop — Road to a Legendary, Award-Tier Slot

> A prioritized, codebase-grounded backlog of **100 improvements** to take both
> engines (PixiJS `shining-pop` + Cocos Creator `shining-pop-v2`) from
> "production-ready" to "best-in-class, awards-shortlist." Grounded in the real
> systems: `view-config.ts` knob layer, the win-presentation pipeline, the
> tiered ceremony, the multi-bus audio manager, the 11 `.effect` shaders, and
> the betting bars.
>
> **Legend** — Impact: ★ (nice) → ★★★ (game-defining). Effort: S/M/L.
> Engine: `PX` Pixi · `CC` Cocos · `BOTH`.
> Tier: **P0** quick wins · **P1** high-leverage · **P2** depth · **P3** ambitious.
>
> Design north star: _every spin should feel alive; every win should feel earned;
> the big wins should feel like a story with a beginning, a climax, and a breath._

---

## P0 — Quick wins (ship this week)

1. ★★ S `CC` **Per-line win-line colour identity** — distinct hue per payline on the beam core (✅ shipped). Extend the _shader ribbon_ tint per line next (see #41).
2. ★★ S `CC` **Symmetric popup dismiss everywhere** — buy-bonus modal now animates close (✅). Audit any remaining `active=false` snaps.
3. ★★ S `BOTH` **Win-counter punch** — bolder landing pop + heartbeat (✅ both). Add a sub-frame "settle overshoot" on the final lock.
4. ★ S `BOTH` **Spin-button rest breathing** — a 4s sine idle scale (1.0↔1.015) so the primary CTA never looks dead between spins.
5. ★★ S `CC` **Anticipation drag on near-miss** — when 2 scatters land early, slow the last reel an extra 0.6s with a rising audio whine (config hook exists: `anticipation.extraSeconds`). Tune to 0.8s + audio.
6. ★ S `BOTH` **Reduced-motion parity audit** — confirm every new VFX has a calm fallback (the codebase already respects `reduced`; lock it in tests).
7. ★★ S `BOTH` **Button press physics** — unify press-squash to 0.94 + elasticOut release across ALL controls (some still snap).
8. ★ S `CC` **Loser-dim depth on win** — deepened to 95 (✅). Add a 180ms ease so the dim _breathes in_, not cuts.
9. ★★ S `BOTH` **Win sting layering** — ensure the tiered win sting (1–5) ducks the music bus by −6dB for 400ms so the sting cuts through.
10. ★ S `BOTH` **First-spin warmth** — a one-time gentle logo shimmer + soft chord on first interaction (sets the tone).

## P1 — High-leverage (the "juice" that wins awards)

11. ★★★ M `BOTH` **Cascading "anticipation ladder"** — each matching symbol that lands during a building win bumps a rising pitch + a screen-edge glow pulse. Turns a 5-of-a-kind reveal into a crescendo.
12. ★★★ M `CC` **Big-win story beats** — formalize the ceremony into 4 scripted beats: _hush (micro-silence) → detonation → count-up climax → savour exhale_. Most exists; tighten the timing contract and document it.
13. ★★ M `BOTH` **Coin/gem geyser physics** — ballistic spray with gravity + floor bounce + sparkle-on-land for EPIC (Cocos `coinGeyser` exists; add bounce + per-coin spin).
14. ★★ M `CC` **Per-symbol "pop" on land** — each symbol does a 60ms squash as it stops (origin-aware, bottom anchor) so the reel-stop feels weighty.
15. ★★ M `BOTH` **Win-focus vignette** — a soft radial darken centered on the winning cluster (not the whole board) so the eye is guided.
16. ★★★ L `BOTH` **Dynamic music intensity** — base loop has 2–3 stems; add a "win layer" stem that fades in during count-up and a "bonus" stem swap. Audio manager already buses this.
17. ★★ M `BOTH` **Reel-stop bounce easing** — elasticOut overtravel exists (`bounce`); tune elasticity per turbo mode so turbo feels snappy, normal feels juicy.
18. ★★ M `CC` **Win-beam traveling pulse packet** — a bright energy packet runs the payline once per cycle (partly in `win-beam.effect`; expose `pulseSpeed`/`pulseWidth` to config).
19. ★★ M `BOTH` **Near-win "so close" feedback** — when a high-pay symbol lands on 4 of 5 reels, a subtle desaturate + held breath (ethical: never fake a win, just acknowledge the tension).
20. ★★ M `BOTH` **Balance count-up choreography** — credit roll-up should _lead_ with a pitch-climbing tally and _land_ with a coin-clink; debit is quiet + fast (asymmetry = psychology).
21. ★★ M `CC` **Symbol idle micro-life** — high-value symbols breathe with phase-offset (exists); add a rare 3s "blink"/glint so the board feels inhabited.
22. ★★ M `BOTH` **Wild landing drama** — wilds arrive with a brief slow-mo (0.12s timescale dip) + impact ring. Wilds are the brand; make them events.
23. ★★ L `BOTH` **Scatter trigger sequence** — each scatter that lands toward a trigger lights a progress pip + raises tension; the 3rd detonates the FS portal. Portal VFX exists; wire the per-scatter build.
24. ★★ M `BOTH` **Free-spins entry as a "world change"** — background swaps, palette warms, music swaps (Cupids-Crush bg exists in CC); add a 0.6s crossfade transition.
25. ★★ M `BOTH` **Free-spins retrigger celebration** — distinct, smaller-than-bigwin "+N SPINS" banner that slams in and adds to the counter with a tick cascade.
26. ★★ M `BOTH` **Total-win summary on FS end** — a "YOU WON" tally screen that counts the whole feature total with escalating drama, then returns to base.
27. ★★ M `CC` **Ceremony tier hue ramp** — EPIC pushed to a hotter crown (✅ `#ff1e8c`). Add a subtle per-tier _gradient_ on the number via a 2-tone outline.
28. ★★ M `BOTH` **Spin button → stop affordance** — morph arrow→stop with a 120ms rotate, not a swap; the active reels' progress could ring the button.
29. ★★ M `BOTH` **Turbo as a felt mode** — turbo shortens reveal (exists) AND tightens easing + raises sting pitch slightly so speed is _felt_, not just faster.
30. ★★ L `BOTH` **Haptics (mobile)** — light tap on spin, medium on win-land, heavy on big-win detonation (Web Vibration API; gate behind a setting).

## P2 — Depth & finish (separates good from great)

31. ★★ M `BOTH` **Typographic hierarchy pass** — lock a modular scale (e.g. 1.25 ratio) for all UI text; the win amount should be the single largest element on screen at climax.
32. ★★ M `BOTH` **Number formatting polish** — thin-space thousands, currency glyph kerning, and a fixed-width tabular figure so the count-up doesn't jitter horizontally.
33. ★★ M `CC` **Amount auto-fit** — Pixi has dynamic font-fit on the hero number; Cocos ceremony number lacks it. Add a measured shrink so max-wins never clip.
34. ★ S `BOTH` **Outline/shadow consistency** — one stroke recipe (color + width = f(size)) applied via the text factory so no label drifts.
35. ★★ M `BOTH` **Colour-token unification** — both engines share a palette; export a single source-of-truth token JSON and generate `palette.ts` + Pixi `THEME` from it (prevents drift).
36. ★★ M `BOTH` **Contrast/WCAG sweep** — Pixi already lifts win-tier colours for AA; run a full contrast audit on every text-on-surface pair and document ratios.
37. ★★ M `BOTH` **Iconography pass** — ensure spin/menu/sound/turbo/autoplay icons are optically aligned, same stroke weight, same corner radius.
38. ★★ M `BOTH` **Empty/idle "attract" loop** — after ~20s idle, a gentle demo flourish (symbol shimmer, a teasing near-win) draws the player back. Ethical, non-deceptive.
39. ★★ M `BOTH` **Loading → first-frame choreography** — a branded loader that _becomes_ the logo placement (shared-element feel), not a hard cut.
40. ★★ M `BOTH` **Orientation transition** — animate the portrait↔landscape relayout (0.3s) instead of a hard snap; reels glide to their new pose.
41. ★★ L `CC` **Per-line shader ribbon tint** — give each pooled beam its own material instance (or a `u_color` uniform) so the _plasma_ matches the per-line hue, not just the core stroke.
42. ★★ M `CC` **Reel-portal on FS only** — portal warp exists but is gated off (read as "arrows"); re-enable a _subtle_ version exclusively during free-spins where it reads as magic, not noise.
43. ★★ M `BOTH` **Win-line readability cycle** — on multi-line wins, cycle one bright line at a time (Cocos has `lineCycleSeconds`); add a soft "current line" label (e.g. "LINE 7 · ×12").
44. ★★ M `BOTH` **Symbol art depth** — add a subtle inner bevel + rim-light bake so symbols read as physical gems under the portal light.
45. ★★ M `BOTH` **Background parallax** — 2–3 depth layers that drift slowly with device tilt / pointer so the hall has dimensionality.
46. ★★ M `BOTH` **Ambient particle bed** — Pixi has drifting motes; mirror a GPU-gated version in Cocos for atmosphere parity.
47. ★ S `BOTH` **Sound settings granularity** — separate Music / SFX / Win-sting sliders (buses exist), not just a master mute.
48. ★★ M `BOTH` **Audio spatialization** — pan reel-stop SFX by reel column (L→R) so stops feel positioned across the board.
49. ★★ M `BOTH` **Anticipation audio whine** — a rising filtered tone during the late-reel drag that resolves on the stop (tension→release).
50. ★★ M `BOTH` **Mute-aware visuals** — when muted, slightly amp the visual feedback (bigger flashes) so silent play still feels responsive.
51. ★★ M `BOTH` **Buy-bonus value framing** — show "expected spins" and a tasteful cost-vs-base comparison so the buy feels considered, not impulsive (compliance-aware).
52. ★★ M `BOTH` **Bet-change feedback** — each bet step animates the value with a tick + a brief affordability re-check glow on the spin button.
53. ★★ M `BOTH` **Autoplay HUD** — a clean remaining-count ring + stop-on-win/stop-on-bonus options surfaced (compliance gates exist).
54. ★★ M `BOTH` **Reality-check polish** — Pixi has a reality-check modal; make it calm, clear, non-punitive, with a net-P/L spark-line.
55. ★ S `BOTH` **Error states with dignity** — connection errors get a calm retry card (Pixi has `errModal`); ensure copy is human and the art on-brand.
56. ★★ M `BOTH` **Skip/fast-forward** — tap during a ceremony fast-forwards to the count-result (Pixi has `fastFwd`); ensure both engines honor it gracefully.
57. ★★ M `BOTH` **Win-history micro-log** — a small recent-wins ticker (last 5) builds a sense of momentum (Pixi drawer has history; surface a glanceable version).
58. ★★ M `BOTH` **Symbol collection / meta tease** — a non-monetary progress meter (e.g., "wilds seen") for retention, clearly cosmetic.
59. ★★ M `BOTH` **Big-win share card** — generate a shareable PNG of a big win (canvas snapshot) — organic marketing.
60. ★ S `BOTH` **Localization-ready text** — Cocos info panel already wraps; route every string through a key map so the game ships in N languages.

## P3 — Ambitious (the moonshots that make a "best ever")

61. ★★★ L `BOTH` **Adaptive "feel" director** — a lightweight system that subtly varies celebration pacing by recent session rhythm (within strict, audited bounds) so the game never feels repetitive. Never alters math/odds.
62. ★★★ L `BOTH` **Cinematic camera** — a virtual camera that can push-in on the winning cluster and rack-focus the board for EPIC wins (Pixi/Cocos both support container transforms).
63. ★★★ L `BOTH` **Signature "moment" for max win** — a once-in-a-session, fully scripted 5–7s sequence (lighting, music swell, slow-mo, logo) that players screenshot and share.
64. ★★★ L `BOTH` **Reactive background that "knows" the win** — bg shaders bloom/colour-shift in sympathy with win tier (grade-tint exists; make it a living response).
65. ★★ L `BOTH` **Physical light model** — a single "key light" that all chrome/gems respond to, so highlights move coherently (fake it with a shared light-dir uniform).
66. ★★ L `BOTH` **Spine-driven symbol wins** — top symbols get authored Spine win animations (CC has the rig pipeline; PX has `SymbolRig`). The crown/seven should _come alive_ on a win.
67. ★★ L `BOTH` **Procedural music that breathes** — key/tempo subtly tracks volatility state (base calm → bonus driving) with seamless stems.
68. ★★ L `BOTH` **Accessibility mode** — colour-blind-safe payline palette variant, high-contrast UI theme, and a "calm" preset (no shake, no flash) beyond reduced-motion.
69. ★★ L `BOTH` **Performance governor** — auto-tune VFX density by measured frame time (Pixi has `_gpuWeak` + `fxScale`); make it a continuous closed loop on both engines.
70. ★★ L `BOTH` **60→120fps path** — ensure all tweens are dt-based (they are); validate buttery motion on 120Hz devices.

## Engineering & production rigor (so it stays great)

71. ★★ M `BOTH` **Single design-token source** — JSON → generates both palettes + spacing + type scale; CI fails on drift (see #35).
72. ★★ M `CC` **View-layer type-check in CI** — stub the `cc` module types so `view-config.ts`/views typecheck in CI (today only logic is tested).
73. ★★ M `BOTH` **Visual regression tests** — headless render of key frames (idle, win, big-win, buy-modal) → screenshot diffing to catch unintended visual changes.
74. ★ S `BOTH` **VFX config snapshot test** — lock `view-config` numeric contract so a careless edit is caught (the knobs are the soul; protect them).
75. ★★ M `BOTH` **Deterministic VFX seed** — make celebration randomness seedable for reproducible captures/marketing.
76. ★★ M `BOTH` **Asset budget gate** — CI tracks bundle size (Pixi single-file is 1.4MB); fail on regressions; lazy-load bonus assets.
77. ★★ M `BOTH` **Audio sprite atlas** — pack SFX into a sprite-sheet to cut request count + latency on first win.
78. ★ S `BOTH` **Spine/asset existence test** — assert every referenced anim/clip exists so a renamed file can't ship a silent failure (Cocos already falls back; test it).
79. ★★ M `BOTH` **RGS/compliance contract tests** — lock that celebration durations never block the next spin beyond spec; LDW rules honored (Pixi has `COMPLY`).
80. ★ S `BOTH` **Frame-time HUD (dev)** — a toggle that overlays fps + draw-call count so tuning is data-driven.
81. ★★ M `CC` **Rebuild pipeline for review build** — script the Cocos `build/web-mobile` regeneration so source edits reach the playable build without manual editor steps.
82. ★ S `BOTH` **Storybook of components** — a gallery page rendering every modal/banner/button state for design review.
83. ★★ M `BOTH` **Telemetry hooks (privacy-safe)** — event taps for spin/win/buy/feature so design decisions are measured, not guessed.
84. ★ S `BOTH` **Changelog discipline** — keep the excellent commit-message rigor; add a human CHANGELOG for the design narrative.
85. ★ S `BOTH` **Doc the "why"** — the code comments are superb; add a one-page "celebration design bible" so the intent survives team changes.

## Player psychology & ethics (legendary ≠ predatory)

86. ★★★ M `BOTH` **Honest wins only** — never celebrate a loss as a win; the LDW handling (Pixi `allow_ldw_celebration`) is correct — extend the same honesty everywhere.
87. ★★ M `BOTH` **Earned-anticipation, not fake** — tension cues only fire on _genuine_ near-states (real 2-scatter, real 4-of-5), never manufactured.
88. ★★ M `BOTH` **Clear odds & info** — paytable/RTP/volatility are present and derived from math (CC `info-content`); make them one tap away and beautifully legible.
89. ★★ M `BOTH` **Frictionful buy-bonus** — a confirm beat + clear cost so the buy is deliberate (compliance-gated), never a slot-machine-within-a-slot-machine.
90. ★★ M `BOTH` **Session-care surfacing** — reality-check + time/spend visibility framed supportively, not hidden.
91. ★★ M `BOTH` **Calm losses** — losing spins resolve cleanly and quietly; no dark patterns, no "almost!" nagging. The _wins_ carry the energy.
92. ★ S `BOTH` **Predictable controls** — spin is always where the thumb expects; no moving CTAs; no accidental max-bet.
93. ★★ M `BOTH` **Pace control** — let players slow down (turbo OFF should feel luxurious, not punished); never force speed.
94. ★ S `BOTH` **Respect reduced-motion & sound-off** — already strong; make these first-class, remembered preferences.
95. ★★ M `BOTH` **Transparent volatility feel** — the game's _feel_ should honestly telegraph its volatility so expectations match reality.

## Cross-engine cohesion (two games, one legend)

96. ★★ M `BOTH` **Shared "celebration spec"** — one document + token set both engines implement; differences become intentional, not accidental.
97. ★★ M `BOTH` **Parity matrix** — a living table of every feature × engine (done/partial/n-a) so neither game silently lags.
98. ★★ M `BOTH` **Shared math-core trust** — both consume `@artest/math-core`; keep all odds/payouts there, never in the view (already the architecture — protect it).
99. ★★ L `BOTH` **A/B harness** — ship two celebration variants behind a flag; measure delight (telemetry #83) and pick the winner with data.
100.  ★★★ — `—` **The "one more spin" test** — after every change, ask: _did this make me want one more spin for the right reasons?_ If not, cut it. Legendary games are ruthlessly curated, not maximally stuffed.

---

### Suggested execution order (next 3 sprints)

- **Sprint 1 (feel):** #11, #12, #13, #16, #20, #22 — make every win a crescendo.
- **Sprint 2 (world):** #23, #24, #25, #26, #42, #64 — make free-spins a place.
- **Sprint 3 (finish):** #31–#37, #71–#74 — lock typography, tokens, and CI so the polish can't regress.

### Done so far on this branch

- Unified popup dismiss motion (CC buy-bonus modal) — symmetric with the house `popClose`.
- Bolder win-moment juice in both engines (symbol attack, jelly, soft-burst, rim-light, landing pop, heartbeat; Pixi hero-number elastic hit).
- Epic win-line pass (CC): config-driven beam intensity + faster flow, denser embers, deeper win-focus dim, deeper top-tier savour vignette, hotter EPIC crown.
- **Per-line win-line colour identity** on the beam core stroke (this commit).

_Guiding principle: every spin alive, every win earned, big wins tell a story._
