# Cocos MCP — Expert Workflow & Session Handoff

Everything a new session needs to drive this Cocos Creator 3.8.8 slot **headlessly**
(no computer-use), develop at expert speed, and continue where the last one left off.
Owner: **Edgar Hovsepyan**. Platform: **BrainRocket / artest** (never reference Stake/Pascal in repo).

---

## 0. TL;DR — get productive in 90 seconds

1. **Editor + MCP server.** Open the project in Cocos Creator 3.8.8. The `cocos-mcp-server`
   extension auto-starts (`settings/mcp-server.json` → `autoStart: true`) the MCP on
   **:3000**. Editor preview serves the live game on **:7456**.
2. **Connect Claude Code.** The repo's `.mcp.json` points `cocos-creator` → `http://127.0.0.1:3000/mcp`.
   `.mcp.json` is **gitignored**, so in a git worktree you must copy it in, then restart
   Claude Code so it reads it at startup (the `/mcp` slash command may be unavailable —
   restart is the reliable path). Verify tools resolve via `ToolSearch "cocos"`.
3. **Verify the link** (Bash):
   ```bash
   curl -s -m5 -X POST http://127.0.0.1:3000/mcp \
     -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
   # → serverInfo: cocos-mcp-server  ⇒ good
   ```
4. **Probe the scene:** `scene_get_current_scene`, `scene_get_scene_hierarchy`. The scene is
   nearly empty (`Canvas → Camera`) — the game is **code-driven**: `SlotGame.ts` builds
   everything at Play. See [[cocos-mcp-connect]] for the connect gotcha.

---

## 1. The headless dev loop (no computer-use, fully verifiable)

```
edit assets/scripts/*.ts
  → mcp__cocos-creator__project_refresh_assets  (folder: db://assets/scripts)   # editor recompiles TS
  → sleep ~5s
  → chrome-devtools MCP: navigate_page {type:reload, ignoreCache:true} on http://localhost:7456
  → sleep ~6s for WebGL boot
  → take_screenshot            # SEE it
  → list_console_messages {types:[error,warn]}    # 0 errors gate
  → evaluate_script(...)       # DEFINITIVE state dumps (positions, scales, model values)
```

**Why chrome-devtools and not Claude_Preview for :7456** — the Cocos preview owns port 7456;
`Claude_Preview.preview_start` refuses a port it didn't launch. `chrome-devtools-mcp` opens
its own Chrome, so it can hit `localhost:7456` with no conflict. (Claude*Preview is fine for
serving a \_static build dir* on a fresh port.)

**Reach into the running game** via `evaluate_script` — the engine global is `window.cc`:

```js
const comp = cc.director.getScene().getChildByName('Canvas').getComponent('SlotGame');
// comp.model.balance/bet, comp.strips[r].position.y, comp.winLinesData, comp.busy, etc.
comp.onSpin(); // drive a spin
comp.changeBet(100); // step bet
comp.showWinLines({ lineWins: [{ lineIndex: 3, symbol: 1, count: 5, payout: 50 }] }); // force a payline render
```

This is how every feature this session was verified (reel motion sampled over time, dim
states, win-line render, anticipation drag, shard counts) — **prefer eval state dumps over
eyeballing screenshots**; screenshots catch fast VFX only by luck of timing.

**Design resolution:** 1280×720, `FixedWidth` policy → visible Y ∈ [−360, +360]. Anything
beyond is off-screen. `SlotGame.fit()` contain-scales the whole node to a 760×744 envelope and
re-fits on `view.setResizeCallback` → responsive on any aspect ratio.

---

## 2. Asset pipeline (ImageMagick, corner-floodfill)

- **Sources:** `assets/atlas-sources/*.jpeg` (A UI 5×5 / B symbols / C overlays 3×4 / D win 3×5).
  Map: `assets/atlas-sources/README.md` + `docs/design-system.md`.
- **Slice → `assets/resources/<group>/<name>.png`**, loaded at runtime by
  `resources.load('<group>/<name>/spriteFrame')`.
- **Background removal = CORNER FLOODFILL**, never `-transparent black` (buttons have black
  interiors — plain transparency hollows them). Pattern:
  `-alpha set -fuzz 16% -fill none -draw 'alpha x,y floodfill'` from the 4 corners, then `-trim`.
- **Label bleed:** atlas cells stack `[prev-row label ~0–50px][BUTTON ~65–350px][own label ~360–410px]`.
  Crop a per-row vertical band to drop both label strips (row 0 has no top bleed). See
  `tools/slice-ui2.sh` (the corrected Atlas-A slicer; produced full, uncropped buttons).
- **Reimport without breaking preview:** overwrite the PNG **in place** (keep `<png>.meta` —
  deleting `.meta` breaks the bundle → infinite splash), then
  `project_refresh_assets db://assets/resources/<group>` and reload :7456.
- Offline QA: `magick ( a b +append ) ... PNG32:/tmp/x.png` then `magick /tmp/x.png +repage
-background magenta -flatten out.png` (note: `-extent` bakes a page geometry → `+repage`
  before any later `-flatten`, or it collapses).

---

## 3. Math — STATE & TOOLS (authoritative)

