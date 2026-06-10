# Session Handoff — ARTEST | BrainRocket slot studio

> **Read this first.** It is the single onboarding doc. Pair it with
> [COCOS-PARITY-PLAN.md](COCOS-PARITY-PLAN.md) (the case ledger) and the
> per-game [games/shining-pop/CLAUDE.md](../games/shining-pop/CLAUDE.md).

## 0. The mission in one line

Two slot games, one shared math core: **shining-pop** (PixiJS v8, the flagship)
and **shining-pop-v2** (Cocos Creator 3.8.8, a strict parity port of the
flagship). Goal: bring v2 to full feature/visual parity with the flagship and
ship both production-ready. Frontend/visual focus — the math is locked.

## 1. Current state (2026-06-11)

- **shining-pop (Pixi)** — flagship, submission-ready, ~97% RTP. Lives on a
  single ~12k-line file `src/game/shining-pop.game.js` + `index.html` + Vite.
- **shining-pop-v2 (Cocos)** — **~90% flagship parity**. Clean MVC: pure
  `logic/` (unit-tested, no engine imports), `model/`, engine-only `view/`,
  one `SlotController` composition root. 44 node:test cases green.
- Everything is committed and pushed to `origin/main`. The working tree may
  hold the OTHER session's in-flight work — always check `git status` per game.

## 2. What is DONE in v2 (don't rebuild these)

Spin loop + quick-stop · server-authoritative money · WILD STRIKE · 3 buy-bonus
modes · **premium 3-tier buy modal** (BuyBonusModal.ts) with inline bet stepper
· autoplay (stop-on-feature/big-win, 9 tests) · tri-state turbo · quick-bet
ladder · settings · game-info (rules/paytable/RTP) · menu hub · **web bar**
(account/banners/swipe carousel/×2/turbo/auto/spin ring) + **mobile bar** with
orientation swap · **cinematic boot loader** (real bg+logo+rays, milestone
progress) · tap-to-play intro · **god-ray win ceremony** (continuous intensity)
· **wave-blink + sheen + sparkle symbol VFX** (gated to focused wins) ·
wild-land/sticky-lock · velocity motion blur · particle bursts · **37-clip
audio** (4-bus dB mix, sample-first+synth fallback, candy reel loop) · **Reality
Check** + jurisdiction COMPLY table · **production QA hardening** (lifecycle:
tab-visibility audio suspend + tick freeze, debounced resize, online/offline
modal, safe-decimal money formatter w/ 8 currencies, iPhone safe-area/dvh) ·
free-spin HUD + per-mode bonus atmosphere · brand fonts (Fredoka/Luckiest Guy
TTF) · candy symbols/logo/bg art (black-keyed from the flagship).

## 3. What is LEFT (pick from here — see parity plan for detail)

| Item                               | Effort | Notes                               |
| ---------------------------------- | ------ | ----------------------------------- |
| Per-cell candy reel borders        | M      | the last 🔶 on the board chrome     |
| Scrollable panel bodies            | M      | mask+drag for long content          |
| Bet Replay + stateless resume      | M+M    | needs the RGS adapter               |
| Natural scatter free-spins trigger | L      | math model extension                |
| Spine crown in MEGA ceremony       | L      | cc.Spine port + crownwild atlas     |
| i18n + RTL                         | L      | the last big parity item            |
| 7-preset responsive QA sweep       | M      | now that safe-area + debounce exist |

## 4. The build / QA loop (THE core workflow)

```bash
# 1. edit v2 source under games/shining-pop-v2/assets/scripts/
# 2. logic-test + typecheck (fast, headless)
cd games/shining-pop-v2 && npm test          # node:test, must stay green
npx tsc --noEmit                             # ignore engine .d.ts noise; grep your files
# 3. headless Cocos build (NO editor needed) — exit code 36 == SUCCESS (Cocos quirk)
#    FIRST kill anything on :7457 or the build EPERMs on the locked output dir
& 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe' --project <abs path> --build 'platform=web-mobile;debug=false'
# 4. serve + drive in the preview tool (port 7457)
```

