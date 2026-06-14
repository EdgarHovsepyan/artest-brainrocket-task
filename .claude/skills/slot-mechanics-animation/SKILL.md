---
name: slot-mechanics-animation
description: >-
  Domain reference for slot-game MECHANICS and ANIMATION, grounded in the
  Shining Pop codebases (PixiJS `shining-pop`, Cocos `shining-pop-v2`, shared
  `@artest/math-core`). Use when implementing or reasoning about reels/paylines/
  ways, wilds & scatters, free spins / sticky / expanding / wild-reels, the spin
  animation curve, anticipation, reel-stop bounce, win-line reveal, symbol
  win-states, count-ups, ceremony beats, particles, RTP/volatility, or easing/
  timing for a slot. Pairs with `slot-game-polish` (the book-derived how-to);
  this one is the WHAT (mechanics taxonomy) + the HOW-IT-MOVES (animation anatomy).
---

# Slot Mechanics & Animation — Domain Reference

The vocabulary and motion anatomy of slot games, mapped to what _our_ two games
actually do. Use it to implement or extend a mechanic/animation without
reinventing the wheel — and to know which patterns we deliberately rejected.

---

## 1. Mechanics taxonomy (industry → ours)

**Grid & win evaluation**

- **Lines** — fixed paylines, left→right; pay on N-of-a-kind from reel 0. _(OURS: 5×3, 10 lines, `PAYLINES` in `game-config.ts`.)_
- **Ways** (243/1024…) — any-position adjacency; no fixed lines. _(not used)_
- **Cluster / scatter-pays** — count anywhere, no lines. _(not used)_
- **Megaways / cascading rows** — variable row heights, tumble refills. _(not used)_

**Wild family**

- **Wild** — substitutes for any pay symbol; best-of vs the line's base symbol. _(OURS: `evaluateLine` keeps max(base-run, pure-wild-run) — the classic bug, handled.)_
- **Wild Strike / multiplier wild** — N wilds boost the spin. _(OURS: `WILD_STRIKE` ×3 when ≥3 wilds — currently always ×3; `maxMultiplier` is the scaling dial.)_
- **Sticky / expanding / walking / stacked wilds** — persistence variants. _(OURS bonus: STICKY WILDS persist + bounce; WILD REELS = one full-wild reel locked for the feature.)_

**Scatter & triggers**

- **Scatter** — pays/triggers from anywhere (independent of lines).
- **Free-spins trigger** — N scatters award spins. _(OURS: 3 scatters; buy-feature shortcut too.)_

**Features**

- **Free spins** — a sub-game with its own mechanic (multipliers, sticky, retrigger). _(OURS: 3 modes — STICKY WILDS / STICKY CROWNS / WILD REELS — `bonus-engine.ts`.)_
- **Buy-feature** — pay to enter; cost anchored to RTP. _(OURS: cost = bet × multiple, sim-anchored to ~96%.)_
- **Hold & spin / respin, jackpots, gamble** — _(not used.)_

**Math vocabulary**

- **RTP** return-to-player; **hit frequency** = % of spins that win; **volatility/variance** = win-size spread; **max win** the cap. _(OURS: RTP ≈97.5%, hit ≈21.8%, observed max 756×; tune via `REEL_WEIGHTS` only — paytable is spec-fixed.)_

---

## 2. The spin animation anatomy (the reel curve)

A premium reel stop is a **physical motion arc**, not a linear scroll:

```
windup (anticipation pull-back)
  → accel (ease-in to top speed)
    → cruise (constant fast scroll + motion blur)
      → decel (ease-out toward the target)
        → overtravel (overshoot past the stop)
          → bounce/settle (elasticOut back to rest)
```

_OURS (`view-config.spin`):_ `minSpinMs` + `reelStopStaggerMs` (L→R stagger),
`accelFraction`/`decelFraction` (trapezoid), `windupMs`/`windupAmpFrac`,
`bounce{overtravelFrac, bounceMs, easing:'elasticOut', elasticity}`. Cocos
reel motion: `reel-view.spinTo()`. Pixi: per-reel `vel`/`offset` + `settleCurve`.

**Stagger** — reels stop left→right so the eye tracks the build. **Motion blur**
— eases in only at speed, out before landing (Pixi: velocity-damped `BlurFilter`;
Cocos `blur` was disabled — vertical stretch read as "arrows"). **Reel-stop
weight** _(open)_ — a 60ms bottom-anchored squash as each symbol lands gives it
mass.

**Anticipation drag** — when a trigger is brewing (≥2 early scatters/wilds on
reels 0–2), the _late_ reels slow an extra `extraSeconds` + a rising audio whine.
This is the single biggest tension lever. _(OURS: `anticipation.extraSeconds`,
`minEarlyWilds`/`minEarlyScatters`.)_ **Rule: only on GENUINE near-states — never
fake it.**

---

## 3. Win presentation pipeline (order of operations)

