export const VIEW_CONFIG = {
  vfx: {
    materialsEnabled: true,

    quality: {
      targetFps: 60,
      emaAlpha: 0.1,
      warmupFrames: 30,
      minScale: 0.45,
      upShiftMs: 18,
      downShiftMs: 32,
      recoverPerSec: 0.25,
      shedPerSec: 2.0,
      stallClampMs: 100,
    },
  },

  layout: {
    cell: 96,

    symbolFill: 0.94,

    gap: 5,

    reelCenterY: 90,

    designWidth: 760,
    designHeight: 760,

    spinBuffer: 14,

    contentTopPx: 372,

    landscapeTopPadPx: 28,
    boardBottomGapPx: 22,

    bgCoverOverscan: 1.06,

    windowFeatherPx: 24,
    /** Per-reel mask widen (each side) so a winning symbol's pop isn't clipped L/R.
     *  Horizontal-only; widening vertically would reveal off-window buffer cells. */
    winPopMaskMargin: 34,

    portraitWidthFill: 0.99,
    landscapeWidthFill: 1.0,

    fab: {
      sizePx: 100,
      gapPx: 14,
      minClearancePx: 14,
      edgePadPx: 12,

      landscapeDockSign: -1,

      portraitScreenX: 0.2,
      portraitScreenY: 0.2,

      portraitWidthPx: 232,

      portraitBandFrac: 0.62,

      landscapeScale: 0.78,
    },

    logo: {
      topY: 322,

      landscapeScale: 0.4,
      landscapeScreenX: 0.085,
      landscapeScreenY: 0.88,
      bonusScreenX: 0.12,
      bonusScreenY: 0.5,
    },
  },

  spin: {
    // Longer base spin so the cruise reads as a continuous looping tape.
    minSpinMs: 480,

    reelStopStaggerMs: 88,

    stopCadence: [0, 1.0, 1.85, 2.6, 3.9],

    stopMinGapMs: { off: 0, turbo: 34, max: 22 },

    // Snappier launch + firmer decel so the reel reads confident, not spongy.
    accelFraction: 0.12,
    decelFraction: 0.3,

    landSquash: 0.9,

    settleMs: { off: 300, turbo: 150, max: 80 },

    quickStopArmMs: { off: 180, turbo: 110, max: 70 },

    windupMs: 70,
    windupAmpFrac: 0.85,
    windupSquash: 1.0,

    blur: {
      enabled: true,
      triggerSpd: 0.12,
      span: 0.25,
      strengthYFrac: 0.03,
      strengthXFrac: 0.012,
      rampInDecay: 0.5,
      rampOutDecay: 0.18,
    },

    quickStop: {
      staggerMs: 8,
      minMs: 55,
      maxMs: 100,
    },

    preSpinMaskMs: 50,

    preSpinFadeToAlpha: 255,

    portal: {
      enabled: false,
      entryMs: 180,
      exitMs: 220,
      warpAmp: 6,
      fringeColor: '#ff5ab0',
    },

    bounce: {
      // overtravelFrac 0 => bounceEnabled false in reel-view.spinTo: one monotonic
      // reelEase tween to y=0, a clean dead stop. Other knobs are inert at 0.
      overtravelFrac: 0,
      bounceMs: 190,
      easing: 'quadOut',
      weight: 1.05,
      speed: 1,
      elasticity: 1.0,

      // Whole-reel scale "recoil" pop on reel stop (ReelView.recoil); early-returns
      // when amp <= 1. landRecoilScale 1.0 = resting stop just holds; wildRecoilScale
      // kept as a wild-LAND celebration beat (paired with flashWilds).
      wildRecoilScale: 1.045,
      landRecoilScale: 1.0,
    },
  },

  win: {
    symbolPulseScale: 1.3,
    symbolPulseMs: 240,

    // Cell-filling symbols (Wild/Scatter): pop tempered for their size but jelly at
    // full strength for parity; rotate gentler than the standard so they never tip out.
    fullSizePopTemper: 0.55,
    fullSizeJellyTemper: 1.0,
    fullSizeWinRotate: { deg: 9, ms: 380 },

    winAnticipation: { enabled: true, dip: 0.9, ms: 80 },

    // L->R per-reel delay on the win-symbol pop: small so reels pop almost together
    // (a subtle wave, not a laggy one).
    highlightWaveStagger: 0.04,

    symbolProfiles: {
      0: { heat: 1.35 },
      1: { heat: 1.22 },
      2: { heat: 1.15 },
      3: { heat: 1.08 },
      4: { heat: 1.03 },
      5: { heat: 0.95 },
      6: { heat: 0.92 },
      7: { heat: 0.9 },
      8: { heat: 0.88 },
      9: { heat: 0.86 },
    } as Record<number, { heat: number }>,

    winBounceLoop: { enabled: true, jelly: 0.15, ms: 290, heatTempo: 0.6 },

    winSustainScale: 1.16,

    // Lift winning symbols into the winLift overlay so the pop renders on top and
    // isn't cropped by the per-reel/container masks. SymbolView.liftForWin places
    // each deterministically on its own cell; clear()/resetHome restore strip home.
    liftWinSymbols: true,

    winTilt: { enabled: true, deg: 13, ms: 540 },

    haloTint: { hot: '#fff0c8', cold: '#c8e1ff', hotHeat: 1.3, coldHeat: 0.9 },

    wildHappyFace: { enabled: true, offsetYFrac: 0.3, scale: 1.05, fadeMs: 160 },

    loserDimOpacity: 95,

    lineCycleSeconds: 0.85,

    showLines: false,

    fireEmbers: { perCell: 22, riseSpeed: 180, lifeMs: 820, spreadPx: 96 },

    fireFlames: { enabled: false },

    beams: {
      enabled: true,
      // slim, elegant win line
      heightPx: 15,
      // 10 paylines x 4 segments = 40 worst case; pool shared across wins via a
      // running counter, so later lines may drop their last segment when starved.
      maxSegments: 40,
      fadeInMs: 150,
      holdOpacity: 235,
      revealStaggerMs: 70,
      intensity: 1.3,
      flowSpeed: 2.4,
    },

    burst: { enabled: false, intensity: 1.2, scale: 1.1 },

    symbolFx: {
      // Disabled: this per-symbol shader overlay correlated with "symbols hiding"
      // on real GPU. Re-enable only after a real-device visual check.
      enabled: false,
      intensity: 1.45,
      rimWidth: 0.035,
      sweepSpeed: 0.85,
      envInMs: 160,
      envHoldOpacity: 235,
      scale: 1.06,
    },

    glow: {
      intensity: 1.4,
      scrollSpeed: 1.6,
      widthPx: 22,
      alpha: 1.0,
      fallbackEnabled: true,
    },

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

  counter: {
    baseMs: 600,
    logScaleMs: 350,
    maxMs: 3000,

    easing: 'easeOutExpo',

    antHoldMs: { epic: 320, big: 240, base: 150 },

    landingPopMs: 380,
    landingPopScale: 0.36,
    landingTintMs: 420,

    heartbeat: {
      popScale: 1.22,
      decayPerSec: 8,
      milestoneCount: 6,
    },
  },

  ceremony: {
    showMinMultiple: 10,

    beats: {
      hushMs: 260,
      detonationFlashInMs: 50,
      detonationFlashOutMs: 340,
      climaxBaseMs: 800,
      climaxPerTxMs: 1000,
      savourDimMs: 500,
      savourHoldBaseMs: 2000,
      savourHoldPerTxMs: 1100,
    },

    tiers: [
      {
        name: 'EPIC',
        minMultiple: 100,
        shakeAmp: 20,
        color: '#ff1e8c',
        headerKey: 'header_mega_win',
        coinParticles: 1,
        boardDimAlpha: 0.78,
        panelLight: 1.0,
        textPopScale: 1.28,
      },
      {
        name: 'SUPER',
        minMultiple: 50,
        shakeAmp: 15,
        color: '#ff5ab0',
        headerKey: 'header_mega_win',
        coinParticles: 1,
        boardDimAlpha: 0.56,
        panelLight: 0.72,
        textPopScale: 1.22,
      },
      {
        name: 'MEGA',
        minMultiple: 30,
        shakeAmp: 11,
        color: '#ff79c4',
        headerKey: 'header_mega_win',
        coinParticles: 1,
        boardDimAlpha: 0.28,
        panelLight: 0.44,
        textPopScale: 1.18,
      },
      {
        name: 'BIG',
        minMultiple: 10,
        shakeAmp: 7,
        color: '#ffa8dc',
        headerKey: 'header_win',
        coinParticles: 0,
        boardDimAlpha: 0.12,
        panelLight: 0.18,
        textPopScale: 1.14,
      },
    ],
  },

  anticipation: {
    minEarlyWilds: 2,

    minEarlyScatters: 2,

    extraSeconds: 0.6,

    showAura: true,
    boltCount: 4,
    reStrikeMs: 110,
    auraColor: '#ff2f93',
  },

  particles: {
    baseCount: 18,
    perMultiple: 1.5,
    maxCount: 72,

    poolCap: 96,
    prealloc: 72,

    coin: {
      count: 30,
      launchSpeed: 900,
      gravity: 2200,
      spreadDeg: 60,
    },
  },

  turbo: { off: 1.0, turbo: 0.4, max: 0.16 },

  world: {
    parallax: {
      // BG parallax = big-wins only. spinLeanPx 0 keeps the background still during
      // normal play; depth motion is reserved for big-win/feature moments.
      spinLeanPx: 0,
      winPulsePx: 6,
      leanLerp: 5,
      pulseDecay: 2.0,
      // one-shot bg depth "whoosh" (× winPulsePx) on big-win detonation + feature
      // entry; decays via pulseDecay. Now the sole bg-parallax driver.
      winBurstPulse: 4.5,
    },
  },

  land: {
    armAt: 0.965,
    symDurMs: { off: 250, turbo: 165, max: 130 },
    symStagMs: { off: 42, turbo: 22, max: 7 },
    // landDip 0 = reel lands flat (no positional post-stop bob). The land feel is a
    // SCALE jelly in playLand (squash -> rebound -> damped settle, all quadOut);
    // landSq is the squash depth, tuned for a candy "boing" that holds still after.
    landDip: { off: 0, turbo: 0, max: 0 },
    landSq: { off: 0.055, turbo: 0.042, max: 0.03 },
  },

  reveal: {
    normalMs: { off: 1300, turbo: 720, max: 480, reduced: 700 },
    fsMs: { off: 1800, turbo: 1300, max: 900, reduced: 900 },
    buyMs: { off: 1500, turbo: 1100, max: 700, reduced: 600 },
    cellCascadeMs: 300,
    cellStaggerMs: 55,
    fruitPopMs: 240,
    scatterBurstStaggerMs: 120,
  },

  grade: { outMs: 280, inMs: 320, outAlpha: 0.75 },

  banner: { fsHoldMs: 1100, retriggerHoldMs: 850, reducedFsHoldMs: 500 },

  autoplay: { off: 720, turbo: 280, max: 140 },

  bonus: {
    speedMul: 0.5,

    stepPauseMs: 200,

    deadPauseMs: { off: 170, turbo: 90, max: 45 },

    winPauseMs: { off: 560, turbo: 330, max: 190 },

    bigStepMultiple: 8,

    mergeWipe: {
      ms: 420,
      dir: 1 as 1 | -1,
      fallbackEnabled: true,
    },
  },

  symbols: {
    mixSeconds: 0.15,

    idleProfiles: {
      base: { amp: 1.0, freq: 1.9 },
    } as Record<string, { amp: number; freq: number }>,
    /** Idle-breathe scale amplitude per symbol weight (sine on the `art` child): a
     *  whisper so symbols settle but the board still reads alive. Wild uses 0 (its
     *  FX carry it). high = ids 0..4 (wild+H1..H4), low = the rest. */
    idleBreatheAmp: { high: 0.008, low: 0.005 },
  },

  decor: {
    flankCrystal: {
      enabled: false,
      sizePx: 70,
      marginPx: 36,
      pulseSpeed: 1.6,
      displaceAmp: 3,
      portraitVisible: false,
      fallbackEnabled: true,
    },
  },

  intro: {
    fade: { ms: 0, holdMs: 0, color: '#0a0610', startAlpha: 0 },
  },

  buy: {
    ambient: {
      glintSweepMs: 520,
      glintGapMs: 2800,
      plasmaSpeed: 0.6,
      plasmaAlpha: 0.45,
      fallbackEnabled: true,
    },
  },

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

  modal: {
    scrimAlpha: 0.78,
    scrimFadeMs: 160,
    dismissOnScrim: true,
    closeX: { size: 44, inset: 30, strokeWidth: 4, hitPadding: 6 },
  },

  bar: {
    web: {
      bgBaseAlpha: 0.0,
      bgGroundAlpha: 0.0,
      bgGroundFrac: 0.6,
      gambleGapPx: 110,
      clusterCoinsX: 0,
      carousel: {
        cellW: 132,

        pillCenterX: 388,

        fadeScale: [1.0, 0.88, 0.82, 0.78] as readonly number[],
        fadeOpacity: [255, 224, 192, 168] as readonly number[],
      },
      buttonBevel: {
        shadowAlpha: 0.45,
        sheenAlpha: 0.35,
      },
    },
    mobile: {
      bandAlpha: 0.0,
      fadeAboveBandPx: 24,
    },
    buttons: {
      hoverScale: 1.04,
      pressScale: 0.94,
      hoverMs: 140,
      pressMs: 80,
      releaseMs: 180,

      ease: [0.16, 1.0, 0.3, 1.0] as readonly [number, number, number, number],
      enableHover: true,
    },
    cursor: { useCustom: false },

    buyControl: { x: 384, y: 322, size: 62 },
    capsule: { fill: '#140d1c', radius: 14, edgeWidth: 1.5 },
    footer: { y: -42, height: 28, dividerY: -28 },
    bandTop: 60,
  },
} as const;

export type BigWinTier = (typeof VIEW_CONFIG.ceremony.tiers)[number];

export function resolveBigWinTier(multiple: number): BigWinTier | null {
  for (const tier of VIEW_CONFIG.ceremony.tiers) {
    if (multiple >= tier.minMultiple) return tier;
  }
  return null;
}
