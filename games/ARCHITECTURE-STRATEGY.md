# Architectural Strategy — 10 Books → Our Two Slot Engines

**Role framing:** Game Systems Architect / Senior Technical Director.
**Our engines (the "engine details" this doc is written against):**

- **`shining-pop`** — PixiJS v8, single-file casino-RGS output (`vite-plugin-singlefile`), one large authored game file + UI modules, GSAP for tweens. OOP / immediate-mode rendering.
- **`shining-pop-v2`** — Cocos Creator 3.8.8, strict **MVC** (`model/` · `view/` · `controller/`) + a pure-TS **`logic/`** layer, 11 GLSL `.effect` shaders, pooled particles, Spine.
- **Shared core:** **`@artest/math-core`** (pure TypeScript, zero engine imports) — the single source of truth for odds/RTP. Both engines consume it; it is headless-simulatable (`npm run sim`, `sim:bonus`) and unit-tested in Node.
- **Project type:** single-player, server-driven (RGS), compliance-aware **slot game**, mobile-first, dual-engine.

Each book below yields **one** foundational pattern, mapped to **(1) the core skill, (2) how it integrates into our architecture, (3) the measurable project impact.**

---

## 1. The Art of Game Design — Jesse Schell

**Core skill — The Lens (structured interrogation).** Evaluate every feature through many fixed "lenses" (player emotion, surprise, fairness) rather than gut feel.
**Integration.** Add a _design-lens pass_ to our existing `/code-review` + `/simplify` workflow: before a VFX/UX change lands, run it through 3 fixed lenses — _Does the player understand it? Does it feel fair? Is it surprising?_ This is already implicit in `ROADMAP-LEGENDARY.md`'s "north star"; make it a checklist gate.
**Impact.** Catches the exact class of bug we hit this session ("players don't understand what won") **before** code, not after. Workflow cost: minutes per PR; payoff: fewer rejected passes.

## 2. Designing Games — Tynan Sylvester

**Core skill — Engineer _experiences_, not features: events emit emotions; a few mechanics should generate many experiences.**
**Integration.** Our big-win ceremony is already an event→emotion machine (_hush → detonation → count-up climax → savour_). Formalize it as a **declarative beat timeline** (data, not code) in `view-config.ts`, so the four beats are tunable and A/B-able per engine. The 3 bonus mechanics (wilds/crowns/reels) are the "few mechanics → many experiences" principle.
**Impact.** Emotional pacing becomes a tunable artifact; designers iterate the _feel_ without touching engine code. Directly addresses "win celebration not dramatic."

## 3. Game Programming Patterns — Robert Nystrom

**Core skill — Object Pool + State + Observer (the three patterns a real-time game lives on).**
**Integration.** We already run **Object Pool** (`particle-pool.ts`), an implicit **State** machine (`FlowState = idle|spinning|resolving|bonus` in `slot-controller.ts`), and **Observer** (`EventTarget` on the bar/view). _Formalize the State machine_ (explicit transition table) to kill double-fire races (we saw a guarded "second trigger" comment), and add **Dirty Flag** to the HUD push so `syncDeliveredBar`/`setBalance` only repaint on change.
**Impact.** Zero GC in the particle hot path (already true); provably no illegal state transitions; fewer per-frame UI writes → steadier frame time on low-end mobile.

## 4. Game Engine Architecture — Jason Gregory

**Core skill — Strict layering + data-driven design + a tools pipeline.**
**Integration.** Our layering is already disciplined: **`logic/` (pure, no engine) → `model/` → `view/` (engine-coupled) → `controller/`**, with `@artest/math-core` beneath all. Enforce the invariant _"nothing below the view imports `cc`/`pixi.js`"_ with a lint rule, and treat the **RTP/bonus simulators as the tools pipeline**.
**Impact.** The logic runs headless (46/46 Node tests; `rtp-sim` ran 2M spins here), the **same math-core powers both engines** (no drift), and balance can be re-certified in CI. This is _why_ I could analyze RTP at all.

## 5. A Theory of Fun — Raph Koster

**Core skill — Fun = the brain mastering a stream of new patterns; boredom = no new pattern.**
**Integration.** Map our novelty budget: tiered ceremony (BIG→EPIC), anticipation drag, and **three genuinely distinct bonuses** each present a new pattern. The "only one bonus works / they all look the same" issue was a _novelty collapse_ — fixed by the distinct gold/pink/violet worlds + per-mechanic lock feel.
**Impact.** Session length / retention. Concrete guardrail: every tier and bonus must introduce a _discernibly different_ pattern (visual + rule), tracked in the parity matrix.

## 6. Game Feel — Steve Swink

