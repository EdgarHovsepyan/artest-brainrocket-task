# Changelog

## Win-Celebration & Bonus Drama Pass — final version

A focused pass to push both slot engines toward an award-tier "money moment",
driven by real evidence: both builds were rendered headless (Playwright +
Chromium) to verify behaviour, not guessed. Math/odds untouched throughout —
every change is presentation only, and the logic suite stays green (Cocos
**46/46**, Pixi `vite build` clean).

### Fixed

- **Buy-Feature affordability (`shining-pop-v2`)** — the demo started at $100,
  but STICKY WILDS costs 110.68× the bet ($110.68 at $1), so the flagship bonus
  was **unbuyable from the first interaction** — the root of the "only one bonus
  works" report. Demo balance raised to **$1,000** (also restoring parity with
  the Pixi build). Play-money only; odds live in `@artest/math-core`. Guarded by
  a regression test so it can never silently re-lock.

### Added — Cocos (`shining-pop-v2`)

- **Cinematic big-win detonation** — a fullscreen, tier-scaled flash ("BANG")
  that now fires on **every** tier including the Spine-banner path (which
  previously had no flash/shock and read flat), plus an amplified light-bloom
  shockwave.
- **True ballistic coin geyser** — coins rise to an apex, then fall past the
  board while tumbling on their own spin, fading near the end — a torrent, not a
  puff.
- **Distinct identity per bonus mechanic** — GOLD crown-world / pink wilds-world
  / violet reels-world, each with its own lock "feel" (tight authoritative snap
  vs. energetic pop vs. big column surge), so the three features never read as
  one.
- **Per-line win-line colour identity**, denser fire embers, deeper win-focus
  dim, a hotter EPIC crown, config-driven beam intensity/flow, and a longer
  "held-breath" hush before the detonation.

### Added — Pixi (`shining-pop`)

- **Dramatic winning-symbol focus** (verified on a live win): winners pop
  brighter while the rest of the board dims back, so a win actually _reads_.
- Bolder hero-number elastic landing and win-moment juice.

### Engine best practices (already in place, hardened this pass)

Additive shader VFX (no banded circles) · frame-stepped count-ups (not
`tween({v:0})`, a 3.8.8 web-runtime gotcha) · live-captured shake rest transform
· one phase-locked `u_time` material stepper · pooled particles + physics
integrator · Spine hero + procedural fallback · reduced-motion fallback on every
VFX · interruptible (tap-to-skip) ceremonies · `view-config` knobs over magic
numbers.

### Note

The Cocos `build/web-mobile` review build must be regenerated in Cocos Creator
to reflect these source changes — the editor owns asset compilation, so source
edits are invisible in the playable build until rebuilt. The Pixi `dist` is
committed in sync.
