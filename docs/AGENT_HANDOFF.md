# ARTEST | BrainRocket — AI Agent Handoff / Knowledge Base

> Paste the **"SESSION START PROMPT"** block at the bottom into a fresh agent session.
> Everything above it is the knowledge base that prompt tells the new agent to read.

---

## 0. Mission

Job test task: ship **two award-quality Stake-Engine slot games** to top-tier, approval-ready
polish. Benchmark: Pragmatic / Hacksaw / NetEnt / BAFTA / SiGMA. The previous Stake review was
**1.00/3** (rejected: inconsistent art · low-quality/AI assets · poor bet UI · shallow gameplay) —
the job is to clear that whole bar.

## 1. User preferences (hard rules)

- **Reply in RUSSIAN.** Code / identifiers / paths / commit messages stay English.
- **Focus = the FRONTEND / visual “front part”.** Do NOT touch the math model (RTP / weights /
  books) unless explicitly asked — that is LOCKED and a different job. The exception already done:
  Cocos STICKY WILDS needed a math change → it was re-anchored via the sim (see below).
- Clean code, no dead code / no “AI trash” commits. Commit + push only real, verified work.
- Be relentless; the user wants visible progress and gets frustrated by repetition. **Always
  `git pull` / hard-refresh before judging** — many “still broken” reports were stale builds.

## 2. Repos & how to run

- **Monorepo:** `D:\projects\artest-brainrocket` (pnpm). Git remote `origin` =
  `https://github.com/EdgarHovsepyan/artest-brainrocket.git`, branch `main`.
  (Push works via Git Credential Manager; PowerShell wraps git stderr as “RemoteException” — that is
  NOT an error, check the `-> main` line.)
- **Game 1 — Shining Pop** (flagship): `games/shining-pop`, **PixiJS v8 8.18.1**, single-file Vite
  build. Dev server: `pnpm -C games/shining-pop dev` → http://localhost:5173 (add `?debug=true` to
  expose `window.__dbg`). Build: `pnpm -C games/shining-pop build`. Monolith:
  `src/game/shining-pop.game.js` (~12k lines) + `src/ui/betting-bar-web.js` +
  `src/ui/betting-bar-mobile.js` + `index.html` + `public/assets/`.
- **Game 2 — Shining Pop V2** (renamed from slot-cocos-1): `games/shining-pop-v2`, **Cocos Creator 3.8.8** — runs ONLY in the Cocos
  editor (localhost:7456), CANNOT be run/seen by the agent. TS in `assets/scripts/` (MVC:
  model/view/controller/logic). RTP sims: `npm run sim` / `npm run sim:bonus` (tsx, runnable).

## 3. The two approval gates (skills — USE THESE)

- **`stake-approval-visual-gate`** — the 100-case APPROVAL FLOOR (P0 blocker → P1 suppressor → P2
  polish), frontend-only. Already run once on Shining Pop → **20 FAILs** (7 P0 / 11 P1 / 2 P2).
- **`cocos-aaa-visual-gate`** — the 100-element CEILING above the floor (award-grade FX + WCAG).
  Run this once the floor passes.
- Other skills used: `slot-vfx-artist`, `pascal-vfx`, `high-end-visual-design`, `slot-audio-engineer`,
  `music`, `sound-effects`, `localize`, `stake-game-developer`, `ui-slot-ux-designer`,
  `casino-ui-ux-audit`, `pixijs-*`.

## 4. What is DONE (committed + pushed to origin/main)

