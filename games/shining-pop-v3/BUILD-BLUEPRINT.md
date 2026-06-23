Engine facts confirmed (verified against the live v2 source): `SCATTER = 8`, `WILD = 0`, paytable rankings, `BONUS_MODES` (all three `spins: 8`, costs are **bet-multipliers** 33.64/96.99/110.68), `BET_LEVELS_CENTS = [100,200,300,500,700,1000]`, `FREE_SPINS_AWARD = {3:3,4:6,5:10}` (scatter path only), `SCATTER_FS_MODE = 'wilds'`, `WILD_STRIKE`, `SCATTER_PAY`, and the v2 package uuid `456ab05f-2da4-42e1-84b4-57aa7e7182b1` (which v3 must regenerate). `assemble-demo.mjs` hardcodes only two slugs in the GAMES array at lines 27-28. Tier classification is currently **view-side** (`resolveBigWinTier` in `view-config.ts` + an inline `mult >= 50 ? …` in the controller + a `winCents/9` `tierBet`); `classifyWinTier` exists in math-core but is **unused** by v2's ceremony/audio path. I have everything needed.

---

# SHINING POP V3 — MASTER BUILD BLUEPRINT
### `games/shining-pop-v3` · Cocos Creator 3.8.8 · "Sugar Rush" visual rebuild · single source of truth
Authority order on any conflict: **CLAUDE_CODE_BUILD_PROMPT > design README > … and the ENGINE (`@artest/math-core` / `logic/game-config.ts`) wins on every NUMBER.**

---

## 1 · Executive summary

**Strategy: fork, re-theme by data first, rebuild only what Sugar Rush demands.**

1. **Fork v2 as a sibling workspace package** (`games/shining-pop-v3`, not a nested copy). v2 is architecturally clean: a code-built scene (one `SlotController` composition root, no prefabs), a self-contained runtime spin engine in `assets/scripts/logic/`, and a data-driven view seam (`palette.ts` + `view-config.ts` + `fonts.ts`).
2. **Re-theme via config first** (cheapest, highest leverage): swap `palette.ts` → Sugar Rush tokens, retune `view-config.ts` timings/tiers, drop new fonts into `fonts.ts`. This moves ~40% of the look for ~5% of the effort.
3. **Rebuild only the procedural chrome that bypasses the seam**: hundreds of inline `new Color(r,g,b)` / local `C{}` literals in `slot-view.ts`, both betting bars, `ceremony-view.ts`, `symbol-view.ts`. Preserve every **public method signature and event name** so the controller keeps working.
4. **Keep the engine untouched.** The 13 `.effect` shaders, the audio mixer, `reel-view.ts`, `particle-pool.ts`, and the entire `logic/` math layer port verbatim. Only **art assets** (symbol PNGs, win-tier art, Spine skeletons) and **palettes** change.

**THE ONE RULE — math decides, view renders.**
The view layer NEVER computes a payout, a weight, an RTP, or a *bet level* from the visuals. It renders the cents/grid/tier the model hands it. Every "×N", balance, win amount, bet, bonus cost, wild-strike multiplier, scatter pay, and free-spin count on screen is the value the engine supplied. The art→symbol binding is by **numeric id (0=Wild … 8=Scatter … 9=lowest)**, never by filename or display name. To change the visual symbol hierarchy you **remap ART, never the paytable.**

**Honest caveat about win-tier classification (the one place v2 already bends THE ONE RULE):** v2 decides which *celebration band* (BIG/MEGA/SUPER/EPIC) to play in the VIEW — `resolveBigWinTier(multiple)` in `view-config.ts:536`, an inline `mult >= 50 ? 5 …` in `slot-controller.ts:553` for the audio sting, and a client-side `tierBet = round(winCents/9)` in `slot-controller.ts:666`. The math-core `classifyWinTier` exists but is **unused** by this path. This is acceptable because a tier band is a **presentation mapping over the model's win-multiple** (the multiple itself comes from the engine), NOT a payout. v3 **owns this reality**: the tier band lives in `resolveBigWinTier` as a render mapping; we do NOT pretend `classifyWinTier` drives it (see §3 and Part 10). The only number that must be exact is the count-up final value (= `winCents` from the model).

---

## 2 · Conflict resolution table

