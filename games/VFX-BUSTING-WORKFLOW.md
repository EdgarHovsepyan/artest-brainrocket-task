# VFX Busting Workflow — Cocos `shining-pop-v2`, front-end only

> **Goal:** push the Cocos board toward a _cinematic, rich, elegant, top-level_
> feel **and** hold a real frame budget on weak devices. Front-end only —
> visuals, effects, animations, motion, timing. The pure odds core
> (`@artest/math-core`) is never touched here.
>
> **North star (from `slot-game-polish`):** every spin alive · every win earned ·
> big wins tell a story · _and the frame never drops while it does._

This is the repeatable loop ("busting") for raising the Cocos front-end. It names
the 5 local skills to lean on, the order to apply them, and the guardrails that
keep a change shippable.

---

## Top 5 skills (and what each one buys you for the front-end)

Ranked for this front-end visuals/effects/animations goal:

1. **`slot-game-polish`** — _the method + the 100 approvals._ The primary driver:
   pick a goal → matching book section → 3–5 numbered approvals → verify → port →
   guard test → commit. Owns the verified Playwright harness, engine facts, and
   the gotchas (Cocos build is stale until an editor rebuild — the #1 feedback gap).
2. **`slot-mechanics-animation`** — _the HOW-IT-MOVES._ The animation anatomy:
   spin curve, reel-stop bounce, anticipation, win-line reveal, **symbol
   win-states**, count-ups, ceremony beats, particle choreography, easing/timing.
   This is where the per-symbol drama and the win cinematography come from.
3. **`slot-audio-sound`** — _the same-frame transient._ Sylvester #16: every flash
   needs an audio transient on the **exact VFX frame**. A visual without its sting
   reads as cheap; AV-sync is what makes a detonation _land_.
4. **`slot-release-qa`** — _verify the built thing + the budget._ The Playwright
   capture/visual-regression harness, the asset budget, the device/orientation
   matrix, and the **frame-time / perf** discipline that the VfxGovernor closes.
5. **`slot-compliance-rgs`** — _the honest, reduced-motion guardrail._ Every VFX
   declares a calm reduced-motion fallback; celebrate only honest wins (LDW-safe).
   This keeps the spectacle legal and humane — a non-negotiable on every VFX PR.

---

## The busting loop (one wave = one slice)

```
1. PICK      a single front-end goal (e.g. "win symbol reads as the hero").
2. MAP       grep/read the exact region first — never edit blind.
             (Pixi is one ~12.6k-line file; Cocos = ~15 view files + 11 shaders.)
3. APPROVALS choose 3–5 numbered approvals from slot-game-polish §4.
4. VERIFY    Pixi: see→fix→screenshot (Vite build + Playwright, the unlock).
             Cocos: NOT headlessly rebuildable — port the proven Pixi recipe and
             SAY it needs an editor rebuild to see (the #1 gotcha).
5. DATA      change knobs in view-config.ts (feel), not engine code.
6. PERF      run every new spawn count through the VfxGovernor (see below).
7. AUDIO     give every new flash a same-frame transient (slot-audio-sound).
8. CALM      add the reduced-motion fallback in the SAME change (compliance).
9. GUARD     add/extend a test (logic / layering / feel-contract / token-drift /
             perf). `npm test` must stay green.
10. SHIP     small conventional commit (lowercase subject), pushed.
```

---

## The performance spine: `VfxGovernor` (closes approval #42)

The richest celebration is worthless at 22fps, and a featherweight one wastes a
capable GPU. `assets/scripts/view/perf.ts` is the pure, cc-free decision core
that resolves this — and it is unit-tested in plain Node (`tests/perf.test.ts`),
because the part worth proving is the control law, not the particle plumbing.

- **Sampled** once per frame in `ParticleLayer.update(dt)` — the honest tick that
  runs whether or not physics shards are live.
- **Yields** a single `scale` in `[minScale, 1]` from a frame-time EMA:
  - smooth frames (≤ `upShiftMs`) → `scale = 1` → **full cinematic density**;
  - sustained load (≥ `downShiftMs`) → `scale → minScale` → **lean, locked budget**;
  - linear in between; **shed fast** under load, **recover slowly** (no pumping).
- **Applied** through `gov.count(base, floor)` on every spawn path — `burst`,
  `fireEmbers` (ignite ring + per-cell), `coinGeyser`, `sparkCascade`. The `floor`
  guarantees a signature beat (the ignite ring) never vanishes to zero.
- **Tuned by data** in `view-config.ts → vfx.quality` (no engine edit to retune).

**Rule for every new VFX:** if it spawns N of anything per frame or per win, route
N through `gov.count(...)`. That is how "more powerful visuals" and "fix the
performance issues" stop being a trade-off and become the same dial.

---

## Front-end slices worth busting next (Cocos, in priority order)

Each is one wave; each lands a guard test; each needs an editor rebuild to see.

- **Win-symbol hero read** (`slot-mechanics-animation`): per-symbol heat profiles
  drive pulse/tilt/jelly so the winning symbols dominate the loser-dim board.
- **Ceremony cinematography** (`slot-game-polish` §II): the hush→detonation→
  climax→savour beat-timeline is already data (`ceremony.beats`); tune the
  decompression beat so a big win doesn't yank back to base.
- **Same-frame audio transients** (`slot-audio-sound`): a low-end thump under
  every detonation flash; pitch-climb on the count-up tally.
- **Frame-time dev HUD** (approval #41): surface `gov.emaFps` + `gov.scale` behind
  a debug key so the governor is observable while tuning.
- **Reduced-motion sweep** (`slot-compliance-rgs`): confirm every beam/ember/coin
  path has a calm fallback in the same PR.

---

## Guardrails (keep these green — `npm test`)

`games/shining-pop-v2/tests/`:

- `architecture.test.ts` — pure core imports no `cc`; deps flow one-way.
- `view-config.test.ts` — feel contract (tiers escalate, ranges valid, beats well-formed).
- `design-tokens.test.ts` — palette + tiers locked to `games/design-tokens.json`.
- `feature.test.ts` — bonuses affordable, WILD STRIKE, math parity.
- **`perf.test.ts`** — VfxGovernor control law (holds smooth, sheds under load,
  honours the floor, recovers gently, survives a stall, config is well-formed).

---

_Companion docs: `slot-game-polish/SKILL.md` (method + 100 approvals) ·
`BOOK-PLAYBOOK.md` · `ARCHITECTURE-STRATEGY.md` · `ROADMAP-LEGENDARY.md` ·
`PARITY-MATRIX.md` · `CHANGELOG.md`._
