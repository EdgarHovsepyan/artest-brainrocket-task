# ARTEST | BrainRocket — Slot Games Studio

**by Edgar Hovsepyan**

A multi-engine monorepo of production slot games. Shared, provably-correct slot
math feeds many games across **PixiJS v8** and **Cocos Creator 3.8.8**, each
shippable as a self-contained single-file build with its own outcome-book math.

## Portfolio

| Game         | Engine            | RTP     | Features                            | Status                |
| ------------ | ----------------- | ------- | ----------------------------------- | --------------------- |
| slot-cocos-1 | Cocos Creator 3.8 | ~97 %   | WILD STRIKE + 3 buy free-spin modes | visuals in; editor QA |
| slot-pixi-1  | PixiJS v8 + GSAP  | ~96.5 % | scatter free-spins + buy + i18n     | single-file, verified |

> Target: **10+ games**, mixed engines, each ~96% RTP.

## Architecture

```
packages/
  math-core/     engine-agnostic slot math — RNG, reel/line eval, RTP sim,
                 outcome-book generation. The single source of truth.
  stake-adapter/ casino-RGS client contract: money scaling, mock RGS, replay,
                 single-file packaging + brand-lint (roadmap).
  ui-kit/        engine-neutral HUD / compliance primitives.
games/
  <name>/        one game per folder, native build (Vite for Pixi, editor for Cocos),
                 consuming the shared packages via workspace:*.
docs/            architecture, the casino-RGS approval checklist, RTP methodology.
```

The rule that keeps every game correct: **`math-core` decides outcomes; the game
only renders them.** The same pure code runs the game, the RTP simulator, and the
shipped math — so correctness is provable offline.

## Quick start

```bash
pnpm install
pnpm -r build          # build shared packages
pnpm test              # unit tests across packages
pnpm sim               # Monte-Carlo RTP of the math-core fixture
pnpm lint              # ESLint (flat config)
```

Per game: `pnpm --filter <game> dev | build | test | sim`. See
[docs/ADDING-A-GAME.md](docs/ADDING-A-GAME.md).

## Engineering standards

Conventional Commits (commitlint + husky), shared ESLint/Prettier, the casino-RGS
compliance checklist ([docs/STAKE-CHECKLIST.md](docs/STAKE-CHECKLIST.md)), and a
brand-lint gate so shipped artifacts carry **only** ARTEST | BrainRocket branding.

© Edgar Hovsepyan — ARTEST | BrainRocket. All rights reserved.
