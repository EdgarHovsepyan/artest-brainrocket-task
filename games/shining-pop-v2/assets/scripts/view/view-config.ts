// DATA-DRIVEN visual / animation config for the Cocos view layer.
// ZERO HARDCODING: every size, timing and gain lives here and is read by the
// view components. Designers tune this file, never the component code.

export const VIEW_CONFIG = {
  /** Master shader kill-switch — when false, every consumer skips customMaterial
   *  and uses its Graphics fallback (low-end devices, shader-regression debugging).
   *  Each FX *also* honors `reducedFx`. Set false to prove the game still reads. */
  vfx: { materialsEnabled: true },

  /** Board layout (px). The view builds the whole scene from these numbers. */
  layout: {
    /** Square symbol cell size. */
    cell: 96,
    /** Symbol art fill fraction of the cell. Bumped 0.92→0.99 (2026-06-12) so
     *  symbols fill nearly the whole cell — kills the big vertical gap the user
     *  saw between rows (symbols read bigger + more compact). */
    symbolFill: 0.99,
    /** Gap between cells (and between reels). Tightened 8→5 for a more compact
     *  reel (less dead space between symbols vertically + horizontally). */
    gap: 5,
    /** Vertical centre of the reel block, relative to the canvas centre. */
    reelCenterY: 90,
    /** Logical design envelope used for the responsive contain-fit. */
    designWidth: 760,
    designHeight: 760,
    /** Extra symbols stacked above the window so a reel can really scroll. */
    spinBuffer: 12,

    // ── Task 1.1: viewport cover + boot mask ────────────────────────────────
    /** Magic offsets promoted out of fit(): bezel headroom + bottom breathing.
     *  contentTopPx tightened 410→372 (2026-06-11) so the content band is
     *  shorter → the reels scale UP to fill more of the screen (user: "reels
     *  need bigger"). The logo moves to the top-left shoulder in landscape so
     *  it no longer needs the tall centre headroom. */
    contentTopPx: 372,
    /** Landscape frame crown above the reels (the logo lives screen-relative
     *  there, outside this band) — tight so the reels fill the height. */
    landscapeTopPadPx: 28,
    boardBottomGapPx: 22,
    /** bg base-fill + bg_art scaled by this factor so the painted bg always
     *  bleeds past 16:9, 21:9, 9:16, 9:21 — kills the #0a0610 letterbox band
     *  without touching the engine cover. */
    bgCoverOverscan: 1.15,

    // ── Task 1.2: reels re-center + edge feather ────────────────────────────
    /** Stacked-alpha dark feather over top/bottom of the GRAPHICS_RECT mask
     *  so symbols dissolve into the bezel instead of snapping at the mask edge. */
    windowFeatherPx: 18,

    // ── Task 7.1: reels >=90% width portrait ────────────────────────────────
    /** Portrait width fill ratio for fit(). Bumped 0.92→0.96 (2026-06-11) so the
     *  reels are bigger and sit closer to the bar — reduces the empty band the
     *  user saw between the reels and the betting controls in portrait. */
    portraitWidthFill: 0.99,
    landscapeWidthFill: 1.0,

    // ── Task 1.3: logo top-left + Buy-FAB collision guard ───────────────────
    /** Buy-FAB geometry + collision clamp. fabDockX(sign) docks at
     *  sign*(frameHalfW + gapPx + size/2); clamps inner edge >= frameHalfW +
     *  minClearancePx and outer edge <= screenHalfW/scale - edgePadPx. */
    fab: {
      sizePx: 100,
      gapPx: 14,
      minClearancePx: 14,
      edgePadPx: 12,
      /** 2026-06-11 — match the PixiJS reference: the BUY BONUS badge sits on
       *  the LEFT of the reels in landscape (dockSign -1), and in the bottom-
       *  left deck in portrait (screen-relative fraction + a portrait scale so
       *  it isn't blown up by the big portrait board scale). */
      landscapeDockSign: -1,
      /** 0.12 clipped the badge's left edge on narrow phones — 0.16 clears it. */
      portraitScreenX: 0.16,
      portraitScreenY: 0.2,
      /** Portrait badge width in CANVAS px — explicit because the FAB lives on
       *  the canvas root (above the bar), where board-relative scales don't
       *  apply. ~140 balances the spin ring; half the old oversized badge. */
      portraitWidthPx: 140,
      /** Portrait dock: fraction of the control band's height (bottomInset) the
       *  badge centre sits at — 0.6 ≈ level with the spin button, left side. */
      portraitBandFrac: 0.6,
      /** Landscape shrink — the badge dominated the web layout at full size. */
      landscapeScale: 0.78,
    },
    /** Logo placement. 2026-06-11 — landscape logo is now SCREEN-RELATIVE
     *  (responsive): its centre lands at screen-fraction (landscapeScreenX,
     *  landscapeScreenY) measured from bottom-left = (0,0), top-right = (1,1).
     *  So x≈0.18 = left ~18% (left edge near 5%), y≈0.88 = top ~12% (top edge
     *  near 1%) for the wide logo. In BONUS the logo slides to the reels-left,
     *  vertically-centred (bonusScreenX/Y). fit() inverse-transforms these
     *  through the board scale so they hold at any viewport. */
    logo: {
      topY: 322,
      /** 0.66 dominated the web layout — 0.52 reads brand-present, not loud. */
      landscapeScale: 0.52,
      landscapeScreenX: 0.18,
      landscapeScreenY: 0.88,
      bonusScreenX: 0.12,
      bonusScreenY: 0.5,
    },
  },

  /** Reel spin animation — synced to shining-pop feel (ms). */
  spin: {
    /** Minimum spin time before the first reel stops (ms). shining baseDur OFF≈440. */
    minSpinMs: 440,
    /** Stagger between consecutive reel stops (ms). Left-to-right. shining OFF≈88. */
    reelStopStaggerMs: 88,
    /** Trapezoidal velocity-curve accel/decel fractions. shining a=0.10 / d=0.34. */
    accelFraction: 0.1,
    decelFraction: 0.34,
    /** Squash applied to a reel's symbols on landing (the "thunk"). */
    landSquash: 0.9,
    /** Anticipatory wind-up kick before launch (OFF mode only). The launch
     *  anticipation is now POSITION-ONLY (a small up-kick before the down
     *  launch) — windupSquash 1.0 disables the Y-scale entirely so NO vertical
     *  scaling ever touches the symbols (user-rejected all vertical effects). */
    windupMs: 120,
    windupAmpFrac: 0.85, // × CELL × 0.15 multiplier in reel-view.spinTo()
    windupSquash: 1.0, // 1.0 = no Y squash (position kick carries the wind-up)
    /** Velocity-coupled vertical motion-blur streak. DISABLED 2026-06-11:
     *  `enabled:false` kills the strip Y-stretch entirely. ANY vertical
     *  stretch on the symbols during the spin read as "vertical arrows /
     *  lines" (user-rejected, repeatedly). The reel reads fast from the
     *  scroll speed alone — it does NOT need a stretch cue. Do not re-enable
     *  without a fundamentally different (non-stretch) speed treatment. */
    blur: {
      enabled: false,
      triggerSpd: 0.12, // cells/frame before blur engages
      span: 0.25, // (spd-trigger)/span → 0..1
      strengthYFrac: 0.03, // × CELL — inert while enabled:false
      strengthXFrac: 0.012, // × CELL
      rampInDecay: 0.5,
      rampOutDecay: 0.18,
    },
    /** Click-to-stop / force-stop cascade. */
    quickStop: {
      staggerMs: 8,
      minMs: 55,
      maxMs: 100,
    },

    // ── Task 6.1: pre-spin interpolation mask (already glitch-free; named) ──
    /** Window of frames after spinTo() during which the cell sprite must NOT
     *  flip to the result frame (pendingFinal + 'launching' blur gate). Was a
     *  hardcoded 50ms in reel-view; promoted so QA can extend if a snap shows. */
    preSpinMaskMs: 50,
    /** Optional cross-fade target for window cells during the mask window.
     *  255 = no fade (current behavior); lower = brief dim → settle. */
    preSpinFadeToAlpha: 255,

    // ── Task 4.2: reel portal warp + grid merge ────────────────────────────
    /** Portal glow at spin entry (launch) + exit (settle). DISABLED 2026-06-11:
     *  the magenta sprite bands docked at reel top/bottom read as "arrow lines
     *  on the symbols" (user-rejected). `enabled:false` skips both the build and
     *  the fire so they never render. Re-enable only with a redesigned look that
     *  doesn't dock a hard band across the reel edges. */
    portal: {
      enabled: false,
      entryMs: 180,
      exitMs: 220,
      warpAmp: 6,
      fringeColor: '#ff5ab0',
    },

    // ── Task 6.2: elastic over-travel bounce (THE missing feel piece) ──────
    /** Split-stop physics. Strip overshoots by overtravelFrac * CELL * elasticity,
     *  then settles to 0 with `easing` over bounceMs * weight. `settle()` fires
     *  on the SECOND segment's .call so the squash coincides with rest. Designers
     *  tune weight/elasticity/speed live; reducedMotion disables the bounce. */
    bounce: {
      overtravelFrac: 0.1,
      bounceMs: 260,
      easing: 'elasticOut',
      weight: 1,
      speed: 1,
      elasticity: 1,
    },
  },

  /** Winning-line presentation. */
  win: {
    /** Pulse scale applied to winning symbols. */
    symbolPulseScale: 1.18,
    symbolPulseMs: 420,
    /** JUICY JELLY — after the initial attack pop, winning symbols settle into a
     *  CONTINUOUS squash-and-stretch wobble (wide-and-short ↔ narrow-and-tall)
     *  until the next spin clears them — the modern candy-slot "yummy" feel, not
     *  a uniform scale pulse. jelly = axis amplitude; ms = one full wobble cycle.
     *  The shader rim/sweep shine loops alongside (SlotView's u_time). */
    winBounceLoop: { enabled: true, jelly: 0.085, ms: 520 },
    /** WIN FOCUS — non-winning symbols dim back to this opacity while a win is
     *  presented, so winners read instantly (standard top-provider treatment).
     *  255 disables the dim. */
    loserDimOpacity: 115,
    /** Seconds each winning line stays highlighted before cycling to the next. */
    lineCycleSeconds: 0.85,
    /** 2026-06-11 FIRE redesign — `showLines:false` removes the drawn payline
     *  geometry ENTIRELY (the magenta polyline + glow segments + plasma core +
     *  line-riding sparks, all user-rejected as "magenta geometry"). The win is
     *  now read from the SYMBOLS: a warm fire glow behind each winning symbol +
     *  rising fire embers. No lines, no diamonds. */
    showLines: false,
    /** Fire-ember burst from winning cells (replaces the line). count = embers
     *  per winning cell; warm orange→gold, rise + fade. Bumped 6→9 so even a
     *  small win reads clearly (the embers + symbol glow are the only win cue
     *  now that lines are gone). */
    fireEmbers: { perCell: 12, riseSpeed: 180, lifeMs: 820, spreadPx: 46 },

    /** The OLD rectangular win-fire flame QUADS behind winning cells read as a
     *  "fire background box" (user-rejected). Fire is now painted PER-SYMBOL,
     *  clipped to each symbol's own silhouette, by symbol-win.effect. Keep these
     *  background quads OFF. */
    fireFlames: { enabled: false },

    /** CINEMA WAVE — win-line ENERGY BEAMS (win-beam.effect): an additive flowing
     *  ember/gold plasma ribbon stretched between consecutive winning-cell
     *  centres. This is the shader "win line" — no drawn stroke, no magenta
     *  geometry. heightPx = ribbon thickness; maxSegments = pooled sprites;
     *  fadeInMs/holdOpacity = reveal envelope. */
    beams: { enabled: true, heightPx: 52, maxSegments: 16, fadeInMs: 180, holdOpacity: 225 },

    /** CINEMA WAVE — soft-burst.effect replaces the 10-layer Graphics radial glow
     *  behind winners (it BANDED into visible concentric circles — rejected).
     *  Shader = continuous falloff + rotating god-rays + candle flicker. The
     *  Graphics glow remains the fallback when the material is unavailable. */
    burst: { enabled: true, intensity: 1.15, scale: 1.9 },

    // ── CINEMA WAVE: shader winning-symbol highlight (symbol-win.effect) ─────
    /** Award-tier ON-symbol highlight: an additive overlay that reads the
     *  symbol's own alpha and paints an animated warm rim-light + a diagonal
     *  specular sweep (shape-accurate, geometry-free). `enabled` gates the
     *  whole layer; a null material or reducedFx falls back to the Graphics
     *  sheen/sparkle. intensity = overall strength; rimWidth = uv tap offset
     *  for the 4-tap edge band; sweepSpeed = specular rake speed; envInMs/
     *  envHoldOpacity = the per-symbol fade-in + sustained opacity envelope;
     *  scale = overlay size vs the symbol (1.06 gives the rim a hair of room). */
    symbolFx: {
      enabled: true,
      intensity: 1.2,
      rimWidth: 0.035,
      sweepSpeed: 0.55,
      envInMs: 220,
      envHoldOpacity: 220,
      scale: 1.06,
    },

    // ── Task 4.1: arcane payline glow (CCEffect bloom) — BOOSTED 2026-06-11
    //    The Graphics stroke alpha was cut so this additive overlay carries
    //    the visual weight of the win line. widthPx and alpha bumped so the
    //    bloom reads as a soft energy ribbon, not a hairline. ──────────────
    glow: {
      intensity: 1.4,
      scrollSpeed: 1.6,
      widthPx: 22,
      alpha: 1.0,
      fallbackEnabled: true,
    },

    // ── Task 6.3: Svarka plasma win-line ───────────────────────────────────
    /** Plasma core riding the line head: coreDiscs stacked-alpha discs that
     *  pulse-scale; sparkPerStep cascade spawn rate on head-crosses-cell;
     *  shake = winning-symbol jitter. additiveMaterial gates the CCEffect
     *  bright core (stacked-alpha is the always-on fallback). */
    svarka: {
      coreDiscs: 4,
      corePulseScale: 1.35,
      corePulseMs: 380,
      sparkPerStep: 3,
      sparkGravity: 1400,
      sparkLifeMs: 520,
      sparkColor: '#7fe7ff',
      shakeAmp: 4,
      shakeMs: 120,
      additiveMaterial: true,
    },
  },

  /** Kinetic win counter (count-up) — 3-beat: anticipation hold → count → savour. */
  counter: {
    /** Duration = baseMs + log10(win) * logScaleMs, clamped to maxMs. */
    baseMs: 600,
    logScaleMs: 350,
    maxMs: 3000,
    /** easeOutExpo = 1 - 2^(-10p) (fast → settle). */
    easing: 'easeOutExpo',
    /** Beat-1 hold (number pinned at 0) before counting, by tier band (ms). */
    antHoldMs: { epic: 320, big: 240, base: 150 },
    /** Landing pop on count-complete (damped-elastic). */
    landingPopMs: 380,
    landingPopScale: 0.3, // +0.42 for MEGA+
    landingTintMs: 420,

    // ── Task 5.1: heartbeat ticker (log-feel beats) ────────────────────────
    /** Inside the existing tickCount stepper, on each milestone crossing
     *  (10ⁿ boundary or N even steps) set amountLabel.node scale to popScale
     *  then decay toward 1 per-frame: popScale += (1−popScale)*min(1, decayPerSec*dt).
     *  Beats are dense early, sparse late — the log feel. */
    heartbeat: {
      popScale: 1.18,
      decayPerSec: 9,
      milestoneCount: 6,
    },
  },

  /** Tiered win ceremony (overlay shown for big wins). */
  ceremony: {
    /** Win must be >= this multiple of TOTAL bet for the overlay. Lowered 15→10
     *  (2026-06-11) so more wins get a celebration — small wins still read via
     *  the symbol glow + embers, but a medium win now also earns the ceremony.
     *  The BIG tier floor stays 15 (resolveBigWinTier), so 10–15x shows a light
     *  ceremony without a named tier banner — graceful escalation. */
    showMinMultiple: 10,
    /** How long the overlay holds before auto-dismiss (ms). */
    holdMs: 2000,
    /** "Held breath" dim before a BIG+ detonation (ms). */
    microSilenceMs: 200,
    /** Task 5.MATRIX — 4-tier ceremony re-band (presentation only — math unchanged).
     *  Tiers by win/TOTAL-bet multiple, high → low. First match wins. Per-tier knobs:
     *  - shakeAmp ........ board kick amplitude in px (capped at *1.8 inside the view)
     *  - color ........... header tint
     *  - headerKey ....... i18n key (legacy — present until the labels are translated)
     *  - coinParticles ... 0 = no coin geyser, >0 fires Epic-style ballistic spray
     *  - boardDimAlpha ... 0..0.6 (SUPER/EPIC only) deeper savour-beat vignette;
     *                       NEVER hard black — stays a stacked-alpha wash
     *  - panelLight ...... 0..1 amount-label backing glow boost
     *  - textPopScale .... heartbeat scale-pop on milestone crossings (Task 5.1) */
    tiers: [
      {
        name: 'EPIC',
        minMultiple: 100,
        shakeAmp: 18,
        color: '#ff3cac',
        headerKey: 'header_mega_win',
        coinParticles: 1,
        boardDimAlpha: 0.6,
        panelLight: 1.0,
        textPopScale: 1.28,
      },
      {
        name: 'SUPER',
        minMultiple: 50,
        shakeAmp: 14,
        color: '#ff5ab0',
        headerKey: 'header_mega_win',
        coinParticles: 0,
        boardDimAlpha: 0.5,
        panelLight: 0.7,
        textPopScale: 1.22,
      },
      {
        name: 'MEGA',
        minMultiple: 30,
        shakeAmp: 11,
        color: '#ffb000',
        headerKey: 'header_mega_win',
        coinParticles: 0,
        boardDimAlpha: 0,
        panelLight: 0.35,
        textPopScale: 1.18,
      },
      {
        name: 'BIG',
        minMultiple: 10,
        shakeAmp: 7,
        color: '#ffe14d',
        headerKey: 'header_win',
        coinParticles: 0,
        boardDimAlpha: 0,
        panelLight: 0,
        textPopScale: 1.14,
      },
    ],
  },

  /** Anticipation: drag the late reels when a strike is brewing. */
  anticipation: {
    /** Early wilds (in reels 0..2) needed to anticipate the rest. */
    minEarlyWilds: 2,
    /** Task 5.2: retarget trigger to SCATTER (presentation-only — math unchanged). */
    minEarlyScatters: 2,
    /** Extra spin time added to the dragging reels (s). */
    extraSeconds: 0.6,
    /** 2026-06-11 — `showAura:false` removes the magenta column + jagged
     *  lightning diamonds (the "WILD #3" geometry the user rejected). The
     *  anticipation now reads from the DECEL TIMING alone (the late reels drag
     *  longer = tension) + a subtle warm reel pulse. No drawn aura geometry. */
    showAura: false,
    boltCount: 4,
    reStrikeMs: 110,
    auraColor: '#ff2f93',
  },

  /** Win-burst shard particles. */
  particles: {
    baseCount: 14,
    perMultiple: 1.5,
    maxCount: 56,

    // ── Task 5.4: particle object pool (CC-2) ──────────────────────────────
    /** Ring of pre-built Graphics+UIOpacity shard Nodes. burst() borrows/returns
     *  instead of new/destroy. get() returns null if liveCount >= poolCap (drop
     *  the spawn — never grow). prealloc on first burst (or onLoad). */
    poolCap: 64,
    prealloc: 48,

    /** Epic-win coin geyser (CC-2 path B). count = ballistic coin nodes
     *  launched from a single point; spreadDeg = launch cone half-angle. */
    coin: {
      count: 30,
      launchSpeed: 900,
      gravity: 2200,
      spreadDeg: 60,
    },
  },

  /** Turbo speed scalar (OFF/TURBO/MAX) — scales reel baseDur + stagger. */
  turbo: { off: 1.0, turbo: 0.4, max: 0.16 },

  /** Reel land / squash / settle (damped-spring), per turbo mode. */
  land: {
    armAt: 0.965, // p >= armAt arms the landing
    symDurMs: { off: 250, turbo: 165, max: 130 },
    symStagMs: { off: 40, turbo: 26, max: 18 }, // bottom→top ripple
    landDip: { off: 0.052, turbo: 0.038, max: 0.03 }, // × CELL column dip
    landSq: { off: 0.055, turbo: 0.042, max: 0.034 }, // squash depth
  },

  /** Per-cell win reveal (before the ceremony), per turbo mode (ms). */
  reveal: {
    normalMs: { off: 1300, turbo: 720, max: 480, reduced: 700 },
    fsMs: { off: 1800, turbo: 1300, max: 900, reduced: 900 },
    buyMs: { off: 1500, turbo: 1100, max: 700, reduced: 600 },
    cellCascadeMs: 300,
    cellStaggerMs: 55,
    fruitPopMs: 240,
    scatterBurstStaggerMs: 120,
  },

  /** Per-bonus colour-grade overlay cross-fade (ms). */
  grade: { outMs: 280, inMs: 320, outAlpha: 0.75 },

  /** Feature banners (ms). */
  banner: { fsHoldMs: 1100, retriggerHoldMs: 850, reducedFsHoldMs: 500 },

  /** Autoplay inter-spin pause by turbo mode (ms). */
  autoplay: { off: 720, turbo: 280, max: 140 },

  /** Free-spin / bonus playback. */
  bonus: {
    /** Speed multiplier applied to each bonus reel spin (faster than base). */
    speedMul: 0.5,
    /** Pause between consecutive free spins (ms) — legacy flat fallback. */
    stepPauseMs: 200,
    /** Dwell after a DEAD spin (ms) — keep the loop brisk. */
    deadPauseMs: 170,
    /** Dwell after a WINNING spin (ms) — savour the win before the next spin. */
    winPauseMs: 560,
    /** A single step paying >= this multiple of the TOTAL bet earns its own
     *  in-bonus money beat (banner + extra dwell). */
    bigStepMultiple: 8,

    // ── Task 4.2: grid-merge wipe on bonus entry ───────────────────────────
    /** Vertical sweep CCEffect over the reel block on controller.startBonus.
     *  Fallback = a quick scale/alpha pulse. dir: 1 = top→bottom, -1 = bottom→top. */
    mergeWipe: {
      ms: 420,
      dir: 1 as 1 | -1,
      fallbackEnabled: true,
    },
  },

  // ── Task 5.3: per-symbol Spine (asset-blocked) — fallback profile only ───
  /** Until skeletons land, symbol-view.update uses per-id idle freq so two
   *  different ids breathe at distinct rates at the same frame. mixSeconds
   *  is the fake blend duration on win-state transitions. */
  symbols: {
    mixSeconds: 0.15,
    /** Per-symbol-id idle profile. Override entries by id; unlisted ids use base. */
    idleProfiles: {
      base: { amp: 1.0, freq: 1.9 },
    } as Record<string, { amp: number; freq: number }>,
  },

  // ── Task 4.3: flanking idle crystals (decor, Graphics + optional CCEffect) ─
  /** Two faceted-crystal Graphics nodes docked just outside the frame L/R at
   *  reelCenterY. portraitVisible=false hides them in portrait (FAB owns the
   *  margin per 1.3). displaceAmp drives the optional crystal-idle.effect wobble. */
  decor: {
    flankCrystal: {
      /** DISABLED 2026-06-11 — the flat magenta diamonds docked outside the
       *  reel frame L/R looked "very basic, not designed" (user-rejected).
       *  `enabled:false` skips the build entirely. Re-enable only with a real
       *  faceted-crystal art asset or a proper shader, not flat Graphics. */
      enabled: false,
      sizePx: 70,
      marginPx: 36,
      pulseSpeed: 1.6,
      displaceAmp: 3,
      portraitVisible: false,
      fallbackEnabled: true,
    },
  },

  // ── Task 4.4: intro→game cross-dissolve (mostly verify) ─────────────────
  /** In-engine intro cross-dissolve. DISABLED (ms:0) — fixed at the layer that
   *  actually matters: index.ejs now sets html/body/canvas background:#0a0610,
   *  so the browser CANNOT show white between intro destroy and canvas paint.
   *  Re-enable here only if a real-browser test on a specific device shows the
   *  CSS background fix is insufficient. */
  intro: {
    fade: { ms: 0, holdMs: 0, color: '#0a0610', startAlpha: 0 },
  },

  // ── Task 4.5: Buy-Bonus ambient (glint + plasma) ─────────────────────────
  /** Glint = diagonal sheen sweep across the FAB face (Graphics, ship-first).
   *  Plasma = swirling buy-plasma.effect under the art (CCEffect, gated). */
  buy: {
    ambient: {
      glintSweepMs: 520,
      glintGapMs: 2800,
      plasmaSpeed: 0.6,
      plasmaAlpha: 0.45,
      fallbackEnabled: true,
    },
  },

  // ── Task 3.3: info panel typography + wrap-bound layout ─────────────────
  /** Wrapping label opt-in: enableWrapText + RESIZE_HEIGHT + a measured layout
   *  pass (decrement y by label.height + lineGap, never a fixed 26). */
  info: {
    panelW: 540,
    panelH: 620,
    titleSize: 30,
    headerSize: 22,
    bodySize: 18,
    captionSize: 14,
    lineGap: 6,
    leftMargin: 36,
    colGap: 24,
    maxBodyHeight: 460,
  },

  // ── Task 3.4: premium menu redesign (row-card list) ─────────────────────
  /** Row-cards: candy tile + left accent gem + display label + caption +
   *  right chevron + press-squash. accentAlpha tints the gem. */
  menu: {
    panelW: 460,
    titleSize: 28,
    labelSize: 22,
    captionSize: 13,
    rowH: 64,
    rowGap: 10,
    gemSize: 14,
    accentAlpha: 0.85,
  },

  // ── Task 3.1/3.2: modal scrim + reusable close-X ────────────────────────
  /** scrimFadeMs eases in the obsidian wash; dismissOnScrim=false guards
   *  compliance modals (errorModal, rcModal). closeX = 44px crystal-faceted
   *  reusable component placed top-right in all dismissable panels. */
  modal: {
    scrimAlpha: 0.78,
    scrimFadeMs: 160,
    dismissOnScrim: true,
    closeX: { size: 44, inset: 30, strokeWidth: 4, hitPadding: 6 },
  },

  // ── Task 2.x + 7.x: bars (web + portrait), buttons, cursor, footer ──────
  /** All bar magic numbers consolidated here. `web` = landscape betting-bar-web.ts,
   *  `mobile` = portrait betting-bar.ts. Reach in from the bar files — never
   *  hardcode pixels in betting-bar*.ts again. */
  bar: {
    web: {
      // 2026-06-11 — betting-panel BG removed (user request). The bar controls
      // float directly over the painted game bg with no slab behind them. Set
      // these > 0 again only if a designer wants the slab back.
      bgBaseAlpha: 0.0,
      bgGroundAlpha: 0.0,
      bgGroundFrac: 0.6,
      gambleGapPx: 110,
      clusterCoinsX: 0,
      carousel: {
        // Defaults match the legacy betting-bar-web literals — designers
        // tweak here, never in code (Task 2.3).
        cellW: 132,
        pillCenterX: 388,
        fadeScale: [1.0, 0.74, 0.56, 0.5] as readonly number[],
        fadeOpacity: [255, 185, 95, 0] as readonly number[],
      },
      buttonBevel: {
        shadowAlpha: 0.45,
        sheenAlpha: 0.35,
      },
    },
    mobile: {
      bandAlpha: 0.9,
      fadeAboveBandPx: 24,
    },
    buttons: {
      hoverScale: 1.04,
      pressScale: 0.94,
      hoverMs: 140,
      pressMs: 80,
      releaseMs: 180,
      // Cubic-bezier control points (p1x, p1y, p2x, p2y) for a custom (t)=>number ease.
      ease: [0.16, 1.0, 0.3, 1.0] as readonly [number, number, number, number],
      enableHover: true,
    },
    cursor: { useCustom: false }, // desktop-gated, off by default for accessibility
    /** Task 7.2 — portrait-bar Buy control. Coords are bar-design (origin top-left,
     *  y DOWN; Y() flips to Cocos y-up). Default places it just right of the spin
     *  ring (spin centre = 200,322) so the Buy + Spin pair reads as the deck. */
    buyControl: { x: 384, y: 322, size: 62 },
    capsule: { fill: '#140d1c', radius: 14, edgeWidth: 1.5 },
    footer: { y: -42, height: 28, dividerY: -28 },
    bandTop: 60,
  },
} as const;

export type BigWinTier = (typeof VIEW_CONFIG.ceremony.tiers)[number];

/** Resolve the ceremony tier for a win/total-bet multiple, or null if below the lowest. */
export function resolveBigWinTier(multiple: number): BigWinTier | null {
  for (const tier of VIEW_CONFIG.ceremony.tiers) {
    if (multiple >= tier.minMultiple) return tier;
  }
  return null;
}