| Commit    | What                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c346329` | gate P0: insufficient-balance dismissible notice (U8) + social-safe error popups (S2) + case-preserving pay\* swaps (S3) + payline→line & drRow socialFilter (S4)                                             |
| `d597111` | sound icon opens a crystal-magenta VOLUME slider (track+knob+mute+close X), `Sound.setVolume`, live ON/OFF icon state                                                                                         |
| `2703923` | win celebration: DELETED the electric “arcane bolts” → elegant god-rays + grounding light; `Sound.win(tier)` plays `win_<tier>.mp3`                                                                           |
| `53556dd` | shining-pop-v2 (then slot-cocos-1): true **STICKY WILDS** bonus + RTP re-anchor (sim 1M: 110.68) + view bounce                                                                                                |
| `accfe36` | ElevenLabs music masters actually PLAY (idle→main_base_loop.mp3, bonus→bonus_loop.mp3, synth fallback + post-decode swap) + ALL modals/drawers gold→**crystal-magenta** (one `SURF` token + `drawSurfChrome`) |
| `58ae4dd` | bars → vector **FillGradient** (crisp, no blur) + white-smoke type + 3-beat cinematic win ceremony                                                                                                            |

Cinematic LIGHT toolkit (`_godRays/_seedDust/_drawDust/_milledNumber/_groundGlow/_cineEntrance`)
is already defined in `shining-pop.game.js` (after `popElastic`).

## 5. What is PENDING

**In flight — a Workflow `wwta4nao3` (sp-three-tracks) was running** producing implementation-ready
edits for the user’s 3 focus tracks (check its output file under
`…\tasks\wwta4nao3.output`; re-run the gate/track workflows if stale):

1. **Sound service + music** — elegant casino overhaul (bus levels, ducking, crossfade, map every
   event to a sample; regenerate masters if needed via `scripts/gen-eleven-*.mjs`, key at
   `C:\Users\edgar\AppData\Local\Temp\el.key`).
2. **Texts / translations** — finish i18n (en + es/fr/de/pt), English fallback (no raw keys),
   remaining social leaks (S1/S5/S6), XGC/XSC currency under `social=true`.
3. **Numbers / currency dynamic + element positions + quality of every state** — N3/N4/N5 (one shared
   `fmtMoney` in the bars, 4-dp sub-cent wins), L6 (bonus-counter clamp to real bar top), U9 (lock the
   web bet carousel + dim mobile steppers during spin), L10/L11 positions, every state intentional.

**Remaining gate FAILs (frontend, do these):** P1 — L6, U9, V1/V2 (kill residual gold in HUD chrome;
candy-vs-villain identity), A5, N3/N4/N5, I6 (paytable: STAR is WILD + scatter note), S3 done.
P2 — L10 (mobile spin position), M9 (bg pan → ≤0.8% whisper-zoom).
**Also:** port the volume slider + creative icon/live-states to the **mobile** bar; MENU hub (menu
shows paytable/rules/info, not just settings); gamified loader; buy-bonus art button in the empty
space (web right / mobile left of spin).

**DEFERRED — NOT frontend code (need the user / math):**

- **T1/T2** game-tile assets: `ShiningPop-BG` (env), `ShiningPop-FG` (transparent feature/crown),
  `Provider-Logo` (transparent, legible small) — need art generation.
- **G3** `EVENT_IDS_FOR_APPROVAL.csv` (max/high/avg/min/loss per mode) — math-side deliverable.
- **V7/A1** delete other-game IP from `public/`: `assets/logo.png` (WHEEL OF CHANCE) + unused
  WHEELIE POP template dirs (verify not loaded, then remove).

## 6. Verification (CRITICAL — env limits)

See `C:\Users\edgar\.claude\projects\D--artest\memory\sp-playwright-verification.md`. Headless
Playwright + swiftshader (scripts in `C:\Users\edgar\AppData\Local\Temp\pw\`: `sp_audit.js`,
`bar_zoom.js`, `mobile_zoom.js`, `win_probe.js`, `panels_probe.js`, `vol_probe.js`; shots →
`…\Temp\sp-audit\`).

- **Verifies reliably:** bars, panels/modals, reels, currency text, console errors, boot. Inject
  `body::before{filter:none}` before any screenshot (the candy-bg blur hangs software raster).
- **Does NOT verify:** win/FS/MEGA ceremonies (swiftshader can’t render Spine; `__dbg`-from-idle
  doesn’t replicate layering; reduced-motion flips true in headless). Verify those by build + 0
  console errors + code review; the user eyeballs in a real browser.
- `page.evaluate("()=>{…}")` as a STRING does NOT call the fn → pass a real function. Bash heredocs
  mangle Windows `\\` paths → author probe scripts with the Write tool + forward-slash paths.
- Cocos: NOT verifiable by the agent (editor-only) — reason about math via `npm run sim`, the user
  verifies visuals in the editor.

## 7. Working method

- Ultracode is on → use the **Workflow** tool to fan out audits/designs (gate audit, 3-track design),
  then APPLY the returned implementation-ready edits yourself, build + verify + commit + push per
  batch. Commit subjects ≤72 chars (commitlint/husky enforces it) — detail in the body.
- The session self-paces via `/loop` + `ScheduleWakeup`; workflow completions re-invoke automatically.

---

## ⭐ SESSION START PROMPT (paste this into the new session)

> You are continuing the **ARTEST | BrainRocket** two-game Stake-Engine slot project at
> `D:\projects\artest-brainrocket`. FIRST, read the knowledge base so you are fully grounded:
> (1) `docs/AGENT_HANDOFF.md` (this file — done/pending/verification/skills/git);
> (2) the auto-memory at `C:\Users\edgar\.claude\projects\D--artest\memory\` (MEMORY.md +
> brainrocket-slot-task + artest-monorepo + cocos-mcp-fork + sp-playwright-verification);
> (3) the two gate skills `stake-approval-visual-gate` and `cocos-aaa-visual-gate`;
> (4) `git log --oneline -15` + `git status` to see what’s already shipped.
>
> Reply in **Russian**. Focus on the **frontend / visuals**; never change the math model unless I say
> so. Verify before claiming done (headless Playwright per sp-playwright-verification.md; ceremonies
> need a real browser). Commit + push to `origin/main` after each verified batch (subjects ≤72 chars).
>
> Then **ASK ME** before doing anything else:
>
> 1. Which game first — **Shining Pop** (Pixi, runnable) or **Shining Pop V2** (`games/shining-pop-v2`, Cocos, editor-only)?
> 2. Which approval target — clear the **stake-approval-visual-gate floor** (P0→P1→P2) for
>    submission, or chase the **cocos-aaa-visual-gate ceiling** (award tier)?
> 3. Re-run a **fresh gate audit** of the CURRENT build, or continue from the pending list in
>    `AGENT_HANDOFF.md §5` (3 tracks: sound/music · texts/i18n · numbers-currency-position-state +
>    the remaining P1/P2 + mobile volume slider / MENU hub / loader / buy-bonus art)?
> 4. Anything new broken since the last session I should fix first?
>
> After I answer, run the matching gate skill, produce the PASS/FAIL report, fix the FAILs by
> priority, and keep me updated in Russian.
