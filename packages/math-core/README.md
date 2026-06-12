# @artest/math-core

Engine-agnostic slot math — **zero PixiJS/Cocos imports**, so the exact code that
runs a game is what the simulator and the Stake outcome-book generator run. The
single source of truth for every ARTEST game.

## API

- `createRng(seed)` — deterministic mulberry32 RNG.
- `buildStrip` / `buildStrips` — reel weights → even-spread strips.
- `spinGrid` / `evaluateLine` / `evaluateSpin` / `spin` — config-driven reel + line evaluation.
- `winningCellsByReel` — cells to highlight for a result.
- `simulate(config, spins, seed, { includeFeatures })` — Monte-Carlo RTP (base + feature split) / hit-frequency / max-win.
- **Advanced features:** `scatterCount` / `scatterWinX`, `runFreeSpins` (multiplier + retrigger + cap + max-win), `solveBuyCost` (fair buy-feature price = mean feature win / RTP anchor), `classifyWinTier` (ceremony bands).
- `generateOutcomeBooks(config, opts)` — Stake books + lookup table; `rtpFromLookup`, `buildIndex`, `toLookupCsv`, `toBooksJsonl` serializers.

A game supplies a `SlotMathConfig` (reels, rows, wildId, paytable, paylines,
reelWeights). RTP is shaped only by `reelWeights`; paytables stay as specified.

```bash
pnpm --filter @artest/math-core build
pnpm --filter @artest/math-core test
pnpm --filter @artest/math-core sim 2000000
```
