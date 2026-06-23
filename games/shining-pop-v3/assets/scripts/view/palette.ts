import { HEX } from './theme';

// PAL is the legacy named token table consumed across the view layer. It now SHIMS
// over theme.ts: every brand-signal color is sourced from HEX (the single source),
// so a re-skin happens in theme.ts alone (this fixes the inert-theme finding — R10).
// Non-signal tuned literals (glass, scrims, tile states) stay inline.
//
// fonts stays as SYSTEM-font family names: the spaced 'Luckiest Guy' is the correct
// fallback family for a label with no loaded Font, and is intentionally distinct from
// the 'LuckiestGuy' resource path used in fonts.ts.
export const PAL = {
  pageBg: HEX.bg800,
  bgTint: '#b8b8c8',
  glassPanel: '#140a20',
  glassPanelAlpha: 0.72,
  panelShadow: '#05020a',
  chrome: '#f5f7fa',
  whitePip: '#ffffff',
  accent: HEX.pink.p500,
  accentHot: HEX.pink.p400,
  accentGlow: '#ff5a9c',
  accentGlow2: HEX.pink.p300,
  pinkBloom: HEX.pink.p200,
  pinkBloom2: '#ff8ad0',
  title: '#ff8ad0',
  valueText: HEX.pink.p50,
  valueText2: HEX.pink.p100,
  violet: HEX.violet,
  megaFuchsia: HEX.fuchsia,
  cyan: HEX.cyan,
  cyanGhost: '#9fe9ff',
  cyanLink: '#65d4f0',
  winGreen: HEX.mint,
  lossRed: '#ff6b6b',
  scrim: '#05030a',
  scrimAlpha: 0.82,
  tileBg: '#140d1c',
  tileHover: '#241730',

  lineColors: [
    HEX.pink.p500,
    '#c566ff',
    '#ff5cc8',
    HEX.violet,
    '#ff8ad0',
    '#d84bff',
    HEX.pink.p400,
    '#e0185c',
    HEX.pink.p300,
    '#b86bf0',
  ],

  symbolGem: [HEX.pink.p500, HEX.pink.p300, HEX.fuchsia, HEX.pink.p100, '#ffffff'],

  gradeTint: {
    base: '',
    bonus_standard: '#ff8ad0',
    bonus_hot: HEX.pink.p300,
    bonus_mega: HEX.fuchsia,
  },
  fonts: { body: 'Fredoka', display: 'Luckiest Guy' },
} as const;
