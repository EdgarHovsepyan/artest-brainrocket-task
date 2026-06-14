# Book Playbook — 130 Approvals from 10 Books → Shining Pop

A pick-up-and-build backlog: **130 concrete actions** distilled from the 10
game-dev books, each grounded in _our_ code (PixiJS `shining-pop` / Cocos
`shining-pop-v2`, shared `@artest/math-core`). Companion to
`ARCHITECTURE-STRATEGY.md` (the patterns) and `ROADMAP-LEGENDARY.md` (the
juice). A future session can open this and execute any line.

**Engine tag:** `[PX]` Pixi · `[CC]` Cocos · `[BOTH]`. Items already shipped this
session are marked ✅. Everything else is open.

---

## I. The Art of Game Design — Jesse Schell (the Lens of interrogation)

1. `[BOTH]` Run every win-VFX change through 3 fixed lenses (understand / fair / surprising) as a `/code-review` checklist gate.
2. `[BOTH]` Lens of the Player: storyboard a first-time user's first 60s and fix the weakest beat.
3. `[BOTH]` Lens of Surprise: audit which spins are _predictable_ and inject one honest surprise (near-trigger tease).
4. `[BOTH]` Lens of Fairness: surface RTP + max-win in the info panel within one tap (sourced from math).
5. `[BOTH]` Lens of the Moment-to-Moment: log the 10 most-repeated actions; make the top 3 feel best.
6. `[BOTH]` Lens of Flow: ensure spin→result→next-spin never stalls (cap ceremony hold; honor turbo).
7. `[BOTH]` Lens of Reward: list every reward the player gets; verify each is _felt_ (visual+audio+haptic).
8. `[BOTH]` Lens of Curiosity: a subtle "what's in the bonus?" tease on the buy FAB idle.
9. `[BOTH]` Lens of Accessibility: colour-blind-safe payline palette variant + high-contrast UI theme.
10. `[BOTH]` Lens of Endogenous Value: make the balance count-up feel like _earning_, not a number ticking.
11. `[BOTH]` Lens of Simplicity/Transparency: one-screen "how to win" that never lies.
12. `[BOTH]` Lens of Juiciness: every interactive element gives feedback within 100ms.
13. `[BOTH]` Lens of the Toy: is the base game fun to _fidget_ with (spin spam) before any win? Tune idle life.

## II. Designing Games — Tynan Sylvester (events → emotions)

14. `[CC]` ✅ Lift the 4 ceremony beats into `view-config.ceremony.beats` (data timeline).
15. `[PX]` Port the same beat-timeline data structure to the Pixi ceremony.
16. `[BOTH]` Add an "emotion log" dev overlay: tag each event (win, near-miss, bonus) with its intended emotion.
17. `[BOTH]` Elegance audit: can one mechanic (wilds) generate 3+ distinct experiences? Lean into it.
18. `[BOTH]` Sensory harmony: every detonation flash has a matched audio transient on the same frame.
19. `[BOTH]` Fiction-mechanic fit: the "candy/pop" theme should telegraph low-medium volatility — reconcile with 21.8% hit freq.
20. `[BOTH]` Anticipation arc: the late-reel drag should _crescendo_, not just delay (pitch + edge glow).
21. `[BOTH]` Reward schedule legibility: the player should sense "I'm due a feature soon" only when honestly true.
22. `[CC]` Make `boardDimAlpha` per-tier _ease in_ (180ms) so the savour breathes, not cuts.
23. `[BOTH]` Author a distinct "feature complete" emotional beat (relief + triumph) separate from a line win.
24. `[BOTH]` Spectacle budget: cap simultaneous VFX so the climax always has headroom to escalate.
25. `[BOTH]` A/B two celebration variants behind a flag; measure delight via telemetry.
26. `[BOTH]` Map the "decompression" beat after a big win so the player isn't yanked back to base.

## III. Game Programming Patterns — Robert Nystrom

