// DATA-DRIVEN visual / animation config for the Cocos view layer.
// ZERO HARDCODING: every size, timing and gain lives here and is read by the
// view components. Designers tune this file, never the component code.

export const VIEW_CONFIG = {
  /** Board layout (px). The view builds the whole scene from these numbers. */
  layout: {
    /** Square symbol cell size. */
    cell: 96,
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

  /** Reel spin animation. */
  spin: {
    /** Minimum spin time before the first reel stops (ms). */
    minSpinMs: 650,
    /** Stagger between consecutive reel stops (ms). Left-to-right. */
    reelStopStaggerMs: 150,
    /** Fraction of each reel's motion spent winding up / decelerating. */
    accelFraction: 0.16,
    decelFraction: 0.36,
    /** Squash applied to a reel's symbols on landing (the "thunk"). */
    landSquash: 0.9,
  },

  /** Winning-line presentation. */
  win: {
    /** Pulse scale applied to winning symbols. */
    symbolPulseScale: 1.18,
    symbolPulseMs: 420,
    /** Seconds each winning line stays highlighted before cycling to the next. */
    lineCycleSeconds: 0.85,
  },

  /** Kinetic win counter (count-up). */
  counter: {
    /** Duration = baseMs + log10(win) * logScaleMs, clamped to maxMs. */
    baseMs: 600,
    logScaleMs: 350,
    maxMs: 3000,
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
