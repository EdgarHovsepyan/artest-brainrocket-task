Confirmed: bet display is `betCents / 100`, so `betCents=100` shows as "1.00". This means the **engine's selectable bet ladder is 1.00, 2.00, 3.00, 5.00, 7.00, 10.00** (six levels). The blueprint's "spec bet 2.50" and "presets 0.50…250.00" are **fiction** — `betCents=250` is not even a valid snap target (closest snap = 200 or 300). The blueprint even computes buy costs "@ bet 2.50" which the engine cannot select.

I now have a complete, evidence-backed picture. Here is my review.

---

# Principal review — shining-pop-v3 BUILD BLUEPRINT

Verified against the live v2 engine/controller/view. The blueprint is **architecturally sound** (fork strategy, token seam, "math decides/view renders" discipline, fork recipe, most Cocos gotchas). But it contains **several engine-truth errors** that, if built as written, produce wrong numbers on screen or unbuildable surfaces. Prioritized below.

## P0 — blockers (wrong numbers / contradict the engine)

**P0-1. The bet ladder is fiction. Engine `BET_LEVELS_CENTS = [100,200,300,500,700,1000]` → on-screen BET = 1.00 / 2.00 / 3.00 / 5.00 / 7.00 / 10.00 (six levels).**
- The blueprint's C4/Part 8 "quick-bet presets = `0.50,1.00,2.50,5.00,10.00,25.00,50.00,100.00,250.00` (9 presets)" is invented. `slot-controller.ts:122` calls `view.configureQuickBetPanel(BET_LEVELS_CENTS, …)` and `bet:set` indexes into `BET_LEVELS_CENTS` (line 240). A 9-entry panel would emit `bet:set(idx 6..8)` → `BET_LEVELS_CENTS[idx] ?? minBet()` → silently snaps to 1.00. The quick-bet panel **is** the engine ladder; you cannot add presets without editing `bet-levels.ts` (which changes math).
- "bet 250.00" is not selectable at all: `snapBet(25000)` → 1000 (10.00). The blueprint's claim that "display ≠ math, presets are display-only" is false for THIS control — it's index-bound to the engine array.
- **Fix:** Quick-bet panel = the 6 engine levels (1.00–10.00). Delete the 9-preset / 0.50 / 250.00 / "14 steps" copy everywhere (C4, Part 8, §1). If a wider ladder is genuinely wanted, that is a **math change** to `bet-levels.ts` + re-cert, not a view preset.

**P0-2. Buy-bonus = 8 spins (fixed), NOT 3/6/10. The blueprint conflates bought-bonus with scatter free-spins.**
- `BONUS_MODES` (all three modes) = `spins: 8`. `model.buyBonus(mode)` runs `runFreeSpins(rng, mode, BONUS_MODES[mode].spins)` = **8**. `FREE_SPINS_AWARD={3:3,4:6,5:10}` applies **only** to the scatter-triggered path (`SCATTER_FS_MODE='wilds'`).
- The blueprint never states bought-bonus = 8 spins anywhere; §1, C12 and Part 11 imply 3/6/10 applies to buys. A built "N OF M LEFT" counter seeded from FREE_SPINS_AWARD for a bought feature would show the wrong total.
- **Fix:** Part 11 must distinguish two FS sources: (a) **bought** → 8 spins, mode = the purchased mode; (b) **scatter** → 3/6/10 spins, mode always `'wilds'` (`runScatterFreeSpins` hardcodes `mode:'wilds'`). The counter for each reads from the respective model outcome, never a constant.

**P0-3. "Costs shown @ bet 2.50" is impossible and the cost numbers in C11/Part 11 are mislabeled.**
- `bonusCost = round(betCents × cost)`. The 33.64/96.99/110.68 are **multipliers of total bet in cents**, not dollar prices. At the min bet (1.00 = 100¢): reels = 3364¢ = **33.64**, crowns = **96.99**, wilds = **110.68**. The blueprint's "33.64 / 96.99 / 110.68" are the *min-bet* dollar costs, and the "@ bet 2.50" framing is wrong (2.50 isn't selectable; at 2.00 they'd be 67.28 / 193.98 / 221.36).
- The "13.5× / 38.8× / 44.3× lowest cost" ratios are also off (110.68/33.64 = 3.29×, not 44.3×).
- **Fix:** State costs as **bet-multipliers** (×33.64 / ×96.99 / ×110.68) and let the modal render `fmt(model.bonusCost(mode))` at the *current* bet (controller already does this at `slot-controller.ts:313`). Drop every hardcoded dollar figure and the bogus ratios.