1. **Reels land** → evaluate (pure core) → `winCells` / `lineWins`.
2. **Win-focus** — winners pop + stay bright; losers **dim** (Pixi 0.26 eased-in ~160ms; Cocos `loserDimOpacity` via eased `setDimmed`). Guides the eye.
3. **Symbol win-state** (the "won" look), layered:
   - **Attack pop** — outBack overshoot to a hold scale (bigger for tier/premium). _(Pixi `hold`; Cocos `symbolPulseScale`.)_
   - **Jelly wobble** — continuous squash-and-stretch (the candy "yummy" loop). _(Cocos `winBounceLoop.jelly`.)_
   - **Glow / bloom** — soft additive light behind the symbol (no banded circles). _(Cocos `soft-burst.effect` + `burst`; Pixi `winBloomFilter` + per-cell halo.)_
   - **Rim + specular sweep** — shape-accurate edge light + a diagonal glint rake. _(Cocos `symbol-win.effect` / `symbolFx`; Pixi sheen dash.)_
   - **Embers / sparkle** — warm motes rising off winning cells (pooled). _(Cocos `fireEmbers`; pool-capped — raise `poolCap` before counts.)_
4. **Win line** — colored polyline / energy ribbon; multi-line wins **cycle one at a time** then a merged finale (readability). _(Pixi `LINE_COLORS` cycling; Cocos `win-beam.effect` + per-line core colour.)_
5. **Count-up** — the HUD/ceremony number rolls (easeOutExpo / quartOut), with a heartbeat pop on each 10ⁿ and a per-pip tick. **Must be a scheduled frame-stepper in Cocos 3.8.8** (`tween({v:0})` never ticks).
6. **Ceremony** (big wins) — the 4-beat story: **hush → detonation (flash+shock) → climax (count) → savour**. _(Cocos `ceremony.beats` data timeline.)_

---

## 4. Easing & timing cheat-sheet (slots)

| Moment             | Easing                                   | Typical ms                      |
| ------------------ | ---------------------------------------- | ------------------------------- |
| Spin accel         | ease-in (quad/cubic)                     | 100–150 windup                  |
| Reel decel         | ease-out                                 | —                               |
| Reel settle/bounce | **elasticOut** (low elasticity)          | 200–300                         |
| Symbol land squash | quadOut → backOut                        | 60–130                          |
| Win attack pop     | **backOut** (overshoot)                  | 380–540                         |
| Win-focus dim-in   | quadOut (never linear)                   | 150–180                         |
| Count-up           | **easeOutExpo / quartOut**               | 600 + log10(win)·350, cap ~3000 |
| Detonation flash   | quadOut in (≈50ms) → quadIn out (≈340ms) | —                               |
| Modal open / close | backOut / quadIn                         | 200 / 120                       |
| Press squash       | → 0.94 → elasticOut release              | ~60 + 420                       |

**Universal rule (Swink):** enter ease-**out**, exit ease-**in**, _never linear_.
Every control acks visually < 100ms.

---

## 5. Particle systems (how ours work)

- **Object pool** — pre-built shard nodes, borrow/return, never `new` in the hot path; `get()` returns null at `poolCap` (drop, don't grow). **Raise `poolCap` BEFORE raising counts** or extra spawns are silently dropped.
- **Physics integrator** (Cocos `particle-layer.ts`) — real velocity + gravity + drag + twinkle per particle (embers rise & decelerate; coins are ballistic: rise→apex→fall→spin).
- **Additive blend, no banded circles** — stacked-alpha diamonds / shader falloff instead of concentric `circle()` rings (which band).
- **Always GPU-/reduced-motion-gated.**

---

## 6. Anti-patterns we rejected (don't reintroduce)

- **Banded Graphics circles** for glow → use additive shader falloff or stacked-alpha diamonds.
- **Vertical-stretch motion blur / portal bands** on reels → read as "arrows". (Cocos `blur`/`portal` gated off.)
- **Drawn magenta payline geometry** → users called it "magenta geometry"; the win now reads from symbol glow + embers + shader beams.
- **Solid black full-screen dim** on big wins → blacks out the game; use a **radial vignette** (clear centre).
- **Printing "SCATTER" baked on the symbol art** → reads cheap; use a clean face + a separate animated trigger ribbon.
- **`tween({v:0})`** plain-object count-ups in Cocos 3.8.8 → never tick; use `schedule()`.

---

## 7. Where to implement (file map)

- **Mechanics/math:** `@artest/math-core`, `assets/scripts/logic/{spin-engine,bonus-engine,game-config}.ts` (Cocos), Pixi inline.
- **Animation knobs:** `view-config.ts` (Cocos) — `spin`, `win`, `ceremony`, `particles`, `anticipation`. Pixi: inline in `shining-pop.game.js` (grep the region).
- **Reel motion:** Cocos `reel-view.ts` / `symbol-view.ts`; Pixi `renderReels` + `settleCurve`.
- **Ceremony:** Cocos `ceremony-view.ts`; Pixi `winFx`/`celebrate`.
- **Guardrails:** `tests/{view-config,architecture,design-tokens,feature}.test.ts`.

> Companion: `slot-game-polish` (the book-derived method + 100 approvals).
> Method stays the same: map → Pixi-verify → Cocos-port → guard test → commit.
