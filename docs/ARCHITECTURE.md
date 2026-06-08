# Architecture

## Principle

**Math decides, the game renders.** `@artest/math-core` is pure TypeScript with no
engine imports. Every game, the RTP simulator, and the shipped outcome books run
that same code, so the math a player experiences is the math we verify offline.

## Layers

1. **`packages/math-core`** — `SlotMathConfig` in, results out. RNG (mulberry32),
   reel-strip build, line/spin evaluation, RTP simulation, and Stake-style
   outcome-book + lookup-table generation. A game supplies a config; RTP is shaped
   only by `reelWeights` (paytables stay as specified).
2. **`packages/stake-adapter`** — the casino-RGS client contract: money scaling
   (×10⁶ wire, ×100 multipliers), `RgsClient` + `MockRgs` (samples books offline),
   and (roadmap) single-file packaging + brand-lint.
3. **`packages/ui-kit`** — engine-neutral UI/compliance helpers.
4. **`games/<name>`** — the view layer for one game in its native engine. It owns
   its `SlotMathConfig`, its art, and its build; it imports the packages above.

## Two engines, one math

- **PixiJS games** are Vite apps that build to a single inlined `index.html`
  (the casino-RGS front-end shape).
- **Cocos games** are built by the Cocos Creator editor. They consume `math-core`;
  because the editor resolves imports from `assets/`, a Cocos game vendors the
  compiled `math-core` into `assets/scripts/` via a small sync step (see
  [ADDING-A-GAME.md](ADDING-A-GAME.md)).

Builds never share a bundler; only the math and contracts are shared.
