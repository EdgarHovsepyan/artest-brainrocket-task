# Adding a game

Each game is a folder under `games/` that owns its `SlotMathConfig`, art, and
build, and consumes the shared packages via `workspace:*`.

## PixiJS game (Stake-shippable)

1. `games/<name>/` = a Vite app with `vite-plugin-singlefile`.
2. `package.json` depends on `@artest/math-core`, `@artest/stake-adapter`, `@artest/ui-kit`.
3. Define the game's `SlotMathConfig` (reels, rows, wildId, paytable, paylines, reelWeights).
4. Tune RTP to target with `pnpm --filter <name> sim` (adjust `reelWeights` only).
5. `dev` (Vite HMR), `build`, then `package:stake` (single file + outcome books).

## Cocos game

1. `games/<name>/` = a full Cocos Creator 3.8.8 project.
2. Vendor `math-core` into `assets/scripts/` via a `sync-math` step (the editor
   resolves imports from `assets/`, so the compiled `math-core` is copied in;
   git keeps `packages/math-core` as the single source).
3. Define the config, tune RTP via `sim`, build via the editor (Project → Build → Web).

## Every game

- `pnpm --filter <name> test` — unit tests on the pure logic.
- `pnpm --filter <name> sim` — Monte-Carlo RTP.
- Targets ~96% RTP; ships only ARTEST | BrainRocket branding.