| # | Topic | README / Art-Direction says | BUILD PROMPT / ENGINE says | **RESOLUTION** | Reason |
|---|---|---|---|---|---|
| C1 | **Win presentation** | symbol-view does scale `spWin 0.7s` pulse (1→1.09); AD "jelly-wobble + 3-D card-turn" | **STATIC cyan ring + glow, NO scale-pulse** | **Static cyan ring + alpha-clipped glow only.** Disable `spWin` scale-pulse and the jelly loop in `symbol-view.playWin`; keep `0 0 0 2px #fff, 0 0 20px rgba(127,231,255,.9)` ring + `soft-burst.effect` halo. | Build prompt wins. Cyan reserved for win/scatter signalling (AD §2.1). |
| C2 | **Menu contents** | (v2 menu may include history rows) | **NO 'Game History' row.** Rows = Sound FX, Music, Game Rules, Paytable, Settings | **Menu = 5 rows, no Game History.** | Build prompt wins. |
| C3 | **Settings location** | gear icon present in mobile top-right + menu | **Settings lives ONLY in the menu** (Settings row → panel). No duplicate gear. | **Single entry: Menu → Settings.** Mobile gear is repurposed to open the **menu**, not a second settings surface (verify the current handler first — see P1-3 / Part 7). | Build prompt wins (de-dupe). |
| C4 | **Quick-bet presets** | component card "0.10 → 250.00 · 14 steps"; another draft "0.50 → 250.00 · 9 presets" | engine `BET_LEVELS_CENTS=[100,200,300,500,700,1000]` → BET shows **1.00 / 2.00 / 3.00 / 5.00 / 7.00 / 10.00** (six levels) | **Quick-bet panel = the SIX engine levels (1.00, 2.00, 3.00, 5.00, 7.00, 10.00).** The "0.50…250.00 / 14-step / 9-preset" copy is **fiction** and is deleted everywhere. The quick-bet panel **is** the engine ladder — it is index-bound, not display-only. | **Engine wins outright.** `slot-controller.ts:122` feeds `BET_LEVELS_CENTS` into `configureQuickBetPanel`; `bet:set(idx)` indexes that array (`controller:240`). Extra presets emit out-of-range indices that `?? minBet()` silently snap to 1.00, and 250.00 is unreachable (`snapBet(25000)=1000`). A wider ladder is a **math change** to `bet-levels.ts` + re-cert, not a view preset. |
| C5 | **Autoplay placement** | autoplay as a separate violet gem | **autoplay grouped WITH the bet controls** | **Autoplay control lives in the bet-control cluster** of both bars. It must NOT also be drawn as a separate violet gem. | Build prompt wins. |
| C6 | **Settings panel fields** | not fully enumerated | **Settings = Sound vol, Music vol, Quick Spin, Reduce Motion, Battery Saver, Language** | **Build the Settings panel with exactly those 6 controls.** | Build prompt wins. |
| C7 | **Spin button color** | AD Direction-C drew a **cyan** spin button | Final + native palette = **PINK `#ff007f`** | **Pink spin button.** Cyan stays win/scatter only. | Final + native palette (build-side) wins. |
| C8 | **Layout topology** | AD mock used absolute-positioned HUD (can overlap) | Final = **3-band flex column, no overlap** | **Non-overlapping flex column** (top / reels / hud). | Final wins; matches v2's code-built layout. |
| C9 | **Symbol display names** | candy names (CANDY CANE, GUMMY BEARS…) | engine ids: 0=Wild,1=H1(CROWN/sticky),…,8=Scatter,9=lowest; `SYMBOL_NAMES` are gem placeholders (and mislabel id 8 as `'Scat'`) | **Bind art to numeric id + paytable rank; display labels are candy.** id 8 = SCATTER (`sym_l4_j.png`), id 0 = WILD, id 1 = sticky-crowns symbol. **Candy display strings must be relabeled in `info-content.ts` too** (the paytable panel reads `paytableRows()`), not only in `symbol-view`/`SYM_RES`. | Engine wins on ids; README wins on labels. |
| C10 | **Symbol→pay tier order** | README "CANDY CANE HIGH ×50/500/1000" maps to a specific PNG | engine PAYTABLE: id1=1000@5, id2=750, **id3=id4=500 (tie)**, id5=250, **id6=id7=id8=150 (three-way tie)**, id9=100 | **Use the engine ranking; remap ART so the prettiest/highest-read candy sits on id 1, lowest on id 9.** Where pays tie (id3/id4; id6/id7/id8) any visual ordering is **arbitrary and must not imply a pay difference.** Flag every README-PNG claim against engine id (see §4). | Math wins; art is reorderable. |
| C11 | **Buy-bonus tiers** | AD bible: LITE/CLASSIC/SUPER (100/250/500, ×2/×3/×5) | engine `BONUS_MODES`: reels ×33.64, crowns ×96.99, wilds ×110.68 (**multipliers of total bet in cents**); **all three = 8 spins** | **Engine `BONUS_MODES` win** (WILD REELS / STICKY CROWNS / STICKY WILDS at those bet-multipliers, **8 spins each**). AD's LITE/CLASSIC/SUPER is a discarded earlier draft. | Engine wins on cost/mechanic; matches the Production-System + Final screens. |
| C12 | **Free-spins award** | copy "3/6/10" | `FREE_SPINS_AWARD={3:3,4:6,5:10}` is the **scatter-trigger** path ONLY; **bought** bonus is always **8 spins** | **Two distinct FS sources:** (a) scatter-triggered → 3/6/10 spins, mode always `'wilds'`; (b) bought → **8 spins**, mode = the purchased mode. Each counter reads its own model outcome, never a constant. | Engine authoritative; the two paths must not be conflated. |
| C13 | **Win-ceremony skip** | no explicit "tap to skip" in Production doc | AD: EPIC "6s+, skippable on tap" | **All ceremony tiers skippable on tap** (outside-tap/tap dismisses; keep count-up final value). | AD + general modal rule. |
| C14 | **Dim losers** | Final static cells NOT dimmed; AD dim to ~55% | — | **Dim non-winners to ~55% during a win** (keep AD intent; v2 `setDimmed` already does it). | AD binding intent; build prompt doesn't override. |
| C15 | **Base-game features** | README mentions "WILD STRIKE base feature" | engine emits `SpinOutcome.wildStrike` (`WILD_STRIKE {minWilds:3,maxMultiplier:3}`) + `SpinOutcome.scatterCents` (`SCATTER_PAY {3:1.5,4:6,5:30}`, paid on count) | **Render the WILD STRIKE multiplier and the SCATTER pay** — both are real engine outputs, not flavor. Wild-strike multiplier surfaces in win presentation (Part 6) + HUD (Part 7); scatter pays on **count**, never as a line win. | Engine behavior is real; the view must show it or it's lost. |

---

## 3 · Token system — `assets/scripts/view/theme.ts` (drop-in)

v3 introduces **one** token file `theme.ts` that **replaces `palette.ts`** as the single source of color/type truth, and feeds `view-config.ts`. Refactor target: every inline `new Color(r,g,b)` / local `C{}` in `slot-view.ts`/bars/`ceremony-view.ts`/`symbol-view.ts` must read from `THEME` (this is the prep step that makes the re-skin a token swap).

```ts
// assets/scripts/view/theme.ts  — Sugar Rush, single source of color/type truth.
import { Color } from 'cc';
const C = (hex: string, a = 255) => { const c = new Color(); Color.fromHEX(c, hex); c.a = a; return c; };

export const THEME = {
  // ── BRAND PINK SPINE (9-step) ──
  pink: {
    p50:  C('#ffe6f4'), p100: C('#ffd9ec'), p200: C('#ff8ab8'), p300: C('#ff5ab0'),
    p400: C('#ff2f93'), p500: C('#ff007f'),  /* PRIMARY */        p600: C('#d6006e'),
    p700: C('#b8005e'), p900: C('#6a0540'),
  },
  // ── ACCENTS — SIGNAL ONLY, never decoration ──
  accent: {
    fuchsia: C('#ff2ad0'),  // mega/hot tier, top-volatility
    violet:  C('#9a3bd6'),  // autoplay control (drawn INSIDE the bet cluster, never a standalone gem — C5)
    cyan:    C('#7fe7ff'),  // SCATTER + free-spins signalling ONLY
    mint:    C('#52d189'),  // WIN signalling + free-spins multiplier rail ONLY
    gold:    C('#e9b84e'),  // high-symbol frames / premium chrome only
    caramel: C('#ff9a3c'),  // turbo
  },
  // ── NEUTRALS (Midnight Plum) ──
  neutral: {
    bg900: C('#08050e'), bg800: C('#0a0610'), panel: C('#160c22'), panel2: C('#21102f'),
    panelAlt: C('#0f0818'), pageBody: C('#07040c'),
    text: C('#fff4fb'), textMute: C('#a99bbc'), textDim: C('#cdbede'), textSub: C('#9a8cae'),
  },
  // ── SPACING (4px base) ──
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 },
  // ── RADIUS ──
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  // ── ELEVATION (alpha-channel drop shadows for Graphics) ──
  elevation: {
    e1: { blur: 12, y: 4,  rgba: 'rgba(0,0,0,.30)' },
    e2: { blur: 30, y: 12, rgba: 'rgba(0,0,0,.45)' },
    e3: { blur: 50, y: 30, rgba: 'rgba(0,0,0,.60)' },
    glowPink: { blur: 26, rgba: 'rgba(255,0,127,.60)' },
    glowCyan: { blur: 26, rgba: 'rgba(127,231,255,.60)' },
  },
  // ── TYPE SCALE (px / family / weight) ──
  type: {
    displayXL: { size: 64, font: 'LuckiestGuy', caps: true },  // win headers
    displayM:  { size: 36, font: 'LuckiestGuy', caps: true },  // big counters / win amount
    uiXL:      { size: 24, font: 'Fredoka', weight: 600 },
    uiM:       { size: 16, font: 'Fredoka', weight: 500 },
    btn:       { size: 15, font: 'Fredoka', weight: 700 },
    monoXS:    { size: 11, font: 'SpaceMono', spacing: 0.14, caps: true }, // BALANCE/WIN/BET
  },
  fonts: { display: 'LuckiestGuy', body: 'Fredoka', mono: 'SpaceMono' },
  // ── SIGNATURE GRADIENT STOPS (for Graphics gradient fills) ──
  grad: {
    spinDome:    ['#ffffff','#ffd9ec','#ff5ab0','#ff007f','#b8005e'], // radial 36% 26%
    spinDomeLite:['#ffd9ec','#ff007f'],
    progress:    ['#ff007f','#ff8ab8'],
    btnPrimary:  ['#ff5ab0','#ff007f'],
    cabinetBorder:['#ffd0e6','#ff5ab0','#ff007f','#c4006a','#8a0050'],
    cabinetFill: ['rgba(30,12,42,.85)','rgba(10,6,18,.92)'],
    menuSurface: ['#21102f','#160a22'],
    winLine:     ['rgba(127,231,255,0)','#7fe7ff','#ffffff','#7fe7ff','rgba(127,231,255,0)'], // 0/12/50/88/100%
    glassCabinet:['rgba(255,255,255,.16)','rgba(10,6,20,.34)'], // Final Sugar Rush reel frame
  },
} as const;
export type Theme = typeof THEME;
```

