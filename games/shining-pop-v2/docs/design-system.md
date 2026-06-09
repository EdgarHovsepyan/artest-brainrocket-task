# Design system & motion — base game

The view layer's visual identity and the motion principles actually implemented
in code. Direction: **industrial brutalism** — acid on jet black, hard edges,
snappy motion. All values live in
[`view-config.ts`](../assets/scripts/view/view-config.ts) (data-driven; designers
tune there, never the component code).

## Palette

| Token      | Value              | Use                                  |
| ---------- | ------------------ | ------------------------------------ |
| ACID       | `#EAFF00`          | reel frame, win lines, accents, Spin |
| INK        | `rgb(10,10,8)`     | reel housing fill                    |
| BG         | `rgb(7,7,9)`       | stage base                           |
| PLATE      | `rgb(18,18,14)`    | HUD panel fill                       |
| PLATE_EDGE | `rgb(60,64,40)`    | panel hairline                       |
| MUTED      | `rgb(150,150,135)` | captions                             |
| WHITE      | `#FFFFFF`          | balance value                        |

## Symbols

Wild (substitutes all) + high H1–H4 + low L1–L5 — ten ids, mapped to sprites in
[cocos-scene-guide.md](cocos-scene-guide.md). Square cells (96px), 8px gaps, a 5×3
window per the spec.

## Motion (Cocos Tween)

- **Reel spin** — one continuous trapezoidal velocity curve (`reelEase` in
  `reel-view.ts`): smooth wind-up → constant cruise → soft decel to a dead stop.
  Velocity is zero at both ends and continuous throughout, so a reel never jumps
  speed mid-spin. Reels stop **left → right** on a stagger.
- **Landing** — the impact "thunk" is a short squash-and-stretch on the settled
  symbols (not a position bounce), so the stop reads as weight without a glitch.
- **Win presentation** — winning symbols pulse (scale 1.18, ×3); winning paylines
  draw as acid polylines with a dark underlay for contrast and **cycle** one bright
  line at a time; the win amount **counts up** kinetically (duration scales with
  the log of the amount).
- **Idle** — a slow "breathing" glow behind the reels keeps the stage alive.

## Layout & responsiveness

The board is built around a logical design envelope (`layout.designWidth/Height`)
and **contain-fit** scaled to the viewport on load and on every resize, so it
never clips on any aspect ratio.