**P0-4. Tier classification is NOT wired through `classifyWinTier`; the blueprint asserts it ~6 times.**
- v2 decides ceremony tier via `resolveBigWinTier(multiple)` in `view-config.ts` (ceremony-view.ts:210) and audio tier via inline `mult >= 50 ? 5 : …` (controller:553). `classifyWinTier` exists in math-core but is **unused** by v2's ceremony/audio path. The controller also derives `tierBet = Math.round(winCents/9)` (controller:666) — a **client-side computation** feeding `playCeremony`.
- The blueprint's repeated "tier RENDERs from `classifyWinTier(winX)` — math decides which tier" describes a wiring that doesn't exist, and its "THE ONE RULE" claim that no tier threshold is computed in the view is **violated by the very code it forks** (`resolveBigWinTier` + `/9` live in the view layer).
- **Fix:** Either (a) accept the existing v2 reality — tier bands live in `view-config.resolveBigWinTier`, a *render mapping* over the model's win multiple (which is fine; it's presentation), and stop claiming `classifyWinTier` drives it; or (b) actually refactor the controller/ceremony to call `classifyWinTier(winCents/betCents)` as the single source. Pick one and write it down. As-is, Part 10's ✅ ("each tier fires at the engine-classified band") is untestable because nothing calls the engine classifier.

## P1 — significant gaps / risks

**P1-1. Symbol→art mapping table has internal errors.** Engine paytable (verified): id1=1000@5, id2=750, **id3=id4=500** (tie), id5=250, **id6=150**, **id7=150**, **id8=150** (all three @5), id9=100. The blueprint's §4 table is mostly right but: (a) marks id4 "engine pay ×500/100/15" while its display row still says "AMETHYST ×10/75/250" — keep only the engine row; (b) id6/id7/id8 are a **three-way 150@5 tie**, so any "visual hierarchy id6 > id7 > id8" ordering is arbitrary and must not imply a pay difference; (c) id8 line-pay is irrelevant — id8 pays as **SCATTER** (`SCATTER_PAY {3:1.5,4:6,5:30}`, scatter pays on count, not line). The table should drop id8's "150/25/5 line" entirely to avoid a builder wiring a line-win for scatter.

**P1-2. `SCATTER_PAY` and `WILD_STRIKE` are unaccounted for.** The base game has a **WILD STRIKE** feature (`WILD_STRIKE {minWilds:3, maxMultiplier:3}`, `wildStrikeMultiplier` in spin-engine, surfaced as `SpinOutcome.wildStrike`) and a **scatter pay** (`scatterCents` in `SpinOutcome`). Neither appears in the 13 build parts. Part 6 (win presentation) and Part 7 (HUD) must render the wild-strike multiplier and the scatter pay; the README's "WILD STRIKE base feature" is real engine behavior, not flavor. **Add explicit coverage.**

**P1-3. The mobile gear "must open the menu, not settings" (C3) needs a concrete file/method, and the de-dupe may be a no-op.** The blueprint asserts the fix but doesn't cite the current handler. Verify whether the mobile gear today opens settings or the menu before writing "remove/repurpose"; otherwise Part 7's ✅ can't be checked. (The menu/settings surfaces live in `slot-view.ts`; name the method.)

**P1-4. Info/paytable page is data-driven by `info-content.ts` (`paytableRows()`), good — but the blueprint never says the v3 candy labels must come from there.** `slot-view.ts:2517` renders `paytableRows()`. If you relabel symbols to candy names only in `symbol-view`/`SYM_RES` but not in `info-content.ts`, the paytable panel shows gem/placeholder names. **Add: relabel display strings in `info-content.ts` (view-side display only — pays stay from engine PAYTABLE).** This is the one place the blueprint's "labels are candy" must touch and it's omitted from Part 3's file list.

**P1-5. Fork recipe needs an editor session — the blueprint half-acknowledges this but the Phase-0 gate is ordered wrong.** R9 + the recipe correctly note `temp/tsconfig.cocos.json` only exists after first editor open, and `tsconfig.json` extends it. But **Part 2's ✅ runs `npx tsc --noEmit`**, and Phase 0 ordering is Part1→Part2→Part3 with the editor-open buried in Part 1's prose. Make it explicit: **Part 1 ✅ requires a successful first editor open + full reimport BEFORE any `tsc` in Part 2**, else tsc fails on the missing extended config. Also: a bare `cp -r` then editor-open is viable **only if every `.meta` is copied** (blueprint says so) AND the new `package.json uuid` is set *before* first open (R8) — sequence: copy → edit uuid → open. Good, but state that tsc cannot run before the open.