27. `[CC]` ✅ Enforce the MVC dependency direction (controller→view→model→logic) in CI.
28. `[BOTH]` Formalize `FlowState` as an explicit transition table (idle→spinning→resolving→bonus).
29. `[BOTH]` Add Dirty-Flag to the HUD push so `setBalance`/`syncDeliveredBar` repaint only on change.
30. `[CC]` Extend the Object Pool to coins/embers/beams under one pool budget; assert no `new` in the win hot path.
31. `[BOTH]` Observer audit: every cross-module call goes through events, not direct reach-ins.
32. `[BOTH]` Service Locator for audio/particles/rng so the view never news them up.
33. `[BOTH]` Update Method: confirm all motion is `dt`-based (no frame-count assumptions) for 120fps.
34. `[BOTH]` Component pattern: split the betting bar into composable control components.
35. `[CC]` Double-buffer the win-cell set so a rapid re-win can't read a half-cleared state.
36. `[BOTH]` State pattern for the spin button (idle/spinning/stoppable) to kill the "double-spin" guard hack.
37. `[BOTH]` Event-queue the audio cues so a flurry of wins never stacks into a wash.
38. `[BOTH]` Bytecode/data-driven: the ceremony beats already; do the same for bonus-step pacing.
39. `[BOTH]` Snapshot test the `FlowState` transition table so an illegal edge fails CI.

## IV. Game Engine Architecture — Jason Gregory

40. `[CC]` ✅ Layering test: pure core imports no `cc`.
41. `[BOTH]` ✅ CI tools-pipeline: lint/format/test/RTP-sim on every push.
42. `[BOTH]` Add an ESLint `no-restricted-imports` rule mirroring the layering test (editor-time feedback).
43. `[BOTH]` Asset-budget gate in CI: fail if the bundle grows > N% (Pixi single-file is ~1.4MB).
44. `[BOTH]` Resource manager: lazy-load bonus-only assets (Spine scene, bonus loop) on first feature.
45. `[BOTH]` Deterministic seed path so any spin/ceremony is reproducible for capture + bug repro.
46. `[BOTH]` Frame-time HUD (dev) overlay: fps + draw calls, toggled by a debug key.
47. `[BOTH]` Performance governor: auto-scale VFX density by measured frame time (Pixi has `_gpuWeak`; close the loop both sides).
48. `[BOTH]` Memory: verify no texture/material leaks across 1000 spins (heap snapshot in CI-lite).
49. `[CC]` Script the `build/web-mobile` regeneration so source edits reach the playable build headlessly if possible.
50. `[BOTH]` Single design-token source → generate `palette.ts` + Pixi `THEME` (codegen, not hand-sync).
51. `[BOTH]` Document the layer contract in each folder's README so the boundary is obvious.

## V. A Theory of Fun — Raph Koster (patterns & mastery)

52. `[BOTH]` Novelty budget doc: list every "new pattern" the game teaches; ensure tiers/bonuses each add one.
53. `[CC]` ✅ Three visually-distinct bonus worlds (gold/pink/violet) so they aren't one pattern.
54. `[BOTH]` Add a light meta-progress (non-monetary) — "wilds seen" — to give a long arc to master.
55. `[BOTH]` Vary the anticipation pattern by trigger type (scatter vs wild) so it doesn't get rote.
56. `[BOTH]` Ensure the ceremony tiers are _discriminable_ — a player can tell BIG from MEGA at a glance.
57. `[BOTH]` Avoid "noise": cut any VFX that doesn't carry information (the user-rejected "magenta geometry" lesson).
58. `[BOTH]` Teach the buy-feature value through a one-time "what you get" preview, then never nag.
59. `[BOTH]` Graceful mastery curve: turbo/quick-stop for experts; full ceremony for newcomers.
60. `[BOTH]` Surprise within structure: rare (honest) "double detonation" on a max-win for the connoisseur.
61. `[BOTH]` Pattern legibility: the paytable ordering should make symbol hierarchy learnable at a glance.
62. `[BOTH]` Boredom guard: after N dead spins, an honest near-win tease (never fake a result).
63. `[BOTH]` Track session-novelty: telemetry on how often each tier/bonus is seen; rebalance feel if one never shows.

## VI. Game Feel — Steve Swink (real-time control + juice)

