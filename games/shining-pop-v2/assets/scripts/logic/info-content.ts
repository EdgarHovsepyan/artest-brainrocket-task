// Game-information content — pure TypeScript, NO Cocos. Single source for the
// info panel: paytable rows derive from PAYTABLE (spec data), the advertised max
// win derives from paytable + WILD STRIKE, so the panel can never drift from the
// math. Master-parity texts adapted to this game's real feature set.

import {
  BONUS_MODES,
  BonusMode,
  FREE_SPINS_AWARD,
  PAYTABLE,
  SCATTER,
  SCATTER_MIN,
  SCATTER_PAY,
  SETTINGS,
  SYMBOLS,
  WILD_STRIKE,
} from './game-config';
import { SymbolId } from './types';

/** Display names matching the SHIPPED candy symbol art (2026-06-12 reskin).
 *  Resource filenames keep their original ids/UUIDs; only the display names
 *  track the art — a paytable naming symbols that aren't on the reels is a
 *  reviewer flag. */
export const SYMBOL_DISPLAY: Record<SymbolId, string> = {
  0: 'WILD',
  1: 'GOLD GEM',
  2: 'BLUE GEM',
  3: 'PURPLE GEM',
  4: 'CANDY HEARTS',
  5: 'TWIST CANDY',
  6: 'CANDY CANES',
  7: 'GUMMY BEARS',
  8: 'SCATTER',
  9: 'WRAPPED CANDY',
};

export interface PaytableRow {
  id: SymbolId;
  name: string;
  pay3: number;
  pay4: number;
  pay5: number;
}

/** Paytable rows in display order (Wild, highs, lows) — values in line-bet
 *  multiples. The SCATTER (id 8) is EXCLUDED: it never pays on a payline (the
 *  engine ignores it for line wins), so listing its PAYTABLE entry as a line pay
 *  would advertise a payout it can never make. Scatter pays are documented
 *  separately in SCATTER_LINES. */
export function paytableRows(): PaytableRow[] {
  return (Object.keys(PAYTABLE) as unknown as SymbolId[])
    .map((key) => Number(key) as SymbolId)
    .filter((id) => id !== SCATTER)
    .map((id) => ({
      id,
      name: SYMBOL_DISPLAY[id],
      pay3: PAYTABLE[id][3],
      pay4: PAYTABLE[id][4],
      pay5: PAYTABLE[id][5],
    }));
}

/** SCATTER + free-spins documentation (the rainbow-lollipop pays ANYWHERE and
 *  triggers free spins) — derived from the live math constants so it can never
 *  drift. Rendered in the info panel's paytable/rules tab and teased on the intro. */
export const SCATTER_LINES: string[] = [
  'SCATTER (rainbow lollipop) pays ANYWHERE on the grid — no line needed:',
  ...Object.entries(SCATTER_PAY).map(([n, p]) => `   ${n}+ scatters  →  ${p}x total bet`),
  `Land ${SCATTER_MIN}+ scatters to also trigger FREE SPINS (Sticky Wilds):`,
  ...Object.entries(FREE_SPINS_AWARD).map(([n, f]) => `   ${n} scatters  →  ${f} free spins`),
  'Scatters never substitute and never form a payline.',
];

/** One-line scatter teaser for the intro peek (kept short so it fits the gate). */
export const SCATTER_TEASER = `SCATTER ✦ ${SCATTER_MIN}+ rainbow lollipops anywhere → FREE SPINS`;

/** Theoretical max win as a multiple of TOTAL bet: full-Wild grid (every line pays
 *  the 5-Wild run) boosted by the WILD STRIKE cap. */
export function maxWinMultiple(): number {
  return PAYTABLE[SYMBOLS.WILD][5] * WILD_STRIKE.maxMultiplier;
}

/** Shown verbatim in the panel — must match the published math page. */
export const RTP_DISPLAY = '97.50%';
export const VOLATILITY_DISPLAY = 'MED-HIGH';

export const RULES_LINES: string[] = [
  `All ${SETTINGS.activeLines} lines are always active; wins pay left to right.`,
  'WILD substitutes for every symbol.',
  `WILD STRIKE: ${WILD_STRIKE.minWilds}+ Wilds anywhere multiply the spin's`,
  `line wins by the Wild count, up to x${WILD_STRIKE.maxMultiplier}.`,
  'Buy Features play a fixed set of free spins (see FEATURES).',
  'Every spin is separate and decided fairly at random.',
];

/** What each mode does, in player language. */
const FEATURE_DESC: Record<BonusMode, string> = {
  wilds: 'every WILD that lands STICKS for the rest of the feature.',
  crowns: 'every GOLD GEM that lands STICKS for the rest of the feature.',
  reels: 'one full reel turns WILD and stays locked for every spin.',
};

/** Buy-feature documentation — derives from BONUS_MODES (the single source the
 *  buy menu prices from), so the info panel can never drift from the live costs. */
export const FEATURES_LINES: string[] = (Object.keys(BONUS_MODES) as BonusMode[]).flatMap(
  (mode) => {
    const m = BONUS_MODES[mode];
    return [
      `${m.name} — ${m.spins} free spins; ${FEATURE_DESC[mode]}`,
      `  Cost: ${m.cost.toFixed(2)}x your total bet (shown live in the Buy menu).`,
    ];
  },
);

export const CONTROLS_LINES: string[] = [
  'SPIN / Space — start a round',
  '+ / − — change your bet',
  'MENU — Buy Feature, Settings, Autoplay',
  'A — autoplay · T — turbo · M — mute',
  'B — buy feature · S — settings · I — info',
];