**Mapping to v2 files:**
| v2 file | v3 action |
|---|---|
| `view/palette.ts` (`PAL`) | **Replace** → re-export from `theme.ts`: `export const PAL = { fonts: THEME.fonts, /* shim */ }`. Keep the named export `PAL` so existing imports compile, but point every token at `THEME`. |
| `view/view-config.ts` (`VIEW_CONFIG`) | **Retune** — set `win.ringColor`/`win.glowColor` to `THEME.accent.cyan`, `ceremony.tiers[].color` to `[pink p200, fuchsia, cyan, white]` (BIG/MEGA/SUPER/EPIC), `anticipation.auraColor` to `THEME.pink.p400`. Spin/land/turbo timing knobs **unchanged**. The tier **bands** stay in `resolveBigWinTier` (render mapping; see below). |
| `view/fonts.ts` | **Asset swap** — `resources.load` Luckiest Guy + Fredoka + Space Mono; `applyFont(label, kind)` API unchanged. Add `SpaceMono` as the `mono` kind. |
| `particle-layer.ts` `CANDY[]` | **Swap palette array** → `[p500, p200, cyan, mint, fuchsia, gold]`; `COIN` gold stays. |
| `view/info-content.ts` (`paytableRows()`) | **Relabel display strings** to the candy names (display only — pays still come from engine `PAYTABLE`). This is the single place where "labels are candy" must also touch, or the paytable panel shows gem placeholders. |

**Win-ceremony tier colors** (bound in `view-config.ceremony.tiers`): BIG `#ff8ab8` / MEGA `#ff2ad0` / SUPER `#7fe7ff` / EPIC `#ffffff`. **Tier bands are a RENDER MAPPING over the model's win-multiple, owned by `view-config.resolveBigWinTier` (v2 reality — `classifyWinTier` is NOT wired and v3 does not pretend it is).** Display bands BIG 5–15× / MEGA 15–40× / SUPER 40–100× / EPIC 100×+ (cap 5000×) are presentation thresholds applied to `winCents/betCents`; the multiple itself is the engine's. The audio sting tier uses the existing inline `mult >= 50 ? 5 …` in the controller. (If a future owner wants the engine classifier to be the single source, that is a deliberate refactor: route both `resolveBigWinTier` and the audio sting through `classifyWinTier(winCents/betCents)` and delete the `/9` `tierBet` — out of scope here, noted so the wiring claim stays honest.)

---

## 4 · Symbol / paytable mapping — ART vs ENGINE (verified)

Engine truth (confirmed from `logic/game-config.ts`): `SYMBOLS = {WILD:0,H1:1,H2:2,H3:3,H4:4,L1:5,L2:6,L3:7,L4:8,L5:9}`, `SCATTER = 8`, paytable (line-bet ×, by id → 5/4/3-OAK). **Note the ties: id3≡id4 (500@5) and id6≡id7≡id8 (150@5).**

| id | engine 5/4/3 | tier (by 5-OAK) | Sugar Rush display | ART file to bind | README claim | **MATCH?** |
|---|---|---|---|---|---|---|
| 0 | 2000/1000/100 | WILD | **WILD** (heart-pop / gingerbread) | `sym_wild.png` | Wild ×100/1000/2000 | ✅ (note README lists 3/4/5; engine same set) |
| 1 | **1000/500/50** | HIGH top | **CROWN** (sugar royal — also STICKY-CROWNS symbol) | `sym_h1_crown.png` | README put CANDY CANE at ×50/500/1000 here | ⚠ **MISMATCH** — README's "CANDY CANE" pays match id 1, but binds it to `sym_l2_k.png`. **Reconcile: bind the highest-read candy ART to id 1; keep CROWN as the sticky-crowns symbol (bonus needs id 1).** |
| 2 | 750/150/20 | HIGH | **HEARTS** | `sym_h2_heart.png` | GUMMY BEARS ×20/150/750 → `sym_l3_q.png` | ⚠ pays match; art file differs |
| 3 | 500/100/15 | MID **(ties id4)** | **DIAMOND** | `sym_h3_diamond.png` | MINT/CHERRY ×15/100/500 | ⚠ art-file remap; **id3≡id4 pay tie — ordering arbitrary** |
| 4 | 500/100/15 | MID **(ties id3)** | **AMETHYST** | `sym_h4_horseshoe.png` | AMETHYST ×10/75/250 (README pay WRONG) | ⚠ **engine pay wins** (×500/100/15, not 250); keep ONLY the engine row |
| 5 | 250/75/10 | LOW-hi | **MINT DROP** | `sym_l1_a.png` | MINT DROP ×10/75/250 (README pay differs) | ⚠ **engine pay wins** (×250/75/10) |
| 6 | 150/50/5 | LOW **(ties id7,id8)** | **CANDY CANE** | `sym_l2_k.png` | CANDY CANE ×5/50/150 | ✅ if README's *low* row is used; **150@5 three-way tie** |
| 7 | 150/25/5 | LOW **(ties id6,id8)** | **GUMMY BEARS** | `sym_l3_q.png` | GUMMY BEARS ×5/25/150 | ✅; **150@5 three-way tie** |
| 8 | **SCATTER** — pays on COUNT `SCATTER_PAY {3:1.5,4:6,5:30}` (×bet, ×activeLines), **NOT a line win** | SCATTER | **SCATTER** (rainbow lollipop "FREE") | `sym_l4_j.png` (legacy "j") | Scatter art = `sym_l4_j.png` ✓ | ✅ **id 8 = SCATTER, never a low, never a line-win** |
| 9 | 100/15/5 | LOW lowest | **CHERRY DROP** | `sym_l5_10.png` | CHERRY DROP ×5/15/100 ✓ | ✅ lowest |

