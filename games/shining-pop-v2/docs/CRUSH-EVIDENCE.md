# Wild "crushing positions" in the win celebration — findings

**Status: code + git-history diagnosis, NOT an observed live repro.**
No device, viewport, gesture-cadence, or frame-capture evidence was provided for
this report. Everything below is derived from the source and the commit history.
On current `main` this is already fixed (see _Current state_), so it should not
reproduce there — "does not reproduce" means _fixed_, not _never happened_.

Anything labelled **inferred** is a hypothesis from the code, not captured data.

---

## What was reported

A vague natural-language report: on a Wild win, during the win celebration,
symbol **positions look "crushed" / moved** — a symbol appears to slide down and
leave an empty cell.

## Provenance (the real evidence is in git, not in any screenshot I hold)

- **`876bd40`** — _"win symbols pop in place, not lifted out of the mask"_. Its
  commit message (author: Edgar) is the primary description of the bug:

  > the win-lift reparented each winning symbol to an overlay above the reel
  > mask (for an "uncropped" look). a tall symbol (the wild gingerbread) at the
  > bottom row then hung BELOW the reel frame into the betting bar and read as
  > "moved down + empty slot" (the famous bug in the screenshot).

  That screenshot is referenced but is **not in my possession** — I never
  received it.

- **`b9aebe8`** — _"uncrop win symbols"_ re-enabled `liftWinSymbols`, which
  reintroduced the overflow the lift causes.
- **`1eb7b3f`** — _"contain wild win VFX inside the board (halo mask-escape)"_ —
  the fix currently on `main` (see below).

## Mechanism (root cause)

- On a win, `SymbolView.playWin` → `liftForWin` **reparents** each winning
  symbol out of its per-column reel `Mask` onto the `winLift` overlay so the
  win-pop + halo are not clipped ("uncrop").
- `FULL_SIZE_IDS = { WILD(0), SCATTER(8) }` are drawn at ~full cell size
  (`symbolFill` 0.94, `artBaseScale` 1). Once such a symbol is **lifted (now
  unmasked) and scaled up by the win-pop/bounce**, its art + halo extend past
  the board frame.
- For a full-size symbol on the **bottom row**, that overflow falls **below the
  reel frame into the betting bar**, reading as "the Wild moved down" while its
  masked cell looks empty.

## Why a rest-seat-restoration probe shows 0 drift (likely the wrong failure mode)

A harness that watches announce/deck/board **tenants returning to their rest
seats** after the ceremony will (correctly) report **0 drift** — the symbols
_do_ restore; `clear()` reparents them home. The reported artifact is a
**transient visual overflow that occurs _while a symbol is lifted and popping_**,
before `clear()` runs. A restoration-diff probe cannot see it.

**To actually detect it:** during the win-pop / `winBounceLoop` beat (not at
settle), sample each **lifted** node's **world-space AABB** against the board
frame rect, specifically for a **full-size symbol on the bottom row**, and flag
when the AABB crosses the frame's bottom edge.

## Inferred repro conditions (inferred — NOT observed)

- Form factor: **portrait / mobile**, where the betting bar sits directly under
  the board.
- Outcome: a win whose line includes a **Wild (or Scatter) on the bottom row**.
- Timing: during the **win-pop + bounce** beat, not settle.
- Symptom: the symbol art + halo extend past the reel frame's bottom edge into
  the betting bar; the source cell reads as empty because the node was
  reparented out of the masked strip.
- Viewport size / exact device / frame captures: **unknown, not provided.**

## Current state (fixed on `main`)

`1eb7b3f` contains the lifted symbol inside the board:

- a **mask on the `winLift` overlay** clips the lifted symbol/halo at the board
  edge (keeps the uncrop benefit, kills the spill),
- the halo is tightened (`1.75` → `1.35`),
- `liftForWin` positions the cell relative to the (board-centred) overlay.

An earlier independent fix on branch
`claude/game-win-celebration-crush-bug-9ghy5i` gated the lift off for full-size
symbols; it was **superseded by `1eb7b3f`** and dropped during merge to avoid a
redundant, competing fix.

## What's still missing to call this "evidence"

The original screenshot, the device/OS, the viewport dimensions, and a frame
capture of the offending beat. Until those exist, treat the above as a
well-supported **hypothesis with a documented mechanism**, not a captured repro.