**Core skill — Real-time control + juice: input→response under ~100ms, layered polish on every interaction.**
**Integration.** Our spin-button press physics, reel-stop elastic bounce, win-focus dim, and **dt-based tweens** are textbook Game Feel. Codify a **"feel budget"**: every control acks visually <100ms; every win stacks ≥3 juice layers (scale + light + particle + audio). Unify press-squash (0.94 + elasticOut) across _all_ controls (ROADMAP #7).
**Impact.** The whole "make it feel alive/legendary" goal _is_ Game Feel. Measurable: input-latency and "juice layer count" per event.

## 7. Level Up! — Scott Rogers

**Core skill — The Three Cs + first-minutes + thumb ergonomics (mobile).**
**Integration.** No avatar/camera, so our "Three Cs" reduce to **Controls + the read of the board ("camera")**. Apply the thumb-zone rule to the betting bar (spin = hero, in the thumb arc, ≥44px targets), animate the portrait↔landscape relayout (ROADMAP #40), and invest the first-spin warmth (#10).
**Impact.** The "mobile-first" mandate becomes concrete: fewer mis-taps, a confident first 10 seconds. Verifiable via the Playwright capture harness I stood up.

## 8. Blood, Sweat, and Pixels — Jason Schreier

**Core skill — Production reality: vertical slice, "find the fun" early, ruthless scope, iterate on the _built_ thing.**
**Integration.** This is the **workflow lesson of this very session**: tune what you can _see_. Adopt "**verify in Pixi (buildable+screenshottable) → port the recipe to Cocos**," ship in `ROADMAP` P0→P3 slices, and keep the committed review builds (`dist`, `build/web-mobile`) honest. The Cocos "invisible until rebuilt" trap is the cautionary tale.
**Impact.** Dev workflow: no more building blind; every change is a verifiable increment with before/after evidence.

## 9. Advanced Game Design: A Systems Approach — Michael Sellers

**Core skill — Games as interacting systems & feedback loops; design the _economy_, not just events.**
**Integration.** Our economy lives in `@artest/math-core` + `game-config.ts` and is _measurable_. Live findings from the simulators (this is the book applied):

- **RTP 97.5%** = base lines 73.5% + WILD STRIKE 24%; hit freq **21.8%**; observed max **756× total bet**.
- **WILD STRIKE is always ×3** (`min(wilds,3)` with `minWilds=3` never scales) → a dormant lever: raising `maxMultiplier` makes the tail scale with wild count.
- **WILD STRIKE is absent inside free spins**, and **buy-feature EV ≈96% vs base 97.5%** — a deliberate, _disclosable_ second-order asymmetry.
  **Impact.** The reward loop is provably balanced and _tunable from data_ (re-sim, re-anchor). These are system-level dials, not cosmetics — they change session variance and player trust.

## 10. Rules of Play — Salen & Zimmerman

**Core skill — Meaningful play: every action must have a _discernible_ and _integrated_ outcome; transparent rules.**
**Integration.** "Discernible outcome" is precisely the **win must READ** problem — solved with the win-line colour identity, win-focus dim, and (next) a "LINE 7 ×12" label. "Transparent rules" = the info/paytable panel sourced _from the math_ (`info-content.ts`), so the displayed rules can never drift from `math-core`.
**Impact.** Player comprehension + trust + compliance. The honest-outcome rule (never celebrate a loss; LDW-safe wording) is the _constitutive rule_ that keeps us award-eligible, not predatory.

---

## Synthesis — One cohesive strategy for both engines

A single sentence: **a strictly-layered, data-driven architecture (Gregory) whose pure economic core is balanced as a system (Sellers) and proven by a headless tools pipeline, presenting meaningful, discernible outcomes (Salen/Zimmerman) through experience-engineered beats (Sylvester) of new patterns (Koster), delivered with sub-100ms game feel (Swink) and mobile-first controls (Rogers), built on the canonical real-time patterns (Nystrom), interrogated by design lenses (Schell), and shipped in verifiable vertical slices (Schreier).**

### The five load-bearing pillars (and where they live)

1. **Pure core, layered up.** `@artest/math-core` + `logic/` know nothing of any engine → testable, simulatable, _one_ truth for both games. _(Gregory, Sellers)_
2. **Data over code.** `game-config.ts` (economy) + `view-config.ts` (feel/beats) are the only tuning surfaces; engine code stays generic. _(Sylvester, Schell)_
3. **Patterns in the hot path.** Pool · explicit State machine · Observer · Dirty Flag. _(Nystrom)_
4. **Feel + meaning at the surface.** <100ms acks, ≥3 juice layers, every outcome discernible & honest. _(Swink, Salen/Zimmerman, Rogers, Koster)_
5. **Verifiable workflow.** Pixi-verify → Cocos-port; CI runs tests + RTP/bonus sims; review builds kept in sync. _(Schreier)_

### Concrete next actions (mapped to the roadmap)

- **Formalize the FlowState machine** (explicit transitions) — both engines. _(Nystrom)_
- **Lift the 4 ceremony beats into `view-config` as a data timeline.** _(Sylvester)_
- **Lint rule: no `cc`/`pixi` import below the view layer.** _(Gregory)_
- **CI gate: `npm test` + `rtp-sim` + `bonus-sim`, fail on RTP drift.** _(Sellers)_
- **"LINE n ×m" win label + unified press-physics + thumb-zone audit.** _(Salen/Zimmerman, Swink, Rogers)_
- **Decide the disclosable economy dials:** WILD STRIKE scaling (`maxMultiplier`), strike-in-bonus, buy-EV target. _(Sellers)_

> Guiding invariant for both engines: **the pure core decides _what_ happens; the view decides _how it feels_; never mix the two.**