**Reconciliation rule (encode in `symbol-view.ts` / `SYM_RES` mapping):**
- The README's paytable has an **internal inconsistency** (CANDY CANE listed both as ×50/500/1000 HIGH and as a low) and contradicts the engine on AMETHYST (×500 vs ×250) and MINT DROP. **The engine PAYTABLE is authoritative for all numbers.**
- **Visual hierarchy is fixed by remapping ART** to ids, exactly as the v2 `ART_REMAP` precedent (memory: `cocos-symbol-remap-pipeline`): assign the most premium-reading candy art to id 1 (highest pay), descending to id 9 (lowest). **NEVER touch PAY/weights.**
- **Where pays tie** (id3≡id4 @500; id6≡id7≡id8 @150), any left-to-right art ordering is **cosmetic only** — it must NOT be coded or copy-written to imply a pay difference, and the paytable panel renders the identical pay for all tied ids.
- **id 8 pays as SCATTER on COUNT**, never on a line — do NOT wire a line-win for id 8. Drop the "150/25/5 line" framing entirely; scatter pay is `SpinOutcome.scatterCents`.
- **Hard constraints:** id 0 must be the Wild art; id 8 must be the Scatter art (`sym_l4_j.png`); id 1 must read as the **sticky-crowns** symbol because `BONUS_MODES.crowns` locks `SYMBOLS.H1 = id 1`.
- Symbol ids bind in code by **number 0–9**, never by the `SYMBOL_NAMES` strings (which are gem placeholders and even mislabel id 8 as `'Scat'`).
- **Display labels** live in `info-content.ts` `paytableRows()` AND the `symbol-view`/`SYM_RES` map — relabel both to candy; pays still come from engine `PAYTABLE`.

---

## 5 · The 13 build parts

Each part: files under `games/shining-pop-v3/`, the v2 system it forks, the work, and a ✅ checkpoint test. Paths relative to `games/shining-pop-v3/assets/scripts/` unless absolute.

### Part 1 — Scaffold & package identity
- **Files:** `package.json`, `tsconfig.json`, `settings/**`, `build-templates/web-mobile/index.ejs`, root `pnpm-workspace.yaml` (no edit; `games/*` glob), `scripts/assemble-demo.mjs`.
- **Forks:** entire v2 project skeleton.
- **Work:** `cp -r games/shining-pop-v2 games/shining-pop-v3`; `rm -rf` `library temp profiles node_modules build`; set `package.json` `name`→`@artest/shining-pop-v3`, **generate a fresh `uuid` and write it BEFORE the first editor open** (v2 is `456ab05f-2da4-42e1-84b4-57aa7e7182b1` — MUST change to avoid editor collision); keep `creator.version 3.8.8` and `"@artest/math-core":"workspace:*"`; edit `index.ejs` `<title>` → "SHINING POP V3"; add `{ slug:'shining-pop-v3', src:'games/shining-pop-v3/build/web-mobile' }` to the GAMES array in `assemble-demo.mjs` (after line 28); `pnpm install` at repo root; **then open the project in Cocos Creator 3.8.8 ONCE and let the full reimport finish.**
- **✅ (hard prerequisite for Part 2):** `pnpm install` links `node_modules/@artest/math-core`; **the project opens in Cocos 3.8.8 once with no UUID-collision warning and the full asset reimport completes** (this is what regenerates `temp/tsconfig.cocos.json`, which `tsconfig.json` extends — **no `tsc` can run before this open**); `package.json` uuid ≠ v2's.

### Part 2 — Theme tokens & font swap
- **Files:** create `view/theme.ts`; rewrite `view/palette.ts` (shim → `theme.ts`); edit `view/fonts.ts`; add `resources/fonts/SpaceMono`.
- **Forks:** `palette.ts` + `fonts.ts`.
- **Work:** drop in §3 `theme.ts`; point `PAL` tokens at `THEME`; load Space Mono; keep `applyFont` API.
- **✅** (Part 1 editor-open + reimport already done) `npx tsc --noEmit` clean for `view/theme.ts|palette.ts|fonts.ts` (ignore engine `.d.ts` noise); a built scene shows the three font families on labels.

### Part 3 — Symbol art, paytable binding & candy labels
- **Files:** `resources/sym/*.png` (+ `.meta`, **keep UUIDs**), the `SYM_RES`/symbol-id map in `symbol-view.ts` / `slot-view.ts`, **`view/info-content.ts` (`paytableRows()` display labels)**.
- **Forks:** v2 symbol resource binding + info content.
- **Work:** apply §4 ART_REMAP so the visual hierarchy descends id1→id9, id0=Wild, id8=Scatter art (`sym_l4_j.png`). Do NOT edit `PAYTABLE`/`REEL_WEIGHTS`. Reskin/reslice candy art per the symbol-reskin pipeline (sharp in temp dir; preserve `.png.meta` UUIDs; headless build re-imports trim rect). **Relabel display strings to candy names in BOTH `info-content.ts` and the `symbol-view`/`SYM_RES` map** (display only; pays stay engine-sourced). Honor the ties: tied ids render identical pays.
- **✅** Paytable panel renders pays straight from engine `PAYTABLE` (id1 shows ×1000@5; id6/id7/id8 all show ×150@5; id3/id4 both ×500@5) with **candy labels from `info-content.ts`** (no gem placeholders); `npm test` parity test still green (`tests/feature.test.ts` math-core drift gate); id 8 cell shows the rainbow-lollipop scatter art.

### Part 4 — Reel cabinet & board (Sugar Rush glass)
- **Files:** `view/slot-view.ts` (frame/cabinet/cell build), `view/reel-view.ts` (keep), `view-config.ts` (cell metrics).
- **Forks:** `slot-view` frame chrome (**rebuild**); `reel-view` (**keep as-is**).
- **Work:** rebuild the cabinet to the **Final glass recipe**: bg `linear-gradient(180deg, rgba(255,255,255,.16), rgba(10,6,20,.34))`, `2px rgba(127,231,255,.55)` border, radius 18 (desk)/16 (mob), `box-shadow 0 0 34px rgba(127,231,255,.3), inset 0 1px 0 rgba(255,255,255,.28)`. Cell metrics: desktop col 100×300, art box 84×84, img ≤76%, radius 12, gap 8; mobile col 56×168, art box 48×48, img ≤78%, radius 9, gap 5. Route all chrome through `THEME` (the prep step: convert inline `C{}`/`new Color()` → `THEME` first). `reel-view.ts` spin/stagger/settle: untouched (config-driven).
- **✅** `canvas-anomaly-detector` containment/centering asserts pass: reels centered, no cropped symbols, cabinet contains all 15 cells, board within design 1280×720.

### Part 5 — Reel spin motion contract
- **Files:** `view-config.ts` (`spin/land/turbo`), `controller/slot-controller.ts` (timing wiring).
- **Forks:** `reel-view` mechanics (config only).
- **Work:** lock reel-stop cascade `[620, 840, 1060, 1280, 1500]ms` (220ms stagger L→R); win reveal **+380ms** after last stop; spin blur 3px desktop / 2px mobile, `brightness 1.06`; settle 380ms overshoot. Honor `prefers-reduced-motion` via `setReducedMotion`.
- **✅** Trajectory harness (`D:/tmp-render/cocos-crispstop.mjs`, freeze-rAF + `director.tick`) confirms 5 stops at the listed offsets ±1 frame; reduced-motion path cuts loops, keeps count-up.