64. `[BOTH]` Define a "feel budget": every control acks visually < 100ms; document the target.
65. `[BOTH]` Unify press-physics: 0.94 squash + elasticOut release across ALL buttons (some still snap).
66. `[PX]` ✅ Win-focus dim so winners dominate (verified live).
67. `[BOTH]` Reel-stop weight: a 60ms bottom-anchored squash as each symbol lands.
68. `[BOTH]` Tune reel-stop bounce elasticity per turbo mode (snappy turbo, juicy normal).
69. `[BOTH]` Wild landing drama: brief 0.12s slow-mo + impact ring (wilds are the brand).
70. `[BOTH]` Spin button rest-breathing (4s sine 1.0↔1.015) so the CTA never looks dead.
71. `[BOTH]` Coin-clink on the balance-credit landing; pitch-climb during the tally.
72. `[BOTH]` Haptics (mobile): light on spin, medium on win-land, heavy on detonation (Web Vibration, gated).
73. `[BOTH]` Camera "juice": a 4–6% push-in on big wins, settle back on dismiss.
74. `[BOTH]` Input buffering: a Space/tap during the last 150ms of a spin queues the next.
75. `[BOTH]` Sub-frame settle overshoot on the win-counter's final lock.
76. `[BOTH]` Audio "body": every visual transient has a low-end thump so it's _felt_, not just seen.
77. `[BOTH]` Consistent easing language: enter ease-out, exit ease-in, never linear (audit all tweens).

## VII. Level Up! — Scott Rogers (mobile / the 3 Cs)

78. `[BOTH]` Thumb-zone audit: spin is the hero, in the natural thumb arc, ≥44px everywhere.
79. `[BOTH]` First-spin warmth: a one-time logo shimmer + soft chord on first interaction.
80. `[BOTH]` Animate the portrait↔landscape relayout (0.3s glide) instead of a hard snap.
81. `[PX]` Fix the portrait header: logo must never overlap the top reel row (reserve a band).
82. `[PX]` Close the portrait dead-space: enlarge the board to dominate the screen.
83. `[BOTH]` Safe-area insets on every edge control (notch/home-indicator aware).
84. `[BOTH]` One-handed reachability: bet steppers + spin reachable without a grip shift.
85. `[BOTH]` Loading → first-frame: the loader _becomes_ the logo (shared-element), no hard cut.
86. `[BOTH]` Tap-target forgiveness: 8px invisible padding around small controls.
87. `[BOTH]` Orientation lock option in settings for players who prefer one.
88. `[BOTH]` Clear "you are here" affordances: active bet level, autoplay count, turbo mode always legible.
89. `[BOTH]` Onboarding coach-marks (dismissible, once) for buy-feature + autoplay.
90. `[BOTH]` Landscape: keep the spin button off the viewport edge (shadow clipping fix already in Pixi).

## VIII. Blood, Sweat, and Pixels — Jason Schreier (production reality)

91. `[BOTH]` ✅ Verify-don't-guess: Playwright capture harness for before/after on Pixi.
92. `[BOTH]` Ship in vertical slices (ROADMAP P0→P3); never a big-bang VFX PR.
93. `[CC]` Document the "Cocos build is invisible until rebuilt" gotcha in the README (cost us this session).
94. `[BOTH]` Keep a human CHANGELOG (started) so the design narrative survives team changes.
95. `[BOTH]` A "celebration design bible" one-pager so the ceremony intent can't drift.
96. `[BOTH]` Scope guard: every new VFX must declare its reduced-motion fallback in the same PR.
97. `[BOTH]` Definition-of-done: a change isn't done until it's screenshot-verified (Pixi) or editor-verified (Cocos).
98. `[BOTH]` Triage the ROADMAP each milestone; cut anything that fails the "one more spin" test.
99. `[BOTH]` Pre-submission checklist (compliance, RTP, max-win, reduced-motion, mobile) as a PR template.
100.  `[BOTH]` Storybook/gallery page rendering every modal/banner/button state for fast review.
101.  `[BOTH]` Capture a 10s "vertical slice" video of base→win→bonus→big-win for stakeholder sign-off.

