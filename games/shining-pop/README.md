# Shining Pop — PixiJS

A **5-reel × 3-row, 10-payline** candy-themed video slot built with **PixiJS v8**,
**GSAP** and **TypeScript**, bundled by **Vite** into a **self-contained single-file**
frontend (`dist/index.html`) — no external resources, everything inlined.

This is the PixiJS sibling of the Cocos build in [`../shining-pop-v2`](../shining-pop-v2);
both share the same candy theme, math model and feature set, and are deployed
side-by-side from the repo root.

Author: **Edgar Hovsepyan**

---

## The game

A glossy **candy / sweet-shop** slot — gummy bears, lollipops, candy canes and
gem-drops, with a gingerbread **WILD**.

| | |
|---|---|
| **Grid** | 5 reels × 3 rows, **10 fixed paylines** (pay left→right) |
| **Base feature** | **WILD STRIKE** — wild multipliers in the base game |
| **Scatter** | pays **anywhere**; **3+** triggers free spins |
| **Free spins / Buy Bonus** | Sticky Wilds · Sticky Crowns · Wild Reels |
| **RTP** | **≈ 97.77 %** · **max win 5,000×** |

The math is locked in the shared model; the frontend renders the values it is given
and never recomputes a payout.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5173  — HMR dev server
npm run build    # dist/index.html — single-file, self-contained
npm run preview  # serve the production build
```

Append `?debug=true` to expose the in-page debug API; production console is silent.

---

## Structure

```
shining-pop/
├─ index.html                  # Vite entry (head / CSS / loader DOM + module entry)
├─ src/
│  ├─ main.ts                  # exposes npm PixiJS as window.PIXI, then loads the game
│  ├─ game/
│  │  └─ shining-pop.game.js   # the game (reels, RGS, VFX, audio, win presentation)
│  └─ ui/
│     ├─ betting-bar-web.js    # landscape / desktop bar
│     ├─ betting-bar-mobile.js # portrait bar
│     └─ betting-bar-skin.js   # shared bar drawing helpers
├─ public/assets/              # images + fonts (bundled local, no CDN)
├─ scripts/                    # build / packaging helpers
└─ vite.config.ts             # vite-plugin-singlefile (one uploadable dist/index.html)
```

---

## Notes

- **Single-file output.** `npm run build` produces one `dist/index.html` with PixiJS,
  scripts and assets inlined — drop-in deployable, no external requests.
- **Console silent** in production; all debug logging is gated behind `?debug=true`.
- **Math is locked.** RTP and payouts come from the shared model — the frontend only
  presents them.
