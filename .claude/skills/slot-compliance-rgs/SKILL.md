---
name: slot-compliance-rgs
description: >-
  Regulatory + RGS reference for the Shining Pop slot games (PixiJS
  `shining-pop`, Cocos `shining-pop-v2`, shared `@artest/math-core`). Use when
  working on jurisdiction gating, LDW (loss-disguised-as-win) honesty, reality
  checks, autoplay limits, buy-feature gating, RTP/max-win disclosure, the
  server (RGS) handshake + error handling, deterministic seeding, or
  certification (GLI/eCOGRA, outcome books). The third leg with `slot-game-polish`
  (feel) and `slot-mechanics-animation` (mechanics): this one keeps the games
  LEGAL and HONEST. Trigger on: compliance / jurisdiction / LDW / reality check /
  autoplay / RGS / certification / RTP disclosure / responsible gaming.
---

# Slot Compliance & RGS — Regulatory Reference

What keeps these games shippable in regulated markets and honest to players.
Grounded in the real code: Cocos `assets/scripts/logic/compliance.ts`, Pixi
`COMPLY` + `rcModal`/`errModal`, and `@artest/math-core` (RTP sim + outcome
books). **Compliance is not optional polish — a violation pulls the game.**

> Golden rule (Salen & Zimmerman): **every outcome must be discernible AND
> honest.** Never dress a loss as a win.

---

## 1. Jurisdiction gating (the table)

The platform picks a jurisdiction; the game reads its rule row. _(Cocos
`JURISDICTIONS` / `getComply(code)`; Pixi `COMPLY`.)_

| Code              | Reality check (min / spins) | Autoplay max     | LDW celebration |
| ----------------- | --------------------------- | ---------------- | --------------- |
| **INT** (default) | 30 / 100                    | ∞                | allowed         |
| **UKGC**          | 30 / 100                    | 250              | **forbidden**   |
| **MGA**           | 60 / 150                    | 100              | allowed         |
| **SE**            | 60 / 100                    | **0 (disabled)** | forbidden       |
| **DE**            | 60 / 150                    | **0 (disabled)** | forbidden       |
| **US**            | 60 / 200                    | ∞                | allowed         |

Rule fields: `realityCheckMin`, `realityCheckSpins`, `autoplayMax`
(`0` = autoplay **off**, `Infinity` = uncapped), `allowLdwCelebration`. Pixi adds
`allow_buy_bonus` and `max_animation_ms`.

**Every feature must honor its gate** — no autoplay UI when `autoplayMax === 0`;
no buy-bonus when a market bans it; cap celebration length to `max_animation_ms`
so a win never blocks the next spin.

---

## 2. The non-negotiables

1. **LDW (Loss Disguised as a Win)** — a round returning **≤ 1× total bet** must
   **not** play triumphant audio/visual. _(Pixi tier-1 "RETURNED" neutral label,
   gated by `allow_ldw_celebration`; Cocos `allowLdwCelebration` + LDW-safe FS
   finale wording.)_ This is the most-audited rule. **Audit every win path.**
2. **RTP + max-win disclosure** — shown in the info/paytable panel, **sourced
   from the math** (`info-content.ts` derives from the paytable), so the
   displayed number can never drift from `math-core`. Don't hardcode it.
3. **Reality check** — after `realityCheckMin` minutes OR `realityCheckSpins`
   spins, force a calm, dismissible session summary (time / spins / net P/L).
   _(Pixi `rcModal`; Cocos `SessionStats` + the panel.)_ Never punitive.
4. **Autoplay limits** — respect the cap; offer stop-on-win / stop-on-feature /
   loss-limit; never auto-restart past the cap. Disabled markets show no UI.
5. **Buy-feature gating + friction** — only where legal (`allow_buy_bonus`);
   require a deliberate confirm; show the exact cost; never a one-tap impulse.
6. **No fake near-misses** — tension/anticipation cues fire **only on genuine
   near-states** (real 2-scatter / 4-of-5). Manufacturing them is deceptive.
