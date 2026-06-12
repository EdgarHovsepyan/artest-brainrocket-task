# @artest/stake-adapter

The Stake Engine client contract, shared by every game.

**Now:** money scaling (`toWire`/`fromWire` ×10⁶, `multiplierFromX100`), the
`RgsClient` interface, and a `MockRgs` that samples generated outcome books for
offline dev/replay — the client never recomputes payouts.

**Next (roadmap):** generalize extra-studio's single-file packager — `vite build`
→ base64 asset inliner with a **hard external-resource gate** → `front/index.html`

- `back/` (index.json + lookup CSV + books) — plus a **brand-lint** that bans
  `stake`/`pascal`/`betconstruct` tokens from shipped artifacts, and the Bet-Replay
  flow. See [docs/STAKE-CHECKLIST.md](../../docs/STAKE-CHECKLIST.md).
