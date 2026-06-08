# Atlas sources — original sprite sheets

The raw public-asset sheets the game art is sliced from, kept in-repo so the asset
pipeline is reproducible. The `tools/slice-*.sh` scripts (ImageMagick) cut these
into transparent frames under `assets/resources/<group>/`.

## What the base game uses

| Source                          | Sliced →         | Used by the game                         |
| ------------------------------- | ---------------- | ---------------------------------------- |
| `symbols_core_premium_4x3.jpeg` | `resources/sym/` | the 10 reel symbols (ids 0–9)            |
| `atlas_A_ui_controls_5x5.jpeg`  | `resources/ui2/` | the **Spin** button (`spin_idle/active`) |

These are the only assets the base-game deliverable loads (see `SYM_RES` and the
spin frames in `assets/scripts/view/slot-view.ts`).

## Extra source sheets (not used by the base game)

`atlas_B_symbols_mega`, `atlas_C_overlays_modals`, `atlas_D_win_badges` are
additional public-asset sheets retained only as source material; the base game
(spec: "Main game only") does not consume them.