**Cocos headless QA recipe** (the boot is flaky — be patient):
`preview_start` → `preview_resize` to a real size BEFORE boot → reload →
wait ~10s for the scene → drive with **synthetic PointerEvents** on the canvas
(Cocos ignores synthetic TouchEvents) → `preview_screenshot`. The game boots
reliably when the preview PANE is visible to the user.

**Debug remote control**: load with `?debug=1`, then `window.__v2` exposes
`spin()`, `ceremony(mult,wild)`, `feature(name)`, `buy(mode)` — fire bonuses /
ceremonies headlessly without playing for the trigger. (Master parity: Pixi has
`window.__dbg` + `window.__buyModal`.)

## 5. Hard-won gotchas (these WILL bite you)

- **commitlint is strict.** Subject must be lowercase (no "AAA", no "Reality
  Check" — caps fail subject-case). Body lines ≤100 chars. Write commit
  messages to a BOM-FREE file (`[IO.File]::WriteAllText(path, text,
[Text.UTF8Encoding]::new($false))`) — PowerShell `Set-Content -utf8` adds a
  BOM that fails header-trim. Inline `git commit -m "…"` with embedded quotes
  breaks PowerShell arg-parsing; always use `-F <file>`.
- **Parallel sessions.** Two Claude sessions edit this repo at once. ALWAYS
  `git pull --rebase --autostash origin main` before pushing. Commit only files
  you verified; the autostash dance can leave your edits uncommitted (re-check
  `git status` after). Files keep "modified since read" — re-Read before Edit.
- **Cocos build EPERM.** A running server on :7457 locks `build/web-mobile`.
  Kill it (and stray `CocosCreator.exe`) before every build. "Finished in 66ms"
  = it didn't actually build (locked).
- **mkNode must inherit `parent.layer`.** Nodes built after the boot relayer on
  the DEFAULT layer are skipped by the 2D renderer → invisible UI. Every lazy/
  rebuilt panel uses `n.layer = parent.layer`.
- **Win-VFX white-out.** Per-cell white sheen/sparkle STACK their alpha; a full
  wild reel (20+ winning cells) washed the board white. Rich in-cell VFX is now
  gated to focused wins (≤8 cells) in `slot-view.showWins`. Keep that gate.
- **Sprite with no spriteFrame renders WHITE** in Cocos. Proc/guard null art.
- **Money:** never recompute in a view. Render what the model supplies; format
  with `logic/money.ts` (`formatMoney`) — kills float drift + scientific
  notation, handles per-currency prefix/suffix/decimals.

## 6. The Pixi asset move (just landed — context for the other session)

The flagship art was relocated `public/assets/images/shining/` → flat
`public/assets/images/`. The loader `SH` prefix (game.js ~1011) + index.html bg
url were repointed; `button.jpg`/`extra-studio.jpg` were retired (gem base uses
the blank canvas; extraStudio is a safe blank). Verified: loader clears, zero
console errors, all art renders. The Buy-Bonus FAB now docks in the empty side-
margin (anchors to the live `_gridRect`, not a fixed W-fraction).

## 7. Skills to pull (local, high-leverage)

`slot-vfx-artist` (win-celebration layer stack, no-circles/interruptible rules —
USED for the symbol VFX) · `cocos-aaa-visual-gate` (100-element award audit, run
against a build for a punch-list) · `casino-ui-ux-audit` (30-point bar/HUD) ·
`stake-approval-visual-gate` (approval floor) · `pascal-vfx`, `web-animations`,
`event-animation-designer`.

## 8. How to win this in one session

1. Read this + the parity plan. Pick ONE M-effort item (per-cell reel borders or
   scrollable panels are cleanest).
2. Edit pure logic first if any → unit-test → wire the view → build → QA-loop.
3. Verify on screen (or via `__v2` debug). Don't claim done without it.
4. `pull --rebase --autostash` → commit (BOM-free file, lowercase subject) →
   push. Update the parity plan row.
5. Repeat. Keep 44+ tests green and the console silent.
