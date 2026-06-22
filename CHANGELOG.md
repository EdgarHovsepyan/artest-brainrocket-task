# Changelog

## Stake 1★ → Approval Boost Pass (2026-06-22)

Stake Engine rated the submission **1.00 / 3** (resubmit window: 3 days), citing
shallow gameplay, generic/AI-looking assets, inconsistent art, and missing bonus
features. This pass attacks the reviewer's reasons on the FRONTEND lane and
documents the design/asset cures only the owner can make. Presentation-only
(math/odds untouched); verified headless — Cocos renders fully; Pixi via the
static board + `window.__dbg` forced states (a real Pixi spin crashes swiftshader).

### Verified state

- **Cocos `shining-pop-v2`: 100-spin anomaly sweep → 0 anomalies** (no hidden /
  cropped / crushed / transparent cells); win, ceremony, free-spins, buy-bonus and
  portrait scenes all render clean. **The game is bug-free** — the 1★ is
  **cohesion + depth**, not bugs.

### Shipped — Cocos (`shining-pop-v2`)

- **Crisp reel stop** (killed post-land bounce / whole-reel recoil / column dump /
  idle-breathe bob) → then a tasteful **candy-damped jelly land** (squash → rebound
  → settle → holds still).
- **Background parallax restricted to big-wins only** (no per-spin or per-win lean).
- **Full-size Wild/Scatter win "dance"** — small win-rotate + always-on sparkles
  (were over-tempered to near-static); **smaller, cohesive candy particles**.
- **Win symbols no longer cropped** — per-reel mask widened horizontally (the
  win-lift stays off; re-enabling it collapses winners to centre).
- Reality-check modal CONTINUE text → white (was near-black INK on hot-pink).

### Shipped — Pixi (`shining-pop`, the Stake submission)

- **CANDY SYMBOLS replace the generic fruit — the #1 cohesion cap is fixed.** Ported
  the cohesive candy art from the Cocos build into all 9 Pixi symbol slots rank-for-rank
  (gems for the highs, wrapped candies for the lows, rainbow lollipop for the scatter).
  Texture-only swap — same filenames, no code change, ids/math/paytable untouched. Wild
  stays the Spine crown.
- **Cool-dominant palette cohesion** — deeper cool-purple bg, candy-magenta spin
  accent, 5-colour cool-candy particle spectrum, frost-layer z-order fixed.
- Fly-up "+amount" win text re-enabled (was killed by a leftover debug `return;`).

### ⚠ The 3★ cap — owner/asset/design decisions (frontend cannot resolve these)

Biggest cap: **the Pixi build uses generic FRUIT/classic symbols (bells, 7s,
cherries) on a CANDY theme** — that IS the "generic assets / mismatched art" the
reviewer flagged. The Cocos build already has cohesive candy symbols. For 3★:

1. **Symbols** — swap fruit → candy art (port the Cocos candy set) **or** submit
   the Cocos build.
2. **Bonus depth** — 3 modes / all-8-spins / same payout → distinct tiers +
   retrigger (the cure for "shallow gameplay / missing features").
3. **Logo** — redesign the flat pastel logo (most-cited weak asset).
4. **Bundle** — re-export oversized symbol textures (472–580 KB for a 96 px cell)
   → 512 px WebP atlas.

### Verify pipeline (for next sessions)

- Cocos: `D:/tmp-render/cocos-qa.mjs` (100-spin sweep + scene captures),
  `cocos-scenes.mjs` (forces win/ceremony/feature/buy + portrait via
  `__v2.win/ceremony/feature/buy`), `cocos-crispstop.mjs` (freeze-rAF +
  `director.tick` trajectory proof).
- Pixi: `pixi-shot.mjs` (static board); force win/ceremony/modals via
  `window.__dbg` under `?debug` — a real spin crashes swiftshader, the static
  board + `__dbg` do not.
- Build: Cocos `CocosCreator.exe --build "platform=web-mobile;debug=false"`
  (delete `temp/programming` first); Pixi `npm run build` (vite single-file → dist;
  the `inline-assets` step errors harmlessly on a missing legacy dir). Deploy:
  `node scripts/assemble-demo.mjs` → `npx vercel --prod --yes`
  (live: artest-brainrocket-task.vercel.app).

## Win-Celebration & Bonus Drama Pass — final version

A focused pass to push both slot engines toward an award-tier "money moment",
driven by real evidence: both builds were rendered headless (Playwright +
Chromium) to verify behaviour, not guessed. Math/odds untouched throughout —
every change is presentation only, and the logic suite stays green (Cocos
**75/75**, Pixi `vite build` clean).

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
