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
repo's demo assembler / Vercel); regenerate it from Cocos Creator (**Project → Build
→ Web Mobile**) after a source change.

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

---

## Frontend & effects

Everything you see is **built from code** and layered. The look comes from four
systems working together — tween motion, custom shaders, vector VFX, and synced
audio. Designers tune it all from one data file, **`view/view-config.ts`** (timings,
scales, colors, tiers); the view code reads those numbers and never hard-codes feel.

### Motion — Cocos Tween

All movement is `cc.tween`. The reel uses a custom ease (wind-up → cruise →
committed decel) and a **candy land bounce** on stop (squash → rebound → damped
settle). Symbols, the HUD count-up, and the ceremony beats are all tween-driven.

### Shaders — custom `.effect` (CCEffect)

**13 hand-written shaders** in `assets/resources/effects/` carry the "shine",
applied as sprite materials:

- **`symbol-win`** — rim-light + a specular sweep + a body charge on a winning symbol.
- **`soft-burst`** / **`particle-glow`** — additive glow behind wins and particles.
- **`payline-glow`** / **`reel-portal`** / **`grid-merge`** — line and reel/feature transitions.
- **`buy-plasma`** / **`crystal-idle`** / **`svarka-additive`** / **`screen-post`** … — ambient + post.

### Vector VFX — `cc.Graphics`

The candy **win-lines** are drawn live: a multi-stroke neon glow with a bright
**glint that flows along the path**. The reel window's soft top/bottom **feather**
is Graphics too.

### Win presentation — the on-symbol celebration

This is the heart of the feel:

- **Lift on top, uncropped.** A winning symbol is lifted onto a top overlay
  (`winLift`) so its pop renders **above** the whole board and is **never clipped**
  by the reel masks — pinned to its exact cell, neighbours untouched.
- **Pop in place.** Each winner plays a brief anticipation dip → a back-out
  overshoot → a looping jelly bounce + a gentle in-plane tilt, with the
  `symbol-win` rim-light and an additive halo. Intensity scales per-symbol "heat"
  (the Wild is hottest). **Losing symbols dim** so the win reads cleanly.
- **Particles** (pooled): corner sparkles on _every_ winning symbol, plus ember
  bursts / star-pops / bubbles, and a coin geyser on big wins.
- **Big-win ceremony** (`CeremonyView`): a detonation flash, a pitch-climbing
  count-up tally, cinematic bloom, and a background depth "whoosh".

### Containment

Each reel is masked, and a **container mask on the reels root** clips the whole grid
to the playfield — so spinning buffer symbols and edge pops never bleed past the
frame, while the lifted winning symbols celebrate above it.

### Audio — 4-bus WebAudio mixer

Buses: **music · gameplay · sfx · win** (win is loudest so the sting cuts through).
The **spin** is a soft, looped **damping** hum (not a buzzy drone); **wins** escalate
through five candy stings; the **big win** lands a deep cushioned boom + a warm
swelling bed, with the music **ducked** so the moment is clean. Every sting fires on
the exact VFX frame. A procedural oscillator fallback keeps the game never-silent
until the sample bank decodes.

---

## Bonus transition scenes

Moving from the base game into a feature is a small **cinematic sequence**, not a
hard cut. There are two ways in — **3+ scatters** land, or the player **buys** a
bonus — and both run the same staged transition:

1. **Scatter reveal** — `presentScatterTrigger()` pulses the scatter symbols and
   pops a **"N SCATTERS — FREE SPINS!"** callout, with a bloom scaled by the count.
2. **Cinematic wipe** — `wipe('bonus' | 'fs')` sweeps a colored **core + halo**
   across the screen to mark the scene change, paired with the `grid-merge` shader
   wiping over the reels.
3. **Feature reveal** — `showFeatureUnlocked()` shows the banner (**FREE SPINS** or
   the bought mode) via `CeremonyView`, with a bloom flash and a background **depth
   push**.
4. **Atmosphere shift** — `setBonusAtmosphere(mode)` washes the whole scene in a
   **mode color that breathes** (Sticky Wilds = pink, Sticky Crowns = gold, Wild
   Reels = purple), swaps in the free-spin background, and refits the layout.
5. **Audio** — a soft squishy **gummy `transition_in` whoosh**, the `bonus_intro`
   fanfare, and the music **crossfades** from the base loop to the bonus loop.

**Inside the bonus,** each free spin runs the same reel → land → win pipeline;
**sticky** symbols lock with a pulse + a lock SFX; the running total counts up in
the HUD. On the final spin the atmosphere **fades back to idle**, a `bonus_end`
resolve plays, the music returns to the base loop, and the total win counts up.

> All of the above is **frontend only** — the bonus _outcome_ (which spins, which
> symbols stick, the payout) is decided by `logic/bonus-engine.ts` and merely
> _played back_ by the view. See [DEVELOPMENT.md](DEVELOPMENT.md) for the
> contributor's map.