### Part 6 — Win presentation (STATIC ring — C1; + WILD STRIKE & SCATTER pay — C15)
- **Files:** `view/symbol-view.ts` (`playWin`, `setDimmed`), `view-config.ts` (`win.*`), `resources/effects/{symbol-win,soft-burst,win-beam}.effect` (keep, recolor via vertex color), wild-strike + scatter-pay readout in `slot-view.ts`.
- **Forks:** `symbol-view` win FX (light rebuild).
- **Work:** **disable the `spWin` scale-pulse and jelly loop** (C1). Winners get: static ring `0 0 0 2px #fff, 0 0 20px rgba(127,231,255,.9)` + alpha-clipped `soft-burst`/`symbol-win` glow; non-winners dim to ~55% (`setDimmed`); win-line = cyan/white `win-beam` ribbon at vertical center (top 150 desk / 84 mob, h6/h4), `spLine 1.1s` opacity pulse. **Render the WILD STRIKE multiplier** (from `SpinOutcome.wildStrike`, ×1–×3 when ≥3 wilds land) as a callout near the affected wilds + applied to the count-up. **Render the SCATTER pay** (`SpinOutcome.scatterCents`) when 3+ scatters land — paid on count (cyan signalling), never as a line win. Keep `winActive` race guard + `resetHome` mask-escape. Replace gingerbread `happyFace` / candy-confetti palette with Sugar Rush equivalents (or retint).
- **✅** Static-capture (swiftshader OK for non-shader rings/Graphics): winning cells show ring+glow with **no scale change** frame-to-frame; losers at ~55% opacity; cyan only on win/scatter; a wild-strike spin shows the ×N multiplier and the count-up equals the model's wild-strike-adjusted `winCents`; a 3+ scatter spin shows the scatter pay = model `scatterCents`.

### Part 7 — HUD, top band & menu (C2/C3; + scatter/wild-strike readout)
- **Files:** `view/slot-view.ts` (HUD/menu/top-bar panels). **First locate the current mobile-gear handler** (cite the `slot-view.ts` method) to confirm whether it opens settings or the menu today.
- **Forks:** `slot-view` panel chrome (rebuild).
- **Work:** Desktop top band `[☰ menu] — [logo h86 spFloat 4s] — [BALANCE pill]`; mobile `[☰ 40] — [logo 66] — [gear→opens MENU]` (C3: repoint the gear handler to open the menu — NOT a second settings surface). **Menu popover = 5 rows only** (Sound FX toggle ON, Music toggle OFF, Game Rules ›, Paytable ›, Settings ›) — **NO Game History** (C2). Width 236, plum surface, pink border, blur(8). Balance/Win pills per spec (cyan/mint borders, Space Mono labels, Luckiest/Fredoka values). Ensure any HUD win-context readout surfaces the scatter pay / wild-strike multiplier from the model when present (Part 6 owns the in-grid callout; HUD shows the resulting totals).
- **✅** Menu shows exactly 5 rows, no "Game History"; **the named mobile-gear method now opens the menu** (verified, not just asserted); Settings reachable only via Menu→Settings; balance/win pills reflect model totals including scatter/wild-strike.

### Part 8 — Betting bars (autoplay grouped — C5; six-level quick-bet — C4)
- **Files:** `ui/betting-bar.ts` (`BettingBarMobile`), `ui/betting-bar-web.ts` (`BettingBarWeb`). **Edit BOTH.**
- **Forks:** both bars (rebuild visuals, keep API + events).
- **Work:** rebuild draw routines to Sugar Rush via `THEME`; **preserve every public method + emitted event** (`spin/autoplay/bet:dec/bet:inc/bet:set/bet:double/turbo/menu/volume/sound/ui:click`). **Group autoplay WITH the bet controls** (C5), drawn as part of the cluster — **never a standalone violet gem**: desktop cluster `[− BET 2.00 +] · [autoplay] · [⟳ spin pink #ff007f 84] · [⚡ turbo 44]`; mobile `[− +/BET] · [autoplay] · [spin 88] · [⚡/TURBO label]`. **Quick-bet popover = the SIX engine levels `1.00, 2.00, 3.00, 5.00, 7.00, 10.00`** (C4) — fed by `configureQuickBetPanel(BET_LEVELS_CENTS, …)`; `bet:set(idx)` indexes that array, so the panel count MUST equal `BET_LEVELS_CENTS.length` (6) or out-of-range indices silently snap to 1.00. **No 0.50 / 250.00 / 9-preset / 14-step copy anywhere.** Spin button = pink dome (C7), idle `spPulseBtn 2.4s`, static while spinning. Bet ladder + levels stay 100% engine-driven (`bet-levels.ts`); display = `betCents/100`.
- **✅** Both orientations build; autoplay sits inside the bet cluster (no separate gem) in each; quick-bet shows **exactly the 6 engine presets 1.00–10.00**; selecting each emits a valid `bet:set` index with no snap-to-min; spin is pink; bar API binds with no controller errors; affordability/steppers gated by model.

### Part 9 — Settings panel (C6)
- **Files:** `view/slot-view.ts` `openSettingsPanel` (rebuild), `view-config.ts` (modal sizing), wire to model/lifecycle.
- **Forks:** v2 settings panel.
- **Work:** build Settings with **exactly**: Sound volume, Music volume, Quick Spin toggle, Reduce Motion toggle, Battery Saver toggle, Language select. Wire Sound/Music vol → `AudioManager.setVolume`/bus; Reduce Motion → `setReducedFx`/`setReducedMotion`; Battery Saver → `VfxGovernor` cap + DPR clamp; Quick Spin → turbo default; Language → label localization hook. **Reachable only from Menu→Settings** (C3).
- **✅** Panel exposes all 6 controls; toggles drive real engine/audio/VFX state; no duplicate settings entry anywhere.

### Part 10 — Win ceremony (4 tiers, skippable — C13; tier bands are view-side render mappings)
- **Files:** `view/ceremony-view.ts`, `view-config.ts` (`ceremony.tiers`, beats, **`resolveBigWinTier`**), `resources/effects/{soft-burst,screen-post,particle-glow}.effect`, Spine win-callout skeleton swap, `resources/spine/*`.
- **Forks:** `ceremony-view` (re-skin + asset swap).
- **Work:** keep the beat structure (dim→hush→flash→banner→count-up→savour→dismiss; all in `VIEW_CONFIG.ceremony`). Retune 4 tiers: BIG `#ff8ab8` (coin arc, 1 confetti, 1.2s, reels visible) / MEGA `#ff2ad0` (takeover, sugar-rain, 2.5s) / SUPER `#7fe7ff` (camera push, shake, 4s) / EPIC `#fff` (god-rays, gold fountain, 6s+). **All skippable on tap** (outside-tap dismisses; the count-up snaps to the final value on skip). **Tier band is chosen by `resolveBigWinTier(multiple)` in the VIEW** (the existing v2 wiring — a render mapping over the model's win-multiple; `classifyWinTier` is NOT used and is not claimed to be). Swap `cupid-wf` skeleton + `TIER_ANIM` map; procedural fallback retained.
- **✅** Each tier fires at the band `resolveBigWinTier` returns for the model's win-multiple; tap mid-ceremony skips to the final count value; **count-up final = exact `winCents` from the model** (this is the only number that must be exact); `screen-post` intensity rises by tier. (Note: the ✅ tests `resolveBigWinTier`'s banding, NOT `classifyWinTier`, because nothing calls the latter.)

