// Shining-Pop visual identity ported to shining-pop-v2: dark near-black violet base
// + electric magenta/pink VFX, smoke-white chrome, cyan rim accent (EXTRA STUDIO
// "villain" look). Hex STRINGS to match view-config's colour convention — consumers
// convert with `new Color().fromHEX(c)`. VISUAL ONLY — touches no math.
export const PAL = {
  pageBg: '#0a0610',
  bgTint: '#b8b8c8', // ~28% darken applied to the background sprite
  glassPanel: '#140a20', // reel column fill — use at glassPanelAlpha
  glassPanelAlpha: 0.72,
  panelShadow: '#05020a',
  chrome: '#f5f7fa', // smoke-white rim / labels
  whitePip: '#ffffff',
  accent: '#ff007f', // primary magenta
  accentHot: '#ff2f93',
  accentGlow: '#ff5a9c',
  accentGlow2: '#ff5ab0',
  pinkBloom: '#ff8ab8',
  pinkBloom2: '#ff8ad0',
  title: '#ff8ad0',
  valueText: '#ffe6f4', // crystal white-pink
  valueText2: '#ffd9ec',
  violet: '#9a3bd6',
  megaFuchsia: '#ff2ad0',
  cyan: '#7fe7ff',
  cyanGhost: '#9fe9ff',
  cyanLink: '#65d4f0',
  winGreen: '#52d189',
  lossRed: '#ff6b6b',
  scrim: '#05030a', // obsidian modal scrim — use at scrimAlpha
  scrimAlpha: 0.82,
  tileBg: '#140d1c',
  tileHover: '#241730',
  /** 10 payline colours (magenta/pink/violet family + one cyan so lines read apart). */
  lineColors: [
    '#ff007f',
    '#c566ff',
    '#ff5cc8',
    '#9a3bd6',
    '#ff8ad0',
    '#d84bff',
    '#ff2f93',
    '#7fe7ff',
    '#ff5ab0',
    '#b86bf0',
  ],
  /** Faceted magenta-crystal gem ramp for procedural symbol fallbacks. */
  symbolGem: ['#ff007f', '#ff5ab0', '#ff2ad0', '#ffd9ec', '#ffffff'],
  /** Per-bonus colour-grade tint targets (overlay multiply); base = no tint. */
  gradeTint: {
    base: '',
    bonus_standard: '#ff8ad0',
    bonus_hot: '#ff5ab0',
    bonus_mega: '#ff2ad0',
  },
  fonts: { body: 'Fredoka', display: 'Luckiest Guy' },
} as const;
