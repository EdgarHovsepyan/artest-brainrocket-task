// DATA-DRIVEN visual / animation config for the Cocos view layer.
// ZERO HARDCODING: every size, timing and gain lives here and is read by the
// view components. Designers tune this file, never the component code.

export const VIEW_CONFIG = {
  /** Board layout (px). The view builds the whole scene from these numbers. */
  layout: {
    /** Square symbol cell size. */
    cell: 96,
    /** Symbol art fill fraction of the cell (master: CELL*0.92 contain-fit). */
    symbolFill: 0.92,
    /** Gap between cells (and between reels). */
    gap: 8,
    /** Vertical centre of the reel block, relative to the canvas centre. */
    reelCenterY: 90,
    /** Logical design envelope used for the responsive contain-fit. */
    designWidth: 760,
    designHeight: 760,
    /** Extra symbols stacked above the window so a reel can really scroll. */
    spinBuffer: 12,
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
    /** Anticipatory wind-up kick before launch (OFF mode only, over the first ~2.5%). */
    windupMs: 80,
    windupAmpFrac: 0.5, // × CELL
    /** Velocity-coupled vertical motion-blur streak. */
    blur: {
      triggerSpd: 0.12, // cells/frame before blur engages
      span: 0.25, // (spd-trigger)/span → 0..1
      strengthYFrac: 0.08, // × CELL
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
  },

  /** Winning-line presentation. */
  win: {
    /** Pulse scale applied to winning symbols. */
    symbolPulseScale: 1.18,
    symbolPulseMs: 420,
    /** Seconds each winning line stays highlighted before cycling to the next. */
    lineCycleSeconds: 0.85,
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
  },

  /** Tiered win ceremony (overlay shown for big wins). */
  ceremony: {
    /** Win must be >= this multiple of TOTAL bet for the overlay (small wins = HUD only). */
    showMinMultiple: 8,
    /** How long the overlay holds before auto-dismiss (ms). */
    holdMs: 2000,
    /** "Held breath" dim before a BIG+ detonation (ms). */
    microSilenceMs: 200,
    /** Tiers by win/TOTAL-bet multiple, high → low. First match wins. */
    tiers: [
      {
        name: 'EPIC',
        minMultiple: 50,
        shakeAmp: 16,
        color: '#ff3cac',
        headerKey: 'header_mega_win',
      },
      {
        name: 'MEGA',
        minMultiple: 20,
        shakeAmp: 11,
        color: '#ffb000',
        headerKey: 'header_mega_win',
      },
      { name: 'BIG', minMultiple: 8, shakeAmp: 7, color: '#ffe14d', headerKey: 'header_win' },
    ],
  },

  /** Anticipation: drag the late reels when a WILD STRIKE is brewing. */
  anticipation: {
    /** Early wilds (in reels 0..2) needed to anticipate the rest. */
    minEarlyWilds: 2,
    /** Extra spin time added to the dragging reels (s). */
    extraSeconds: 0.6,
  },

  /** Win-burst shard particles. */
  particles: {
    baseCount: 14,
    perMultiple: 1.5,
    maxCount: 56,
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
    /** Pause between consecutive free spins (ms). */
    stepPauseMs: 200,
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
