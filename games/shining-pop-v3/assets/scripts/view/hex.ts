// assets/scripts/view/hex.ts — raw hex source-of-truth for the Sugar Rush palette.
//
// PURE DATA, no engine import: cc-free so palette.ts (legacy hex-string table) and
// node tests can consume it without pulling in 'cc'. theme.ts wraps these in cc.Color.
// To re-skin the whole game, edit a color HERE — both PAL and THEME derive from it.
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
