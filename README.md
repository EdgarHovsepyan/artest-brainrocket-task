<div align="center">

<img width="820" alt="ARTEST | BrainRocket" src="https://github.com/user-attachments/assets/f1a2b62f-db87-410d-a631-765c4eb0ebf7" />

# Shining Pop — Multi-Engine Slot Studio

**by Edgar Hovsepyan** · one engineer, two engines, one provably-correct math core

[![PixiJS](https://img.shields.io/badge/PixiJS-v8-e91e63?logo=javascript&logoColor=white)](games/shining-pop)
[![Cocos Creator](https://img.shields.io/badge/Cocos%20Creator-3.8.8-55c2e1?logo=cocos&logoColor=white)](games/shining-pop-v2)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](#engineering-standards)
[![Tests](https://img.shields.io/badge/tests-73%2F73%20passing-2ea043)](#quality-gates)
[![RTP](https://img.shields.io/badge/RTP-~97%25%20sim--anchored-f5a623)](#developer-quick-start)

_Two production slot games on one deterministic, sim-anchored math core —
designed, built and verified end-to-end by a single developer._

</div>

---

## The games

| Game                                       | Engine              | Stack                                | RTP     | Status                         |
| ------------------------------------------ | ------------------- | ------------------------------------ | ------- | ------------------------------ |
| **[shining-pop](games/shining-pop)**       | PixiJS v8           | Vite · GSAP · Spine · Web Audio      | ~97 %   | flagship — submission-ready    |
| **[shining-pop-v2](games/shining-pop-v2)** | Cocos Creator 3.8.8 | code-driven MVC · 9 CCEffect shaders | ~97.5 % | parity port + shader VFX suite |

## ▶ Live demo

Both games are deployed from one static bundle behind a landing page — reviewers
can play either without cloning or installing anything:

|                                    | Play                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| **Landing** (both games)           | `https://<your-vercel-app>.vercel.app/`               |
| **shining-pop** · PixiJS v8        | `https://<your-vercel-app>.vercel.app/shining-pop`    |
| **shining-pop-v2** · Cocos Creator | `https://<your-vercel-app>.vercel.app/shining-pop-v2` |

> Replace `<your-vercel-app>` with the deployed URL. **Deploy in one step** — the
> repo is Vercel-ready (`vercel.json` + `scripts/assemble-demo.mjs`):
>
> ```bash
> npx vercel --prod          # or: import the GitHub repo at vercel.com/new
> ```
>
> Vercel runs `assemble-demo.mjs`, which copies the two committed builds into
> `/public` at clean paths (`/shining-pop`, `/shining-pop-v2`) behind an
> expert landing page. Each game keeps its own directory root so its assets
> resolve — verified booting at both subpaths. Works the same on Netlify /
> GitHub Pages (point the host at the `public/` the script produces).

## Instant run — no toolchain needed

Both playable builds ship in the repo. With Node ≥ 20 installed, run from the repo root:

```bash
node scripts/preview.mjs
#  ▶ PixiJS  — shining-pop     http://localhost:5180
#  ▶ Cocos   — shining-pop-v2  http://localhost:8200
```

No install step, no dependencies — open either URL and play.
(`npx serve games/shining-pop/dist -l 5180` works too if you prefer.)

## Screens

<div align="center">

<img width="860" alt="Cocos Creator — base game" src="docs/media/cocos-desktop.png" />

_Cocos Creator 3.8.8 — candy reskin, authored icon set, full-bleed reels_

<img width="860" alt="Cocos Creator — win presentation" src="docs/media/cocos-win.png" />

_Win presentation: gold payline core + flowing plasma beam · per-symbol shader fire · jelly squash-and-stretch · win-focus dim_

<img width="860" alt="Cocos Creator — Spine win-callout ceremony" src="docs/media/cocos-ceremony.png" />

_Spine 4.2 win-callout: winged golden-heart banner, cotton-candy cloud, floating petals, kinetic gold count-up — tier-scaled, with a procedural fallback_

<table>
  <tr>
    <td align="center" valign="top">
      <img width="230" alt="Cocos mobile portrait" src="docs/media/cocos-mobile.png" /><br/>
      <em>Portrait: safe-area deck, docked BUY BONUS,<br/>44 px targets</em>
    </td>
    <td align="center" valign="top">
      <img width="540" alt="PixiJS intro" src="docs/media/pixi-desktop.png" /><br/>
      <img width="540" alt="PixiJS board" src="docs/media/pixi-board.png" /><br/>
      <em>PixiJS v8 flagship — branded intro gate &amp; full control surface</em>
    </td>
  </tr>
</table>

</div>

## Architecture

```mermaid
flowchart LR
    subgraph packages ["packages/ — shared core"]
        MC["math-core<br/>RNG · reel/line eval<br/>RTP sim · outcome books"]
        SA["stake-adapter<br/>wallet contract · mock RGS<br/>single-file pack"]
        UK["ui-kit<br/>compliance primitives"]
    end
    subgraph games ["games/ — views only, zero math"]
        SP["shining-pop<br/>PixiJS v8 · Vite singlefile<br/>GSAP · Spine · Web Audio"]
        SPV2["shining-pop-v2<br/>Cocos Creator 3.8.8<br/>code-driven MVC scene"]
    end
    MC --> SA
    MC -->|"workspace:*"| SP
    MC -->|"workspace:*"| SPV2
    SA --> SP
    SP -->|"vite build + inline"| OUT1["dist/index.html<br/>(single file)"]
    SPV2 -->|"headless CLI build"| OUT2["build/web-mobile"]
```

**One math core, two render targets** — a payout rule or RTP tune happens once and
both games inherit it; a cross-engine drift test enforces it. The rule that keeps
every game correct: **math decides, the game renders.** Money is never recomputed
in a view.

```mermaid
sequenceDiagram
    participant U as Player
    participant C as Controller
    participant M as Math core (pure)
    participant V as View (engine-only)
    U->>C: spin()
    C->>M: resolveSpin(bet, rng)
    M-->>C: SpinResult { grid, lineWins, feature }
    C->>V: spinTo(grid)
    V-->>C: reels settled
    C->>V: showWins(result)
    Note over V: payline core + plasma beam<br/>symbol fire · soft-burst · jelly wobble
    C->>V: setBalance / setLastWin (render-only)
```

## Feature highlights

- **Math owned end-to-end** — seeded RNG, reel-strip builder, line evaluator,
  WILD STRIKE, three buy-bonus modes with sim-anchored costs, a 2M-spin
  Monte-Carlo simulator, outcome-book generator, and a cross-engine drift suite.
- **A real shader VFX suite (Cocos)** — nine custom CCEffect programs (WebGL2 +
  ES100 variants): per-symbol fire clipped to each symbol's alpha silhouette,
  rim-light + specular sweep, banding-free soft-burst glow with rotating rays,
  flowing payline plasma with a traveling pulse, reel portal warp, buy-button
  plasma. Every shader honors a master switch, reduced-motion, and a vector
  fallback.
- **Modern win language** — winners jelly-wobble while non-winners dim back;
  a crisp 3 px gold payline core rides a soft plasma bloom; a tier-scaled Spine
  win-callout (winged-heart banner + cotton-candy cloud) crowns the big wins,
  with a procedural light-rig fallback if the skeleton is unavailable.
- **Full control surface** — authored icon set across both bars, swipeable bet
  carousel, ×2 gamble, quick-bet stack, turbo, autoplay with stop conditions,
  4-state buttons with hover/press glow, animated panel transitions, and a
  buy-bonus modal with per-tier affordability (`NEED <cost>` refusal states).
- **Compliance engineering** — labeled 2-decimal money everywhere, RGS-style
  bet ladder, controls locked during spins, reduced-motion mode, keyboard map,
  silent production console, responsive from desktop to 390×844 portrait.

## Developer quick start

```bash
corepack enable                                # one-time: gets the pinned pnpm
pnpm install
pnpm test                                      # builds packages + runs all suites (73 green)
pnpm sim                                       # Monte-Carlo RTP of the math core (2M spins)
pnpm preview                                   # serve both shipped game builds

pnpm --filter @artest/shining-pop dev          # PixiJS dev server :5173
pnpm --filter @artest/shining-pop-v2 sim       # Cocos RTP sim (2M spins)
```

Cocos rebuilds headlessly — no editor session needed:

```bash
CocosCreator --project games/shining-pop-v2 --build "platform=web-mobile;debug=false"
```

## Quality gates

1. **Math gate** — RTP in band; book == simulator == engine (three-way cross-check)
2. **Approval floor** — 100 frontend cases: responsive presets without scroll, silent console, replay, resume
3. **Award ceiling** — 100 visual-FX/gamification elements + WCAG 2.2 (flash, motion, contrast, keyboard)
4. **Brand gate** — shipped artifacts carry **only** ARTEST | BrainRocket branding; zero external resources

## Engineering standards

Conventional Commits enforced by commitlint + husky · shared ESLint flat config +
Prettier · strict TypeScript (`no-explicit-any`) · zero allocation in per-frame
loops · pure logic with no engine imports · data-driven view configs (designers
tune data, never component code).

---

<div align="center">

© Edgar Hovsepyan — **ARTEST | BrainRocket**. All rights reserved.

</div>
