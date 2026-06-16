# Development notes

A 5×3, 10-payline **candy-themed** video slot — Cocos Creator 3.8.8 + TypeScript,
MVC, code-driven runtime scene. WILD STRIKE base feature, a scatter that pays
anywhere and triggers free spins, and three buy-bonus modes. Glossy sweet-shop
visuals (gummy bears, lollipops, a gingerbread wild) with `.effect` shader VFX.

This file is the contributor's map. Player-facing overview is in [README.md](README.md).

---

## 1. Scope (from the BrainRocket brief)

> _Simple slot, 5 reels × 3 symbols, Cocos Creator 2.x/3.x, TypeScript, Cocos
> Tween or GreenSock for animation, modular MVC architecture, public assets._

The brief's core is implemented exactly — 5×3 grid, 10 fixed paylines, the given
paytable, Wild substitutes all — then built out into a full candy slot: a
**WILD STRIKE** base feature, a **scatter** (pays anywhere; 3+ triggers free
spins), **Sticky-Wilds free spins**, and three **buy-bonus** modes. Math/RTP
(**≈ 97.8 %**) lives in the engine-agnostic logic layer and is verified by the
node:test suite + the Monte-Carlo sim.

## 2. Architecture (MVC)

```
assets/scripts/
  logic/                 PURE rules — no Cocos imports, unit-tested + RTP-simmed
    game-config.ts         DATA: symbols, paytable, 10 paylines, reel weights
    spin-engine.ts         buildStrip · spinGrid · evaluateLine · evaluateSpin
    win-cells.ts           which cells a win touches (for highlighting)
    rng.ts (mulberry32) · types.ts · index.ts
  model/slot-model.ts    MODEL — balance/bet state + play(); no Cocos, no render
  view/                  VIEW — code-driven Cocos, no game rules
    slot-view.ts           builds the board + HUD + Spin button; presentation API
    reel-view.ts           one masked reel: scroll/stop tween + win highlight
    symbol-view.ts         one cell: sprite + win pulse
    view-config.ts         DATA: layout, spin/win timings (designers tune here)
  controller/slot-controller.ts
                         CONTROLLER + composition root — the ONE component on the
                         Canvas. Builds the View, owns the Model, runs the spin flow.
tools/                   rtp-sim.ts (Monte-Carlo RTP) + slice-*.sh (asset pipeline)
tests/                   node:test unit tests for the pure logic
```

**The single rule that keeps it MVC:** the **Model** decides every outcome and
never imports Cocos; the **View** renders what it is told and never computes a
payout; the **Controller** is the only place the two meet. Because `logic/` has
zero engine imports, the exact code that runs the game is what `tools/rtp-sim.ts`
and `tests/` exercise — math correctness is provable offline.

There is **one** runtime path: `SlotController` (wired into `assets/game.scene`)
builds the whole scene from code at Play. No parallel/dead implementations.

## 3. How to run

- **Game:** open the project in **Cocos Creator 3.8.8** and press **Play**. The
  scene already has `SlotController` on the Canvas; it builds reels, HUD and the
  Spin button from code and loads symbol art from `assets/resources/`.
- **Build:** Project → Build → Web for the deliverable.

```bash
npm install
npm test          # unit tests (pure logic — paytable, paylines, Wild, eval)
npm run sim       # Monte-Carlo RTP / hit-frequency (2M spins; pass N for more)
npm run lint      # ESLint (flat config + typescript-eslint)
npm run format    # Prettier
```

## 4. Math

- RTP is shaped **only** by `REEL_WEIGHTS` in `logic/game-config.ts` — the
  paytable is fixed by the spec and is never altered to chase a number.
- `buildStrip` spreads each symbol's copies **evenly** around the reel strip (not
  in blocks), which lifts hit frequency without changing per-line odds.
- Run `npm run sim` for the current RTP / hit-frequency at the committed weights.

## 5. Asset pipeline

Symbols live in `assets/resources/sym/` (10 sliced PNGs, loaded by id at runtime);
the Spin button uses `assets/resources/ui2/spin_idle|spin_active`. The
`tools/slice-*.sh` ImageMagick scripts document how the public-asset atlases were
cropped. **Never delete a `.meta`** — it breaks the resource bundle.

## 6. Conventions

ESLint flat config + Prettier; Conventional Commits enforced via commitlint +
husky (`pre-commit` runs lint-staged). Author: **Edgar Hovsepyan**.