**P1-6. No coverage for: LDW handling, autoplay stop-conditions, reality-check/compliance.** `compliance.ts` and `autoplay.ts` exist in `logic/`. The controller already has LDW logic (`ldw ? this.model.bet : tierBet`, controller:666-667). v3 inherits these but the blueprint's 13 parts never mention autoplay stop-rules, LDW honesty (a Stake/jurisdiction approval gate per your memory), or reality checks. **Add a part or fold into Part 8/13:** autoplay panel (count/loss-limit/single-win-limit) + LDW "win < bet shown honestly." This is an approval-floor item, not optional polish.

## P2 — accuracy nits / hygiene

- **P2-1. "13 .effect shaders" is correct** (I verified: 13 `.effect` files). But the blueprint lists effects that don't all exist by the names it uses in Parts 10/11 — `particle-glow`, `screen-post`, `grid-merge`, `unlock-burst`, `soft-burst`, `symbol-win`, `win-beam` all exist ✓; just confirm `win-fire`, `buy-plasma`, `crystal-idle`, `reel-portal`, `payline-glow`, `svarka-additive` are the others so nothing is invented. The R3 warning about `svarka-additive.effect` depthStencil is consistent with your memory and the file exists — fine.
- **P2-2. C9 says "id 8 = SCATTER (`sym_l4_j.png`)"** — correct and matches `SYMBOL_NAMES[8]='Scat'`. Good catch by the blueprint that the name string mislabels it.
- **P2-3. Autoplay accent color** — blueprint assigns violet to autoplay (theme + C5). Fine, but C5 resolves "autoplay grouped with bet controls" while the theme still keeps a `violet // autoplay control` token; ensure the grouped autoplay isn't ALSO drawn as a separate violet gem (the discarded README treatment). Minor consistency check.
- **P2-4. `BONUS_MODES_BY_VALUE` ordering** — the controller renders buy modes via `BONUS_MODES_BY_VALUE` (cost-sorted: reels, crowns, wilds). Part 11 lists them in that order ✓, but the modal must iterate `BONUS_MODES_BY_VALUE`, not a hardcoded order, or the cheapest-first layout breaks if costs change.
- **P2-5. Reduced-motion is correctly flagged** (R-list + Part 5) and `setReducedMotion`/`setReducedFx`/`setDimmed`/`winActive`/`resetHome` all exist as claimed ✓. The API-preservation premise (keep public signatures + event names) is sound; bar events use `this.events.emit(ev)` so the named-event contract is real.

## What's actually fine (no change needed)
- Fork-as-sibling strategy, token-seam (`theme.ts`→`PAL` shim), "remap ART not math," `ART_REMAP` precedent — all correct and consistent with `cocos-symbol-remap-pipeline`.
- assemble-demo claim (slugs at lines 27-28 GAMES array, no-URL-rewrite rule) — **verified accurate**.
- uuid `456ab05f-2da4-42e1-84b4-57aa7e7182b1` regenerate — **verified accurate**.
- Cocos gotchas R1–R12 are real and correctly mitigated (Array.from-not-spread, repeatForever-after-destroy, EFX2406, CLI-build-corruption, swiftshader-can't-paint-shaders, two-bars-by-orientation, :7457 lock).
- Sequencing (Phase 0 blocking → re-theme fan-out after the inline-`C{}`→`THEME` prep refactor → procedural rebuilds by disjoint surface → adversarial measure-based verification last) is well-designed; the canvas-anomaly-detector / measure-harness placement is correct.

## Required edits summary (do before building)
1. **P0-1** Quick-bet = 6 engine levels (1.00–10.00); kill the 9-preset/0.50/250/2.50 fiction.
2. **P0-2** Bought-bonus = 8 spins; scatter FS = 3/6/10 (mode always wilds). Separate the two everywhere.
3. **P0-3** Express buy costs as bet-multipliers rendered via `model.bonusCost`; remove hardcoded dollar figures and the wrong ratios.
4. **P0-4** Reconcile tier wiring: either own that `resolveBigWinTier`+`/9` are view-side render mappings (and stop crediting `classifyWinTier`), or refactor to call the engine classifier — and fix Part 10's ✅ accordingly.
5. **P1-1/P1-2** Fix §4 ties/scatter row; add explicit WILD STRIKE multiplier + scatter-pay rendering to Parts 6/7.
6. **P1-4** Add `info-content.ts` candy relabel to Part 3 (display strings only).
7. **P1-5** State that the first editor open + reimport is a hard prerequisite to any `tsc` (reorder Phase-0 gate).
8. **P1-6** Add autoplay stop-conditions + LDW honesty + reality-check coverage (approval-floor, currently absent).