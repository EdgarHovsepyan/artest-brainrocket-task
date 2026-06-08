# `/public/spine/` — Master Skeleton drop-zone

This folder is **empty on purpose**. The Spine runtime controller (`src/spine/SymbolRig.ts` +
`SymbolRigPool.ts`) is implemented and compiles against the installed runtime
(`@esotericsoftware/spine-pixi-v8` 4.3.5), but **nothing animates until a real rig is dropped
here.** A rig is *art* — it can only be exported from the Spine editor, not generated in code.

## What to drop in (3 files)

| File | What it is | Notes |
|---|---|---|
| `master.skel` | Binary skeleton export | `.json` also works — update `skeletonSrc` in `DEFAULT_MASTER_CONFIG` if so |
| `master.atlas` | Atlas descriptor (text) | The page line inside MUST read `master.png` (see alias rule below) |
| `master.png` | Packed atlas page(s) | Export **premultiplied alpha** + **mipmaps** (`--genmipmap`) for crisp retina symbols |

Served at `/spine/master.*` (Vite serves `/public` at the web root). These are the URLs the
pool's `DEFAULT_MASTER_CONFIG` already points at — drop the files and `pool.load()` resolves.

## The Master Skeleton contract (what the controller expects)

`SymbolRig` drives **one** skeleton that contains **every** symbol as a **skin**, plus a tiny,
fixed set of animations. Author it this way so a single shared `SkeletonData` powers all 15 reel
cells (load once, instance many):

### Skins — one per symbol (names are the `symbol` arg)
`crown`, `diamond`, `wild`, `seven`, `bell`, `cherry`, … — one skin per reel symbol. The skin
name is exactly the string passed to `pool.acquire({ symbol })` / `rig.setSymbol(name)`.

### Animations (track contract — do not exceed track 2 without a comment)
| Track | Animation | Loop | Purpose |
|---|---|---|---|
| 0 | `idle` | ✓ | Living idle (breath / shimmer). Always present. |
| 1 | `dump` | ✗ | Land-on-reel settle (the drop "thunk"). Auto-returns to `idle`. |
| 1 | `win` | ✗ | Win celebration (additive burst, pop). Auto-returns to `idle`. |
| 2 | *(reserved)* | — | Additive overlays (glow/pulse) the `.skel` may fire internally. |

The controller crossfades via `defaultMix` (0.12 s) and guards track 1 with
`setEmptyAnimation` so `win`/`dump` never collide.

### User events (frame-exact audio / camera hooks) — author on the dope sheet
Keyframe Spine **user events** on `win`/`dump` so audio rides the exact animation playhead
(no scheduling drift). The controller forwards each event to `onEvent(name, payload)`:

| Event name | Fire on | Payload used | Wire to |
|---|---|---|---|
| `sfx_burst` | symbol burst frame | `stringValue` = sfx id, `floatValue` = gain | `Sound.play(id, gain)` |
| `impact` | heavy hit frame | `intValue` = shake strength | camera shake |
| *(any)* | anything | `int/float/stringValue`, `time` | your call |

Event names are free-form — these are just the conventions the blueprint's usage example wires.

## The page-alias rule (Stake console-silence)

Stake **auto-rejects on any console warning**. The pool pre-registers the atlas page with an
alias that must match the page filename written **inside** `master.atlas` (default `master.png`),
which prevents the `Texture from 'undefined' did not finish loading` warning. If your atlas
names its page something else, update `pages[].alias` in `DEFAULT_MASTER_CONFIG`
(`src/spine/SymbolRigPool.ts`) to match — alias and the `.atlas` page line must be identical.

## Wiring it up (the day the rig lands)

```ts
import { SymbolRigPool } from '@/spine';        // or relative: ../spine

const pool = new SymbolRigPool();               // defaults → /spine/master.*
await pool.load();                              // registers + loads ONCE

// one rig per reel cell (5×3 = 15), sharing SkeletonData:
const rig = pool.acquire({
  symbol: 'crown',
  onEvent: (name, p) => {
    if (name === 'sfx_burst') Sound.play(p.stringValue, p.floatValue); // frame-exact
    if (name === 'impact')    Camera.shake(p.intValue);
  },
});
reelCellContainer.addChild(rig.view);
rig.view.position.set(cx, cy);                  // parent origin == visual centre (auto-centred)

rig.setSymbol('wild');                          // instant skin swap, re-centres
rig.play('dump');                               // landing settle → auto-returns to idle
rig.play('win');                                // celebration → auto-returns to idle

// teardown:
pool.release(rig);                              // per cell
await pool.unload();                            // once, when the whole feature unmounts
```

## Size budget (Stake mobile)

Total Spine bundle (skeleton + atlas page) should stay **≤ ~2 MB** so the single-file build
stays comfortably under the mobile budget. Prefer one ~2048² page over several pages; trim
unused skins.

> Spec & rationale: `docs/blueprints/10_SHINING_POP_SPINE_SYMBOL_BLUEPRINT.md`
> Controller: `src/spine/SymbolRig.ts` · Pool/loader: `src/spine/SymbolRigPool.ts`
