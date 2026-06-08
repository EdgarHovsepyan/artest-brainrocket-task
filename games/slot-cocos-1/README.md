# Slot Game — Cocos Creator

A **5-reel × 3-row, 10-payline** video slot built with **Cocos Creator 3.8.8** and
**TypeScript**. Clean **MVC** split between engine-agnostic game logic and a
code-driven Cocos view; animation is **Cocos Tween**. Visual identity: industrial
brutalism — acid `#EAFF00` on jet black, hard edges, snappy motion.

> **Task (BrainRocket):** _"Write a simple slot (5 reels, 3 symbols each) using
> Cocos Creator 2.x/3.x. The code must be in TypeScript. Use Cocos Tween or
> GreenSock for animations. Architecturally, try to adhere to a modular
> architecture with the MVC pattern. Use any publicly available assets."_

Author: **Edgar Hovsepyan**

---

## Run it

Open the project in **Cocos Creator 3.8.8** and press **Play**. The scene
(`assets/game.scene`) already has the `SlotController` component on the Canvas; it
builds the reels, HUD and Spin button from code and loads the symbol art from
`assets/resources/`. Click **Spin** (or press **Space**).

```bash
npm install
npm test        # unit tests for the pure game logic
npm run sim     # Monte-Carlo RTP / hit-frequency simulation
npm run lint    # ESLint (flat config + typescript-eslint)
npm run format  # Prettier
```

To produce the web build: **Project → Build → Web**.

---

## Game (to spec)

The game implements the provided spec exactly — **base game only**
("Main game only / Separate screen features: no"):

- **5×3** grid, **10 fixed paylines**, wins pay **left-to-right**.
- Symbols: **Wild** (substitutes for all), high **H1–H4**, low **L1–L5**.
- Per line, the better of the substituted-symbol run and a pure-Wild run pays.
- Paytable and the 10 paylines are taken verbatim from the spec — see
  [`game-config.ts`](assets/scripts/logic/game-config.ts) and the
  matching unit tests in [`tests/`](tests/spin-engine.test.ts).

**Math.** RTP is shaped only by the reel composition (`REEL_WEIGHTS`); the spec's
paytable is never altered to chase a number. At the committed weights the base
game measures **RTP ≈ 95.6%** at a **~25% hit frequency** (`npm run sim`). The
simulator runs the _same_ pure engine the game runs, so the figure is the one a
player experiences.

---

## Architecture (MVC)

```
assets/scripts/
  logic/                 MODEL core — PURE rules, no Cocos imports
    game-config.ts         DATA: symbols, paytable, 10 paylines, reel weights
    spin-engine.ts         buildStrip · spinGrid · evaluateLine · evaluateSpin
    win-cells.ts · rng.ts · types.ts · index.ts
  model/slot-model.ts    MODEL state — balance/bet + play() (decides outcomes)
  view/                  VIEW — code-driven Cocos, no game rules
    slot-view.ts           builds board + HUD + Spin button; presentation API
    reel-view.ts           one masked reel: scroll/stop Tween + win highlight
    symbol-view.ts         one cell: sprite + win pulse
    view-config.ts         DATA: layout + spin/win timings
  controller/
    slot-controller.ts     CONTROLLER + composition root (the component on Canvas)
tools/   rtp-sim.ts (Monte-Carlo) · slice-*.sh (asset pipeline)
tests/   node:test unit tests for the pure logic
```

**The contract that keeps it MVC:** the **Model** decides every outcome and never
imports Cocos; the **View** only renders what it is told and never computes a
payout; the **Controller** is the single place the two meet
(`input → Model.play() → View.playSpin()`). Because `logic/` has zero engine
imports, the exact code that runs the game is what the tests and the RTP simulator
exercise — correctness is provable offline. There is **one** runtime path; no
parallel or dead implementations.

---

## Features

- **Real reel spin** — each reel scrolls a masked strip on a single
  velocity-matched curve (smooth wind-up → cruise → dead stop), with a
  left→right stop stagger and a squash "thunk" on landing.
- **Win presentation** — winning paylines drawn as cycling acid polylines,
  winning symbols pulse, and the win amount counts up kinetically.
- **Responsive** — contain-fit to any aspect ratio; rebuilt on resize.
- **Robust assets** — symbols render from a sprite atlas, with a text fallback so
  the board still reads if art is missing.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the contributor's map.
