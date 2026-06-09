# Cocos Creator — Scene & Build

How the playable scene is assembled and how to produce the web build for
**Cocos Creator 3.8.8**.

## The scene is code-driven

`assets/game.scene` contains just a Canvas with one component on it:
**`SlotController`** (the compressed script UUID is already wired into the scene).
There is **no manual node tree to build and no Inspector wiring** — at `Play`,
`SlotController.onLoad()`:

1. constructs the `SlotModel`,
2. adds a `SlotView` to a child node and calls `view.init()`, which loads the
   symbol art from `assets/resources/` and builds the whole board from code
   (background, reel frame, 5 masked reels, HUD, Spin button, win-line overlay),
3. wires the Spin button (and the Space key) to the spin flow.

So to run it: **open the project in 3.8.8 and press ▶ Play.** Click **Spin**.

The only Inspector fields are on `SlotController`: `startBalanceCents` (default 10000) and `betCents` (default 100 — the total bet across all 10 lines).

## Symbol id → resource mapping

`SlotView` loads `assets/resources/sym/<name>/spriteFrame` indexed by symbol id
(see `SYM_RES` in `assets/scripts/view/slot-view.ts`). If a frame is missing the
cell falls back to the symbol's name, so the board always reads.

| id  | resource         | id  | resource  |
| --- | ---------------- | --- | --------- |
| 0   | sym_wild         | 5   | sym_l1_a  |
| 1   | sym_h1_crown     | 6   | sym_l2_k  |
| 2   | sym_h2_heart     | 7   | sym_l3_q  |
| 3   | sym_h3_diamond   | 8   | sym_l4_j  |
| 4   | sym_h4_horseshoe | 9   | sym_l5_10 |

The Spin button uses `assets/resources/ui2/spin_idle` and `spin_active`.

## Build

**Project → Build → Web (Desktop or Mobile) → Build.** The output in
`build/web-*/` (open `index.html` served) is the deliverable.

> Never delete a `.meta` file — it breaks the resource bundle (infinite splash).