### Part 11 — Free spins & buy-bonus (engine modes — C11/C12; two distinct FS sources)
- **Files:** `view/buy-bonus-modal.ts` (rebuild), `view/slot-view.ts` (FS world tint, sticky HUD, FAB), `resources/effects/{grid-merge,unlock-burst}.effect`, `resources/spine` FS bg.
- **Forks:** buy modal + FS playback.
- **Work:** Buy modal iterates **`BONUS_MODES_BY_VALUE`** (cost-sorted, cheapest first — never a hardcoded order) = **3 engine modes** (C11): WILD REELS (cyan, ×33.64), STICKY CROWNS (mint, "BALANCED", ×96.99), STICKY WILDS (fuchsia, "TOP VOLATILITY", ×110.68). **Costs are bet-MULTIPLIERS, not dollar prices** — the modal renders `fmt(model.bonusCost(mode))` at the **current** bet (controller already computes this at `slot-controller.ts:313`; `bonusCost = round(betCents × cost)`). At min bet 1.00 they read 33.64 / 96.99 / 110.68; at 2.00 they read 67.28 / 193.98 / 221.36 — **never hardcode the dollar figure or any "13.5×/38.8×/44.3× lowest" ratio (those are wrong; 110.68/33.64 = 3.29×).** `confirm dialog before debit`, tap-outside dismiss. Cost = model's `bonusCost` — **never recomputed in view.**
  **Two FS sources, kept distinct:** (a) **bought** bonus → **always 8 spins** (`BONUS_MODES[mode].spins = 8`, `runFreeSpins(mode, 8)`), mode = the purchased mode; (b) **scatter-triggered** → **3/6/10 spins** (`FREE_SPINS_AWARD`), mode always `'wilds'` (`runScatterFreeSpins` hardcodes it via `SCATTER_FS_MODE`). The "N OF M LEFT" counter for each path reads its own model outcome — **never seed it from `FREE_SPINS_AWARD` for a bought feature.** Cyan/teal world tint, sticky-wilds render, mint multiplier badge. Mobile buy = vertical stacked list. Feature-unlock uses `unlock-burst.effect` (gummy SDF) + `grid-merge` entry wipe.
- **✅** Buy modal lists modes in `BONUS_MODES_BY_VALUE` order; each shows `model.bonusCost(mode)` at the live bet (changes when bet changes); **bought bonus runs 8 spins; scatter bonus runs 3/6/10**; the counter total matches whichever path triggered; debit equals model's `bonusCost`; confirm dialog gates debit; parity test green.

### Part 12 — Audio & motion sync
- **Files:** `view/audio-manager.ts` (keep near-verbatim), `build-templates/web-mobile/audio/*.mp3`, controller AV-sync calls.
- **Forks:** audio mixer (reuse).
- **Work:** keep the 4-bus WebAudio mixer (`music/gameplay/sfx/win`, dB levels, ducking, oscillator fallback). Swap MP3 bank to Sugar Rush clips (37 `ClipId`s). SFX cue map: spin start = sugar pop; 5 reel stops = ascending pitch L→R; win line = sparkle chime + coin roll; scatter/big win = crystal shimmer→fanfare; wild-strike = a distinct charge-up hit. Music: 120 BPM base loop ↔ cyan free-spins layer ↔ brass-bells big-win sting (crossfade by state). Tier→sting via `audio.win(tier)` using the **existing controller tier (inline `mult >= 50 ? 5 …`)** — the same render-mapping reality as Part 10, not `classifyWinTier`.
- **✅** Reel-stop pitch ascends across the 5 stops; win sting tier matches the controller-derived band; reduced-motion keeps count-ups + audio; mute/volume honored; degrades to oscillator before samples decode.

