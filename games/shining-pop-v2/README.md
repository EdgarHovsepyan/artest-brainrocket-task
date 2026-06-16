# Shining Pop — Cocos Creator

A **5-reel × 3-row, 10-payline** candy-themed video slot built with **Cocos Creator
3.8.8** and **TypeScript**. A clean **MVC** split keeps the engine-agnostic game
logic separate from a fully **code-driven** Cocos view — the reels, HUD, controls
and effects are all built from script, not hand-placed in the scene. Animation is
**Cocos Tween**; win/feature VFX are layered `cc.Graphics` + custom `.effect`
shaders.

> **Task (BrainRocket):** _"Write a slot (5 reels, 3 symbols each) using Cocos
> Creator 2.x/3.x in TypeScript. Use Cocos Tween or GreenSock for animations.
> Adhere to a modular MVC architecture. Use any publicly available assets."_

Author: **Edgar Hovsepyan**

---

## The game

A glossy **candy / sweet-shop** slot — gummy bears, lollipops, candy canes and
gem-drops, with a smiling gingerbread **WILD** holding a heart lollipop.

|                  |                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------ |
| **Grid**         | 5 reels × 3 rows, **10 fixed paylines** (pay left→right)                             |
| **Base feature** | **WILD STRIKE** — wild multipliers in the base game                                  |
| **Scatter**      | the swirl lollipop pays **anywhere** on the grid; **3+** also triggers free spins    |
| **Free spins**   | **Sticky Wilds**, awarded by scatter count                                           |
| **Buy Bonus**    | three modes, sorted by value — **Wild Reels** · **Sticky Crowns** · **Sticky Wilds** |
| **RTP**          | **≈ 97.77 %** (Monte-Carlo verified — `npm run sim`)                                 |

Math/RTP is owned by the logic layer; the view only renders the values it is given.

---

## Run it

Open the project in **Cocos Creator 3.8.8** and press **Play**. The scene
(`assets/game.scene`) carries a single `SlotController` on the Canvas, which builds
the reels, HUD, control deck and Spin button from code and loads art from
`assets/resources/`. Click **Spin** (or press **Space**).

```bash
npm install
npm test           # 75 node:test unit tests for the pure game logic
npm run sim        # Monte-Carlo RTP / hit-frequency simulation
npm run sim:bonus  # bonus-mode simulation
```

A pre-built **web-mobile** bundle is committed at `build/web-mobile/` (served by the
repo's demo assembler); regenerate it from Cocos Creator (**Project → Build → Web
Mobile**) after a source change.

---

## Architecture (MVC)

```
assets/scripts/
  logic/        ← engine-agnostic, fully unit-tested (no Cocos imports)
    game-config.ts     symbols, 10 paylines, bet ladder, bonus modes, scatter
    spin-engine.ts     grid generation + payline evaluation
    bonus-engine.ts    free-spins / sticky / wild-reels steps
    rng.ts · money.ts · compliance.ts · info-content.ts
  model/        ← session / bet / balance state over the logic
  controller/   ← SlotController: orchestrates model ↔ view, autoplay, buy-bonus
  view/         ← code-built Cocos view (SlotView, ReelView, SymbolView,
                  CeremonyView, particle layers, AudioManager) + view-config.ts
  ui/           ← betting bar (portrait + landscape variants)
assets/resources/   symbols, backgrounds, .effect shaders, spine, audio
tests/              node:test suites for logic, config, compliance, money
```

**The contract that keeps it MVC:** the **logic/model** layer decides every outcome
and imports nothing from Cocos; the **view** only renders what it is told and never
computes a payout; the **controller** is the single place the two meet
(`input → model.play() → view.playSpin()`). Because `logic/` has zero engine
imports, the exact code that runs the game is what the tests and the RTP simulator
exercise — correctness is provable offline. There is **one** runtime path; no
parallel or dead implementations.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the contributor's map.
