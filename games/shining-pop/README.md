# SHINING POP — Studio (Vite · PixiJS v8 · Spine-ready)

A modern **Vite + TypeScript** build of SHINING POP — the Stake-Engine slot — set up so we can use real npm packages (**PixiJS v8**, **`@esotericsoftware/spine-pixi-v8`**, **GSAP**) and a proper module workflow, while still shipping a **self-contained single-file frontend** that satisfies Stake's "no external resources" rule.

> The original, **approved** game lives untouched at `../stake-front-factory/shining-crown-pixi.html` (single-file, no-build). This studio repo is the **parallel, Spine-capable** workspace where new cinematic visuals are built — then folded back as a v2.

---

## Why this exists

The approved game is one 10k-line `.html` with no bundler — which is exactly what got it approved, but it **can't load npm Spine rigs or modern tooling**. This repo unlocks that:

- **Spine 2D** cinematic symbols (fire bursts, explosive wins) — see `docs/blueprints/10_SHINING_POP_SPINE_SYMBOL_BLUEPRINT.md`.
- **GSAP** timelines, **TypeScript**, HMR, a real module graph.
- **`vite-plugin-singlefile`** so `npm run build` still produces **one** uploadable `dist/index.html` (Stake-compatible).

## Migration approach — *wrapper-first*

The 10k-line game is ported **verbatim** (zero logic changes) so it runs day one, then we modularize incrementally:

1. `scripts/port-from-singlefile.mjs` splits the approved `.html` into:
   - `index.html` — head + `<style>` + loader DOM + a module entry (the bundled-pixi `<script>` removed).
   - `src/game/shining-pop.game.js` — the game's async-IIFE body, **unmodified**.
2. `src/main.ts` re-exposes the npm PixiJS as the global `window.PIXI` the game expects, then `await import()`s the game module.
3. From here we peel systems (reels, RGS, VFX, audio, UI) out of `game.js` into typed modules — **without ever breaking the running game**.

Re-sync any time the approved game changes:

```bash
npm run port   # re-splits ../stake-front-factory/shining-crown-pixi.html
```

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173  — HMR dev server
npm run build    # dist/index.html — single-file, Stake-ready
npm run preview  # serve the production build
```

## Structure

```
shining-pop-studio/
├─ index.html                     # Vite entry (game head/CSS/loader DOM + module entry)
├─ src/
│  ├─ main.ts                     # PIXI global shim → dynamic-imports the game
│  ├─ game/
│  │  └─ shining-pop.game.js      # ported game body (verbatim; modularize from here)
│  └─ spine/                      # ✅ Spine cinematic-symbol runtime — built, awaiting a rig
│     ├─ SymbolRig.ts             #    controller: skin swap, idle/dump/win, centering, event→audio
│     ├─ SymbolRigPool.ts         #    load-once / instance-many / unload-once owner
│     └─ index.ts                 #    barrel export
├─ public/
│  ├─ assets/                     # images + fonts (served at /assets, bundled local)
│  └─ spine/                      # drop master.skel/.atlas/.png here to activate Spine (see its README)
├─ scripts/
│  └─ port-from-singlefile.mjs    # re-sync from the approved single-file game
├─ docs/                          # knowledge base (copied from the approved repo)
│  ├─ ARCHITECTURE.md
│  ├─ STAKE_CONSTRAINTS_CLAUDE.md # the hard Stake rules — READ before shipping
│  ├─ MATH_SUMMARY.txt            # RTP / max-win / mode costs (math is LOCKED)
│  └─ blueprints/                 # incl. 10_…_SPINE_SYMBOL_BLUEPRINT.md
├─ vite.config.ts                 # vite-plugin-singlefile for the Stake build
└─ tsconfig.json
```

## Stake compliance — non-negotiables (see `docs/STAKE_CONSTRAINTS_CLAUDE.md`)

- **No external resources.** Everything bundles locally (PixiJS via npm → inlined by the singlefile build; assets under `/public`). No CDNs.
- **Console must be silent** in production — gate every `console.*` behind `?debug=true`.
- **Math is locked.** RTP 96.0%, max win 5,000×, the 4 modes + costs in `docs/MATH_SUMMARY.txt`. Do not recompute payouts on the frontend.
- The single-file build output is what gets uploaded to ACP → Import Files → Front End.

## Roadmap

1. ✅ **Wrapper-first Vite migration** — game runs under Vite + npm (this repo).
2. **Modularize** — extract reels / RGS / VFX / audio / UI into typed `src/` modules (apply `frontend-design` + `high-end-visual-design` for any new DOM shell).
3. **Spine cinematic symbols** — ✅ **controller built** (`src/spine/SymbolRig.ts` + `SymbolRigPool.ts`, type-checked against `@esotericsoftware/spine-pixi-v8` 4.3.5): Master-Skeleton skin swap, idle/dump/win state machine, skeleton-local centering, frame-exact audio via Spine events. **Remaining:** drop a rig (`master.skel/.atlas/.png`) into `public/spine/` and wire `pool.acquire(...)` into the reel cells — nothing animates until the rig (an art deliverable) exists. See `public/spine/README.md`. This is the ★★★ lever.
4. **v2 submission** — single-file build, console silent, Spine atlases under the size cap.

---

*Original approved build: `arthur-ananyan/stake-front-factory` · this studio repo is a parallel workspace, not the shipped artifact.*