### Part 13 — Build, splash/gates, compliance, deploy & QA
- **Files:** `build-templates/web-mobile/{index.ejs, loader/*}`, splash/tap-to-play in `slot-view.ts`/scene, `scripts/assemble-demo.mjs`, `vercel.json`; compliance/autoplay seams `logic/{compliance.ts,autoplay.ts}` + their controller wiring.
- **Forks:** v2 build + splash + demo wiring + inherited compliance/autoplay.
- **Work:** Splash = bg.jpg + floating logo + "a premium candy slot" + pink progress bar + `LOADING ASSETS` + footer `WEBGL · 18+ · PLAY RESPONSIBLY` (**correct the legal strip — engine is Cocos/WebGL, not PixiJS; do not ship the PixiJS template copy**). Tap-to-play audio-unlock gate (calls `AudioManager.unlock()`). Landscape-first + rotate card on portrait; honor `prefers-reduced-motion`. **Compliance / responsible-gaming (approval-floor, NOT optional polish — inherited from `logic/compliance.ts` + `logic/autoplay.ts`):** (a) **Autoplay stop-conditions** surfaced in the autoplay control — spin count, loss limit, single-win limit; (b) **LDW honesty** — when `winCents <= bet` (the controller's `ldw` branch), present it honestly as a loss-disguised-as-win, never as a celebratory "win"; (c) **reality check** prompt if the inherited compliance seam provides one. Headless build (§6). Multi-file web-mobile must NOT be URL-rewritten in `vercel.json`/`assemble-demo`.
- **✅** Headless build emits `build/web-mobile/` with `index.html`; legal strip says WebGL (not PixiJS); autoplay panel exposes count + loss + single-win stop conditions and they actually halt autoplay; an LDW spin (win ≤ bet) is presented honestly (no big-win ceremony, banner reflects the disguised-loss reality); demo assembles with the v3 slug; 100-spin QA via measure harness shows 0 non-finite renders, 0 layout anomalies, balance/win/scatter/wild-strike consistent with model.

---

## 6 · Fork & scaffold recipe

```bash
# 1. Fork (sibling package, NOT nested)
cp -r D:/projects/artest-brainrocket-task/games/shining-pop-v2 \
      D:/projects/artest-brainrocket-task/games/shining-pop-v3
rm -rf D:/projects/artest-brainrocket-task/games/shining-pop-v3/{library,temp,profiles,node_modules,build}

# 2. Identity edits — sequence is load-bearing: copy → edit uuid → THEN open editor
#  package.json:  "name": "@artest/shining-pop-v3",  "uuid": "<NEW-uuid>"  (NOT 456ab05f-…, set BEFORE first open — R8)
#  keep creator.version 3.8.8  and  "@artest/math-core": "workspace:*"
#  index.ejs <title> → SHINING POP V3
#  assemble-demo.mjs (GAMES array, after line 28):
#     { slug: 'shining-pop-v3', src: 'games/shining-pop-v3/build/web-mobile' },

# 3. Link workspace (games/* glob already registers it)
cd D:/projects/artest-brainrocket-task && pnpm install

# 4. OPEN IN COCOS CREATOR 3.8.8 ONCE — full reimport. This is a HARD PREREQUISITE before any tsc
#    (it regenerates temp/tsconfig.cocos.json, which tsconfig.json extends). Let the reimport finish.
```

**Copy verbatim (tracked skeleton):** `package.json`(+edits), `tsconfig.json`, `settings/**` (leave the inner `settings/v2/` profile-folder NAME alone — it's a profile name, not a version), `build-templates/web-mobile/**`, **all of `assets/**` INCLUDING every `.meta`** (UUIDs bind scripts↔scene; `assets/resources.meta` `isBundle:true` must stay), `tools/`, `tests/`, docs.
**Regenerate (gitignored, machine-local):** `library/` (asset cache, full reimport on first open — slow, let it finish), `temp/` (incl. `temp/tsconfig.cocos.json` that `tsconfig.json` extends — exists only after first editor open), `profiles/`, `node_modules/`, `build/web-mobile/`.

**Build + preview commands:**
```bash
# Open in Cocos Creator 3.8.8 ONCE first (regenerates library/temp/profiles; reimports assets) — see step 4. tsc cannot run before this.
"C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe" \
  --project D:/projects/artest-brainrocket-task/games/shining-pop-v3 \
  --build "platform=web-mobile;debug=false"
# Output: games/shining-pop-v3/build/web-mobile/  (assets/ audio/ cocos-js/ loader/ src/ index.html)

# Assemble demo (after adding the v3 slug):
node D:/projects/artest-brainrocket-task/scripts/assemble-demo.mjs

# Verify render (swiftshader — real WebGL, paints Graphics/scene; shaders won't paint, see §7):
node D:/tmp-render/render.mjs   # or cocos-crispstop.mjs for trajectory proof
```
**Build serialization:** the Cocos build locks port **:7457** — check for a running `--build` before launching (parallel-session hazard). Never kill `CocosCreator.exe` mid-build.

---

## 7 · Risk register & Cocos gotchas

| # | Risk / gotcha | Mitigation (binding) |
|---|---|---|
| R1 | **`[...Set]` mis-transpiles** on web-mobile → `[].concat(Set)` doesn't iterate (crashed v2 buyBonus). | **Always `Array.from(set)`**, never spread a Set. Grep new code for `[...` on Sets before build. |
| R2 | **`repeatForever` on plain-object tweens crashes after node destroy.** | Don't `repeatForever` tweens whose target may be destroyed (idle loops on pooled/ceremony nodes). Stop tweens in `onDestroy`/`abort`. |
| R3 | **EFX2406** — `.effect` scanner strips builtins (e.g. `CCSampleWithAlphaSeparated`) hidden in `#define` macros → ES100 "no matching overloaded function". | Call the builtin **literally inside `#if USE_TEXTURE`** (the win-fire pattern). Keep `in vec2 uv0;` declared **outside** the `#if`. **Do NOT add a `depthStencilState` block to `svarka-additive.effect`** (it makes the glow escape a parent Mask). All 13 v2 shaders already comply — preserve verbatim on reuse. |
| R4 | **CLI build corrupts editor `window.json`/`layout.json`** if `CocosCreator.exe` is killed mid-session → next headless `--build` dies ("Recovery window failed / Unexpected end of JSON"). | Never kill the editor mid-build. If bricked, delete the corrupt JSON (forces a slow full reimport — let it finish). |
| R5 | **swiftshader can't paint custom-shader panels** (WebGL throttle paints Graphics/scene but not `.effect` material output). | Verify **Graphics/layout** geometry on swiftshader (`render.mjs`); verify **shader VFX** on a **d3d11/ANGLE GPU** Playwright run or a standalone WebGL2 page, or have the editor/user open the build. Don't conclude "shader broken" from a swiftshader blank. |
| R6 | **Non-finite numbers** (∞/NaN) reach render → garbage layout/text. | Keep the non-finite render guards (both games already have them); guard every count-up/scale/position the view derives from model cents (incl. wild-strike-multiplied and scatter totals). |
| R7 | **DPR uncapped** → blurry/overcost symbols. | Oversample symbols 2× but **cap DPR**; Battery Saver (Part 9) clamps DPR + `VfxGovernor` particle cap. |
| R8 | **Duplicate project UUID** collides in the editor. | Regenerate `package.json` `uuid` (≠ `456ab05f-…`) **before the first editor open** (sequence: copy → edit uuid → open). |
| R9 | **First open after copy** triggers a full asset reimport (no `library/`) — looks like a hang, and **`tsc` cannot run until it completes** (the extended `temp/tsconfig.cocos.json` doesn't exist yet). | Expected; let it finish. Part 1's ✅ gates on a successful first open + reimport BEFORE Part 2's `tsc`. |
| R10 | **Editing `PAL` alone leaves areas un-themed** — `slot-view`/bars/`ceremony-view`/`symbol-view` define local `C{}`/`new Color()` that ignore `PAL`. | The prep step: route those inline literals through `THEME` first (Parts 4/7/8/10), then the re-skin is a token swap. |
| R11 | **Headless tab throttles the loop** — can't observe tweens via sleep+eval. | Use `cc.game.step` / `director.tick(fixed-dt)` with frozen rAF to drive and freeze frames for capture (the crispstop harness pattern). |
| R12 | **Two betting bars by orientation** — editing one leaves the other stale. | Any bar change edits BOTH `betting-bar.ts` and `betting-bar-web.ts`; verify both viewports. |
| R13 | **Math drift** — changing visuals must not change odds; parity test gates it. | Never edit `PAYTABLE`/`REEL_WEIGHTS`/`PAYLINES`/`bet-levels.ts`/`BONUS_MODES`. Keep `tests/feature.test.ts` (math-core drift gate) green. Remap ART for hierarchy, never math. |
| R14 | **assemble-demo hardcodes only 2 slugs** (confirmed GAMES array lines 27-28) → v3 invisible in demo. | Add the v3 slug entry; mirror v2's no-URL-rewrite rule in `vercel.json`. |
| R15 | **Quick-bet panel is INDEX-BOUND to `BET_LEVELS_CENTS`**, not display-only — extra presets emit out-of-range `bet:set` indices that `?? minBet()` silently snap to 1.00, and 250.00 is unreachable (`snapBet(25000)=1000`). | Quick-bet panel size **must equal** `BET_LEVELS_CENTS.length` (6). A wider ladder is a **math change** to `bet-levels.ts` + re-cert, never a view preset. |
| R16 | **Bought bonus (8 spins) vs scatter FS (3/6/10) conflation** — seeding a bought-bonus counter from `FREE_SPINS_AWARD` shows the wrong total. | Read each FS counter from its own model outcome: bought = `BONUS_MODES[mode].spins` (8); scatter = `FREE_SPINS_AWARD[count]` with mode always `'wilds'`. |
| R17 | **Bonus cost is a bet-MULTIPLIER, not a dollar price** — hardcoding "33.64" or "@ bet 2.50" produces wrong/impossible numbers (2.50 isn't a selectable bet). | Always render `fmt(model.bonusCost(mode))` at the live bet; never hardcode the dollar figure or invent a bet level. |
| R18 | **WILD STRIKE multiplier & SCATTER pay are real engine outputs** (`SpinOutcome.wildStrike` / `.scatterCents`) that the view can silently drop. | Part 6/7 must render both; scatter pays on COUNT (never a line win for id 8); wild-strike ×N feeds the count-up. |
| R19 | **Tier band is VIEW-side** (`resolveBigWinTier` + inline `mult>=50`), `classifyWinTier` is unused. | Own this reality; don't claim/assert the engine classifier drives the ceremony. Only the count-up FINAL value must be exact (= model `winCents`). |

---

## 8 · Recommended implementation workflow (checkpoint-gated)

**Phase 0 — Foundation (sequential, blocking).** Part 1 → Part 2 → Part 3. **Ordering is load-bearing:** copy → set uuid → `pnpm install` → **first editor open + full reimport (HARD GATE)** → only then any `tsc`. Nothing else can start until the project opens clean, fonts/theme compile, and the parity test is green. **Gate: P1✅ (UUID unique + first open/reimport complete) → P2✅ (`tsc` clean) → P3✅ (`npm test` parity green, candy labels in `info-content.ts`).**

**Phase 1 — Re-theme seam (parallelizable after the prep refactor).** Once Part 4's first move (route inline `C{}`/`new Color()` → `THEME` in `slot-view`/bars/`ceremony`/`symbol`) lands, fan out the **config/data re-theme** work in parallel: `view-config.ts` retune (Parts 5/6/10 knobs), `particle-layer` palette, `anticipation` aura, `fonts`. These are token/number edits with no cross-dependencies. **Gate: build compiles; canvas-anomaly-detector geometry asserts pass (Part 4 ✅).**

**Phase 2 — Procedural rebuilds (fan out by surface, each its own checkpoint).**
- Stream A: **Part 4** cabinet/cells + **Part 5** motion (reel surface).
- Stream B: **Part 7** HUD/menu + **Part 9** Settings (top + menu surface; share C3 de-dupe; Part 7 first verifies the gear handler).
- Stream C: **Part 8** both betting bars (edit in lockstep; share API contract; six-level quick-bet).
- Stream D: **Part 6** win presentation (static ring + wild-strike/scatter readout) + **Part 10** ceremony + **Part 11** FS/buy (the win/feature surface).
- Stream E: **Part 12** audio (independent; sync points wired by controller).
These streams touch mostly disjoint files; serialize only where they share `slot-view.ts` (Parts 4/7/9/11) — sequence those within `slot-view` to avoid edit-staleness races, re-reading before each apply (v2 parallel-session protocol: WORKTREES FORBIDDEN, single tree, commit-sweep).

**Phase 3 — Integration, compliance & adversarial visual verification (sequential).** Part 13 build + splash + **compliance/autoplay/LDW** + deploy. Then run the **adversarial visual gate** — do NOT eyeball screenshots:
1. **`canvas-anomaly-detector`** — measure from the live scene graph (paint-order walker + assert helpers): centering, containment (no cropped symbols, cabinet contains cells), z-stack (logo not under reels), onscreen, overlap — across **every state** (base, win, wild-strike, 3+ scatter, each ceremony tier, bought FS [8 spins], scatter FS [3/6/10], buy modal, each popover, both orientations).
2. **measure harness** (`D:/tmp-render/render.mjs` + `cocos-crispstop.mjs`, swiftshader + frozen-rAF + `director.tick`) — prove reel-stop offsets `[620,840,1060,1280,1500]`, static-win-ring (no scale delta frame-to-frame, C1), quick-bet emits valid `bet:set` indices for all 6 levels, 100-spin run = 0 non-finite renders, balance/win/scatter/wild-strike == model.
3. **Shader VFX** — verify on a GPU/ANGLE Playwright run or standalone WebGL2 page (swiftshader can't paint shaders, R5).
4. **Compliance gate** — autoplay stop-conditions actually halt; LDW spin presented honestly; reality check (if the inherited seam provides one) fires. Then run `stake-approval-visual-gate` (approval floor) then `cocos-aaa-visual-gate` (polish ceiling) before sign-off.

**Checkpoint discipline:** every Part's ✅ acceptance test is a hard gate. Each gate verifies against the **model's numbers** (bet, win, bonus cost, spin count, scatter pay, wild-strike multiplier), never the visuals — re-asserting THE ONE RULE: math decides, view renders. The single number that must be frame-exact is the count-up final = model `winCents`.

---

### Cited authoritative paths
- Engine truth: `D:/projects/artest-brainrocket-task/games/shining-pop-v2/assets/scripts/logic/{game-config.ts,spin-engine.ts,rng.ts,types.ts,bonus-engine.ts,bet-levels.ts,compliance.ts,autoplay.ts}` (verified: `SCATTER=8`, `WILD=0`, paytable + ties id3≡id4 / id6≡id7≡id8, `BET_LEVELS_CENTS=[100,200,300,500,700,1000]`, `BONUS_MODES` all `spins:8` / costs ×33.64/×96.99/×110.68 / `BONUS_MODES_BY_VALUE` cost-sorted, `WILD_STRIKE {minWilds:3,maxMultiplier:3}`, `SCATTER_PAY {3:1.5,4:6,5:30}`, `FREE_SPINS_AWARD={3:3,4:6,5:10}` scatter-only, `SCATTER_FS_MODE='wilds'`, `runScatterFreeSpins(rng,spins)` mode-hardcoded).
- Model/controller: `.../scripts/model/slot-model.ts`, `.../scripts/controller/{slot-controller.ts,lifecycle.ts}` (verified: `configureQuickBetPanel(BET_LEVELS_CENTS,…)`:122, `bet:set` index:240, `bonusCost`:313, audio tier inline:553, `ldw`/`tierBet=round(winCents/9)`:665-667).
- View seam: `.../scripts/view/{palette.ts,view-config.ts (resolveBigWinTier:536),fonts.ts,info-content.ts (paytableRows),slot-view.ts,reel-view.ts,symbol-view.ts,ceremony-view.ts (resolveBigWinTier:210),buy-bonus-modal.ts,particle-layer.ts,particle-pool.ts,anticipation-layer.ts,audio-manager.ts}`; bars `.../scripts/ui/{betting-bar.ts,betting-bar-web.ts}`.
- Shaders: `.../games/shining-pop-v2/assets/resources/effects/*.effect` (13).
- math-core: `D:/projects/artest-brainrocket-task/packages/math-core/src/` (`classifyWinTier` exists but is UNUSED by v2's ceremony/audio path); parity gate `.../games/shining-pop-v2/tests/feature.test.ts`.
- Build wiring: `package.json` (v2 uuid `456ab05f-2da4-42e1-84b4-57aa7e7182b1` — regenerate), `D:/projects/artest-brainrocket-task/scripts/assemble-demo.mjs` (GAMES array slugs lines 27-28), `pnpm-workspace.yaml` (`games/*`), root `.gitignore` (`games/*/{library,temp,profiles,local}/`).