7. **Honest volatility** — the game's _feel_ should telegraph its real variance.

---

## 3. RGS (Remote Game Server) handshake

The **server owns the result**; the game is _presentation only_. Flow:

```
init/auth → balance → bet request → RGS returns the outcome (grid + win + features)
  → the view PLAYS BACK that outcome → settle → next bet
```

- The client **never decides the win** — it animates what the RGS sent. (Our
  pure-core `simulate`/`spin` is for RTP sims, demo/mock mode, and parity tests
  — not the live result.)
- **Mock mode** (`mock://` RGS) drives the local/demo build deterministically.
- **Error handling** (Pixi `errModal` + RGS error routing): split codes into
  **recoverable** (e.g. `ERR_IPB` insufficient balance, `ERR_VAL`) → calm
  CLOSE + return to idle, vs **fatal** (maintenance, version) → RETRY/reload.
  Never leave the game in a stuck state on a network blip.
- **Idempotency / replay** — a re-sent bet must not double-charge; honor the
  RGS round id.

---

## 4. Certification (GLI / eCOGRA) — what auditors want

- **Deterministic, reproducible RNG** — same seed ⇒ same outcome stream (guarded
  by `rtp-regression.test.ts` + `simulate(seed)`); enables a lab to reproduce
  any round.
- **RTP proof** — Monte-Carlo over millions of spins (`pnpm --filter
@artest/math-core sim`); base + feature RTP that **sum to total** (asserted in
  `features.test.ts`); buy-feature cost anchored to RTP (`solveBuyCost`).
- **Outcome books** — `math-core` generates the Stake-style outcome book
  (enumerated weighted results) so the server can serve from a certified table.
- **Published RTP matches measured RTP** — the disclosure in-game must equal the
  certified math. _(NOTE: a live finding — the shipped `shining-pop-v2` reel
  weights sim at ~97.5% while the canonical `BRAINROCKET_CONFIG` fixture is
  ~95.57%; reconcile which is the certified target before disclosure.)_
- **Max-win reachability** — the advertised cap (e.g. 5,000×) must be genuinely
  reachable (full wild screen + WILD STRIKE) and its probability documented.
- **Economy regression guard** — `packages/math-core/test/rtp-regression.test.ts`
  fails CI if RTP/hit-freq/max-win drift out of band.

---

## 5. Where it lives (file map)

- **Rules table:** Cocos `assets/scripts/logic/compliance.ts` (`JURISDICTIONS`,
  `getComply`, `SessionStats`); Pixi `COMPLY` in `shining-pop.game.js`.
- **LDW gate:** win-tier label/audio paths in both engines.
- **Reality check / errors:** Pixi `rcModal` / `errModal`; Cocos session panel.
- **Disclosure:** `logic/info-content.ts` (derives RTP/max-win from the math).
- **Math/cert:** `@artest/math-core` (`simulate`, `solveBuyCost`, outcome books)
  - `test/{features,rtp-regression}.test.ts`.

---

## 6. Pre-ship compliance checklist

- [ ] LDW: no triumphant FX on a ≤1× return (every win path, both engines).
- [ ] Reality check fires on time/spins; copy is supportive.
- [ ] Autoplay respects the cap (and is hidden where `autoplayMax===0`).
- [ ] Buy-feature only where legal; deliberate confirm; exact cost shown.
- [ ] RTP + max-win disclosed, sourced from math, matches the certified target.
- [ ] No fake near-misses; anticipation only on genuine near-states.
- [ ] RGS errors route recoverable→idle / fatal→retry; no stuck state.
- [ ] Deterministic seed; `rtp-regression` + `features` tests green.
- [ ] Celebration length ≤ `max_animation_ms`; turbo/skip honored.
- [ ] Reduced-motion + sound-off respected and remembered.

> Pairs with: `slot-game-polish` (feel/VFX) · `slot-mechanics-animation`
> (mechanics/animation). Method unchanged: map → verify (sims/tests) → guard → commit.