## IX. Advanced Game Design: A Systems Approach — Michael Sellers (economy & loops)

102. `[BOTH]` WILD STRIKE scaling: raise `maxMultiplier` (3→5) so 4–5 wilds genuinely scale; re-sim RTP.
103. `[BOTH]` Decide + disclose strike-in-bonus (currently off even in STICKY WILDS) — re-anchor costs.
104. `[BOTH]` Buy-EV target: equalize or disclose the 96% buy vs 97.5% base gap per jurisdiction.
105. `[BOTH]` Add the bonus-EV simulator to CI (currently only RTP runs) on a sampled budget.
106. `[BOTH]` Hit-frequency dial: model raising base hit-freq (candy theme wants frequent small wins) vs volatility.
107. `[BOTH]` Volatility disclosure: the game's _feel_ should honestly telegraph its variance.
108. `[BOTH]` Second-order loop map: win→excitement→continue; ensure no dark-pattern reinforcement.
109. `[BOTH]` Max-win reachability: verify the advertised 5,000× is actually reachable (full wild screen + strike) and rare.
110. `[BOTH]` Sticky-wilds growth curve: tune the 0–1/step add so the feature builds without runaway.
111. `[BOTH]` Reel-weight sensitivity doc: which symbol's weight moves RTP most (wild density is the master lever).
112. `[BOTH]` Session-variance model: simulate a 200-spin session's balance curve at each bet level.
113. `[BOTH]` Economy regression: snapshot RTP/hit-freq numbers; CI fails on > ±0.3% drift.
114. `[BOTH]` Per-bonus contribution report: how much each of the 3 features adds to total RTP.

## X. Rules of Play — Salen & Zimmerman (meaningful play)

115. `[BOTH]` "LINE n ×m" readout so every win is _discernible_ (which line, how much).
116. `[BOTH]` Honest wins only: never celebrate a loss (LDW-safe wording everywhere — Pixi has it; audit Cocos).
117. `[BOTH]` Earned anticipation: tension cues fire only on genuine near-states (real 2-scatter / 4-of-5).
118. `[BOTH]` Integrated outcomes: every win visibly changes the balance with a traceable count-up.
119. `[BOTH]` Transparent constitutive rules: paytable/RTP/lines one tap away, sourced from math (can't drift).
120. `[CC]` Win-line readability cycle: one bright line at a time + a soft "LINE 7 · ×12" label (`lineCycleSeconds` exists).
121. `[BOTH]` Calm losses: a losing spin resolves cleanly and quietly — no "almost!" nagging.
122. `[BOTH]` Predictable controls: spin never moves; no accidental max-bet; confirm on buy.
123. `[BOTH]` Session-care surfacing: reality-check + time/spend framed supportively, not hidden.
124. `[BOTH]` Pace control: turbo OFF should feel _luxurious_, never punished.
125. `[BOTH]` Remembered preferences: reduced-motion, sound, orientation are first-class + persisted.
126. `[BOTH]` Discernible bonus state: the player always knows spins-left + running feature total.
127. `[BOTH]` Magic-circle entry/exit: a deliberate "enter feature / return to base" transition both ways.

## Cross-cutting (the spine of all 10)

128. `[BOTH]` Telemetry hooks (privacy-safe) on spin/win/buy/feature so every item above is _measured_, not guessed.
129. `[BOTH]` One "feel + economy" dashboard: RTP, hit-freq, juice-layer count, input-latency in one place.
130. `[BOTH]` The "one more spin" test: after every change, ask _did this make me want one more spin for the right reasons?_ If not, cut it.

---

### How a future session should use this

1. Pick a book section that matches the current goal (drama → II/VI, balance → IX, trust → X, speed/quality → III/IV).
2. Take 3–5 numbered items into a vertical slice.
3. **Pixi-verify → Cocos-port**, each guarded by a test or a screenshot.
4. Tick it here; update `PARITY-MATRIX.md` and `CHANGELOG.md`.

> North star (unchanged): every spin alive · every win earned · big wins tell a story.