**Sign-off-grade (20M spins, WILD STRIKE applied):**
| Metric | Value | Target |
| --- | --- | --- |
| Game RTP | **94.27 %** | 96 % (95.5–96.5) — UNDER |
| base lines / wild-strike | 62.95 % / **31.32 %** | — |
| WILD STRIKE trigger | 2.5 % of spins | — |
| Hit freq | **5.64 %** | 25–35 % — WAY under |
| Max win | 3000× bet | — |

**Key insight:** ~⅓ of all RTP is delivered by a 2.5%-rare wild-strike tail → extreme
volatility + dead base game = the real root of the "boring after 1-2 spins" review note.
RTP does **not** converge below ~20M spins because of that tail.

**Tools** (`tools/`, run with `npx tsx`):

- `rtp-sim.ts [spins]` — Monte-Carlo. **FIXED this session** — it previously omitted WILD STRIKE
  and reported 62% (base) instead of the true ~94% (game). Now prints base + wild-strike + hit + WS-rate.
- `rtp-check.ts [spins]` — base-vs-wild-strike probe for current weights.
- `tune-rtp2.ts` — 2-axis (lows for hit-freq, highs/wild for RTP) weight search.
- `tune-rtp.ts` — original wild/payscale/maxmult sweep.

**Rebalance plan (chosen volatility: MEDIUM — hit ~28%, max ~500–800×):** lower low-symbol
3-of-a-kind payouts in `PAYTABLE` (so frequent low wins fit the RTP budget), raise low
`REEL_WEIGHTS` for hit-freq, de-concentrate the wild-strike tail (`WILD_STRIKE.maxMultiplier`/
wild count), land 96%; sign off at 20M. All math is data-driven in
`assets/scripts/logic/game-config.ts` — never edit engine code to tune.

**Bonus design (to build):** add a Scatter symbol → 3/4/5 = 8/12/20 Free Spins; Sticky Wilds
lock during FS; Mega = guaranteed sticky + 2×→10× multiplier ladder. EV split base ~68% +
feature ~28% = 96%; buy-cost = mean feature payout ÷ RTP anchor (`tools/bonus-sim.ts`).
Existing buy-feature modes live in `BONUS_MODES` + `logic/bonus-engine.ts`.

---

## 4. Architecture (code-driven runtime)

`assets/scripts/`

- `SlotGame.ts` — VIEW + bootstrap. Builds the whole scene at Play: procedural stage
  background (`buildBackground`), reels as per-reel scrolling **strips under a `Mask`**
  (`animateSpin` = real spin: stagger + accel/decel + bounce + `pulseReel` thunk +
  `spawnAnticGlow` anticipation), readout plate + grouped bet pill (`mkPlate`/`mkReadout`/
  `mkGlyphButton`), win paylines (`showWinLines`/`drawWinLine`/`cycleWinLine`) + `winBurst`
  shards, win overlay, responsive `fit()`, dev cheats.
- `model/slot-model.ts` — balance/bet, `play()` (applies WILD STRIKE), `buyBonus()`.
- `logic/` — engine-free pure math (sim-testable): `game-config.ts` (SYMBOLS, PAYTABLE,
  PAYLINES, REEL_WEIGHTS, WILD_STRIKE, SETTINGS), `spin-engine.ts`, `bonus-engine.ts`, `rng.ts`.
- `view/view-config.ts` — DATA-DRIVEN timings/tunables (spin stagger, bounce, win tiers).

**Dev cheats** (`setupCheats`): `W` MEGA · `E` EPIC · `B` feature splash · `M` +money · `Space` spin.

---

## 5. Done this session ✅ / Pending ⏳

✅ Premium **bet UI** (grouped pill, depth, state determinism, procedural ± glyphs) ·
**real reel spin** (strips+mask+stagger+bounce+thunk) · **responsive** contain-fit ·
**stage background** (acid glow + gradient + hatch + breathing + reel separators) ·
**win paylines** (acid polylines, cycling) + **win-burst** + **anticipation** ·
**cropped UI assets re-sliced** (full buttons) · **rtp-sim fixed** + true math measured.

⏳ Math rebalance to 96%/medium-vol/28%-hit (chip `task_7e74dc9f`) · **AAA win-popups**
(tiered WIN→BIG→MEGA→EPIC, kinetic count-up — frontend-design + slot-vfx-artist +
ui-slot-ux-designer + glsl-casino-effects) · **free-spins bonus** impl · review #1
art-style consistency · #2 asset uniqueness · final Build→Web.

> Build note: `project_build_project` only _opens_ the build panel (needs a manual Build
> click). For a static deliverable, click Build; the live :7456 preview already reflects source.

---

## 6. Conventions (hard rules)

- Author **Edgar Hovsepyan**; **no `Co-Authored-By: Claude`** / AI trailers; clean typed
  **Conventional Commits** (types incl. `math vfx audio ux`); run lint/format before commit.
- **Never** reference Stake Engine / Pascal Gaming in repo or docs. Platform = BrainRocket/artest.
- ESLint + Prettier: `npm run lint`, `npm run format`. Sim: `npm run sim`.

See also memory: [[cocos-mcp-connect]] · [[cocos-asset-pipeline]] · [[review-feedback-round1]] ·
[[free-visual-preview-workflow]] · [[project-slot-game]].
