# Parity Matrix — `shining-pop` (Pixi) ↔ `shining-pop-v2` (Cocos)

Wave 2 deliverable (see `ARCHITECTURE-STRATEGY.md`). A living map of every
feature across the two engines so neither game silently lags — and so a
"distinct pattern" (Koster) is a deliberate divergence, never an accident.

**Legend:** ✅ done · ◐ partial / differs · ⏳ planned · — n/a

| Feature                                | Pixi `shining-pop` | Cocos `shining-pop-v2`  | Notes                                                                    |
| -------------------------------------- | :----------------: | :---------------------: | ------------------------------------------------------------------------ |
| **Core gameplay**                      |                    |                         |                                                                          |
| 5×3 reels, 10 paylines                 |         ✅         |           ✅            | Shared rules via `@artest/math-core`                                     |
| Left-to-right line eval (wild best-of) |         ✅         |           ✅            | Pure core; identical math                                                |
| WILD STRIKE base feature               |         ✅         |           ✅            | Always ×3 today (`maxMultiplier=3`) — Wave 5 dial                        |
| Bet levels / total-bet model           |         ✅         |           ✅            | `BET_LEVELS_CENTS` multiples of 100                                      |
| **Bonus / features**                   |                    |                         |                                                                          |
| 3 Buy-Feature modes                    |         ✅         |           ✅            | wilds / crowns / reels                                                   |
| Bonus affordable at demo balance       |         ✅         |           ✅            | Cocos fixed this session ($100→$1,000)                                   |
| Distinct per-mode identity             |         ◐          |           ✅            | Cocos: gold/pink/violet worlds + per-mechanic lock; Pixi simpler         |
| Free-spins playback                    |         ✅         |           ✅            | Controller loops steps; sticky wilds/crowns                              |
| Free-spins "world change" bg           |         ◐          |           ✅            | Cocos Cupids-Crush Spine scene; Pixi tint/portal                         |
| **Win presentation**                   |                    |                         |                                                                          |
| Tiered win ceremony (BIG→EPIC)         |         ✅         |           ✅            |                                                                          |
| Detonation flash + shockwave           |         ◐          |           ✅            | Cocos rebuilt this session (fires on Spine path too)                     |
| Beat-timeline as data                  |         —          |           ✅            | Cocos `ceremony.beats`; Pixi literals (Wave 2 follow-up)                 |
| Kinetic count-up + heartbeat           |         ✅         |           ✅            | Both frame-stepped                                                       |
| Coin geyser physics                    |         ◐          |           ✅            | Cocos ballistic rise/spin/fall this session                              |
| Win-line presentation                  |         ✅         |            ◐            | Pixi: colored cycling polylines; Cocos: shader beams (`showLines:false`) |
| Per-line colour identity               |         ✅         |           ✅            | Cocos beam core this session                                             |
| Win-focus dim                          |         ✅         |           ✅            | Pixi 0.26, Cocos 95/255                                                  |
| "LINE n ×m" readout                    |         ⏳         |           ⏳            | Wave 4 (discernible-outcome)                                             |
| **Feel / juice**                       |                    |                         |                                                                          |
| Reel-stop bounce (elastic)             |         ✅         |           ✅            |                                                                          |
| Velocity motion blur                   |         ✅         |            ◐            | Pixi GPU blur; Cocos disabled (read as arrows)                           |
| Anticipation drag on near-trigger      |         ✅         |           ✅            | Config `extraSeconds`                                                    |
| Idle symbol micro-life                 |         ✅         |           ✅            | High-value symbols only                                                  |
| 11 GLSL `.effect` shaders              |         —          |           ✅            | Cocos-only; Pixi uses procedural Graphics + GSAP                         |
| Spine hero callout                     |         ✅         |           ✅            | Pixi crownwild; Cocos cupid-wf                                           |
| **Audio**                              |                    |                         |                                                                          |
| Multi-bus mixer + tiered stings        |         ◐          |           ✅            | Cocos `audio-manager` buses; Pixi clip bank                              |
| Dynamic music intensity (stems)        |         ⏳         |           ⏳            | Wave 5                                                                   |
| **UI / UX**                            |                    |                         |                                                                          |
| Mobile portrait + landscape            |         ✅         |           ✅            | Both responsive                                                          |
| Betting bar (shared design lang)       |         ✅         |           ✅            |                                                                          |
| Buy-feature modal                      |         ✅         |           ✅            | Cocos close now animated (this session)                                  |
| Info / paytable (sourced from math)    |         ✅         |           ✅            | `info-content`                                                           |
| Settings / autoplay / turbo            |         ✅         |           ✅            |                                                                          |
| Reality check / compliance gates       |         ✅         |            ◐            | Pixi `COMPLY`/`rcModal`; Cocos `compliance` logic                        |
| Keyboard shortcuts                     |         ✅         |           ✅            | Space / B / T / etc.                                                     |
| Reduced-motion fallback                |         ✅         |           ✅            | Every VFX                                                                |
| Build watermark in UI                  |         ◐          |            —            | Pixi shows `build NN` (cleanup pending)                                  |
| **Engineering**                        |                    |                         |                                                                          |
| Pure core, no engine imports           |         ✅         |           ✅            | Cocos guarded by `architecture.test.ts`                                  |
| Headless unit tests                    |         ◐          |           ✅            | Cocos 57 tests; Pixi via shared math-core                                |
| RTP / bonus simulators                 |         ✅         |           ✅            | Shared `@artest/math-core`                                               |
| Design-token source of truth           |         ◐          |           ✅            | Cocos palette drift-guarded; Pixi THEME follow-up                        |
| CI gate                                |         ✅         |           ✅            | Repo-wide `.github/workflows/ci.yml`                                     |
| Committed review build                 |    ✅ (`dist`)     | ✅ (`build/web-mobile`) | Cocos build needs editor rebuild to refresh                              |

## Top divergences to close (priority order)

1. **Detonation flash + beat-timeline → port to Pixi** (Cocos is ahead). _Wave 2/4_
2. **"LINE n ×m" readout → both engines** (discernible outcome). _Wave 4_
3. **Pixi THEME → lock to `design-tokens.json`** (finish the SoT). _Wave 2_
4. **Multi-bus audio + dynamic music → Pixi parity.** _Wave 5_
5. **Remove the Pixi build watermark from the live UI.** _P0 hygiene_

> Rule: a row is allowed to be ◐ only when the divergence is a **deliberate**
> engine-appropriate choice (e.g., shaders vs. procedural Graphics). Accidental
> lag is a bug.
