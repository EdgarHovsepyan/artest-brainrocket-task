// assets/scripts/view/theme.ts — Sugar Rush, single source of color/type truth.
//
// HEX is the raw source-of-truth. Both THEME (cc.Color objects, for Graphics/Sprite
// tinting) and palette.ts PAL (hex strings, the legacy view token table) derive from
// HEX, so every brand color lives in exactly ONE place. To re-skin: edit HEX.
//
// Authority: VISUAL tokens only. Never a payout, weight, RTP, bet level or odds —
// those live in logic/ (math-core). Math decides; view renders.
import { Color } from 'cc';

// ── RAW SOURCE-OF-TRUTH ──
export const HEX = {
  pink: {
    p50: '#ffe6f4', p100: '#ffd9ec', p200: '#ff8ab8', p300: '#ff5ab0', p400: '#ff2f93',
    p500: '#ff007f', /* PRIMARY ★ */ p600: '#d6006e', p700: '#b8005e', p900: '#6a0540',
  },
  fuchsia: '#ff2ad0', // mega/hot tier, top-volatility buy
  violet: '#9a3bd6', // autoplay control only
  cyan: '#7fe7ff', // SCATTER + free-spins + win-ring signalling ONLY
  mint: '#52d189', // WIN signalling + free-spins multiplier rail ONLY
  gold: '#e9b84e', // high-symbol frames / premium chrome / cabinet rivets
  goldLight: '#ffd97a',
  caramel: '#ff9a3c', // turbo
  bg900: '#08050e', bg800: '#0a0610', panel: '#160c22', panel2: '#21102f',
  panelAlt: '#0f0818', pageBody: '#07040c',
  text: '#fff4fb', textMute: '#a99bbc', textDim: '#cdbede', textSub: '#9a8cae',
} as const;

const C = (hex: string, a = 255): Color => {
  const c = new Color();
  Color.fromHEX(c, hex);
  c.a = a;
  return c;
};

export const THEME = {
  // ── BRAND PINK SPINE (9-step) ──
  pink: {
    p50: C(HEX.pink.p50), p100: C(HEX.pink.p100), p200: C(HEX.pink.p200), p300: C(HEX.pink.p300),
    p400: C(HEX.pink.p400), p500: C(HEX.pink.p500), p600: C(HEX.pink.p600),
    p700: C(HEX.pink.p700), p900: C(HEX.pink.p900),
  },
  // ── ACCENTS — SIGNAL ONLY ──
  accent: {
    fuchsia: C(HEX.fuchsia),
    violet: C(HEX.violet),
    cyan: C(HEX.cyan),
    mint: C(HEX.mint),
    gold: C(HEX.gold),
    caramel: C(HEX.caramel),
  },
  // ── NEUTRALS (Midnight Plum) ──
  neutral: {
    bg900: C(HEX.bg900), bg800: C(HEX.bg800), panel: C(HEX.panel), panel2: C(HEX.panel2),
    panelAlt: C(HEX.panelAlt), pageBody: C(HEX.pageBody),
    text: C(HEX.text), textMute: C(HEX.textMute), textDim: C(HEX.textDim), textSub: C(HEX.textSub),
  },
  // ── SPACING (4px base) ──
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 },
  // ── RADIUS ──
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  // ── ELEVATION (alpha-channel drop shadows for Graphics) ──
  elevation: {
    e1: { blur: 12, y: 4, rgba: 'rgba(0,0,0,.30)' },
    e2: { blur: 30, y: 12, rgba: 'rgba(0,0,0,.45)' },
    e3: { blur: 50, y: 30, rgba: 'rgba(0,0,0,.60)' },
    glowPink: { blur: 26, rgba: 'rgba(255,0,127,.60)' },
    glowCyan: { blur: 26, rgba: 'rgba(127,231,255,.60)' },
  },
  // ── TYPE SCALE (px / family / weight) ──
  type: {
    displayXL: { size: 64, font: 'LuckiestGuy', caps: true },
    displayM: { size: 36, font: 'LuckiestGuy', caps: true },
    uiXL: { size: 24, font: 'Fredoka', weight: 600 },
    uiM: { size: 16, font: 'Fredoka', weight: 500 },
    btn: { size: 15, font: 'Fredoka', weight: 700 },
    monoXS: { size: 11, font: 'SpaceMono', spacing: 0.14, caps: true },
  },
  fonts: { display: 'LuckiestGuy', body: 'Fredoka', mono: 'SpaceMono' },
  // ── SIGNATURE GRADIENT STOPS (for Graphics gradient fills) ──
  grad: {
    spinDome: [HEX.text, HEX.pink.p100, HEX.pink.p300, HEX.pink.p500, HEX.pink.p700],
    spinDomeLite: [HEX.pink.p100, HEX.pink.p500],
    progress: [HEX.pink.p500, HEX.pink.p200],
    btnPrimary: [HEX.pink.p300, HEX.pink.p500],
    cabinetBorder: ['#ffd0e6', HEX.pink.p300, HEX.pink.p500, '#c4006a', '#8a0050'],
    cabinetFill: ['rgba(30,12,42,.85)', 'rgba(10,6,18,.92)'],
    menuSurface: [HEX.panel2, '#160a22'],
    winLine: ['rgba(127,231,255,0)', HEX.cyan, HEX.text, HEX.cyan, 'rgba(127,231,255,0)'],
    glassCabinet: ['rgba(255,255,255,.16)', 'rgba(10,6,20,.34)'],
  },
} as const;

export type Theme = typeof THEME;
