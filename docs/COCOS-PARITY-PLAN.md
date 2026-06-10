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

| Case                                                           | Pixi | Cocos | Notes                                                             |
| -------------------------------------------------------------- | ---- | ----- | ----------------------------------------------------------------- |
| Trapezoidal velocity curve (accel 0.10 / decel 0.34)           | ✅   | ✅    | view-config mirrors master                                        |
| Stop stagger 88ms L→R, min spin 440ms                          | ✅   | ✅    |                                                                   |
| Anticipatory wind-up kick before launch                        | ✅   | ✅    | OFF mode only                                                     |
| Velocity-coupled motion blur                                   | ✅   | 🔶 M  | config staged (`spin.blur`), reel-view hook pending               |
| Land squash + bottom→top symbol ripple per turbo mode          | ✅   | ✅    | `land` table                                                      |
| Anticipation drag + glow on late reels (2+ early wilds)        | ✅   | ✅    | + anticipation audio                                              |
| WILD landing strike (punch + hot glow + sample)                | —    | ✅    | Cocos-first; port BACK to Pixi                                    |
| Reel window chrome: per-cell glass plates, cream candy borders | ✅   | 🔶 M  | v2 has glass columns; master's per-cell candy borders pending     |
| 120 fps (uncapped frame rate)                                  | 🔶   | ✅    | Cocos `frameRate=120`; Pixi ticker check pending (Session 1 lane) |

## 3. Betting bars

| Case                                                                                       | Pixi | Cocos | Notes                              |
| ------------------------------------------------------------------------------------------ | ---- | ----- | ---------------------------------- |
| WEB bar: account / LAST WIN / TOTAL BET / carousel / coins / ×2 / turbo / auto / SPIN ring | ✅   | ✅    | faithful port, screenshot-verified |
| Swipe bet carousel (drag, snap, center pill)                                               | ✅   | ✅    |                                    |
| Floating VOLUME panel (track, knob, mute, close)                                           | ✅   | ✅    |                                    |
| MOBILE bar (540×684 portrait overlay)                                                      | ✅   | ✅    | pre-existing, candy palette        |
| Orientation-driven bar swap + resize rebuild                                               | n/a  | ✅    | Cocos-specific                     |
| Spin arrow 360° flourish on press                                                          | ✅   | ✅    |                                    |
| Demo-mode ribbon                                                                           | ✅   | ⬜ S  | mobile bar has it; web bar stub    |

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
| Reality Check (session timer popup)                     | ✅   | ⬜ M  | COMPLY table port                                 |
| Error modal (dismissible, social-safe text)             | ✅   | ⬜ M  |                                                   |
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
| Per-mode bonus atmosphere (standard/hot/mega washes)                         | ✅   | ⬜ M  | frost tints staged in config           |
| Free-spin counter HUD (spins left + running total)                           | ✅   | ⬜ M  | approval point                         |

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

| Case                                              | Pixi | Cocos | Notes                                          |
| ------------------------------------------------- | ---- | ----- | ---------------------------------------------- |
| Branded HTML loader (logo, gliding bar, shine)    | ✅   | ✅    | build-template port                            |
| Loader progress driven by REAL asset loading      | ✅   | ⬜ M  | v2 bar is timed; hook cc.assetManager progress |
| TAP-TO-PLAY intro with logo + pulsing CTA         | ✅   | ✅    |                                                |
| Intro art parity (master uses full art treatment) | ✅   | 🔶 M  | v2 intro is text+plate; use logo.png + bg      |
| Real logo / candy symbols / painted bg            | ✅   | ✅    | black-keyed offline                            |
| Page title + meta branding                        | ✅   | ✅    |                                                |

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
