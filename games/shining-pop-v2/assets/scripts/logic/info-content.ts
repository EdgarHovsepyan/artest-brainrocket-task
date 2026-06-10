// Game-information content — pure TypeScript, NO Cocos. Single source for the
// info panel: paytable rows derive from PAYTABLE (spec data), the advertised max
// win derives from paytable + WILD STRIKE, so the panel can never drift from the
// math. Master-parity texts adapted to this game's real feature set.

import { PAYTABLE, SETTINGS, SYMBOLS, WILD_STRIKE } from './game-config';
import { SymbolId } from './types';

/** Display names matching the shipped symbol art (the master's candy set,
 *  black-keyed offline; resource filenames keep their original ids/UUIDs). */
export const SYMBOL_DISPLAY: Record<SymbolId, string> = {
  0: 'WILD',
  1: 'CROWN',
  2: 'SEVEN',
  3: 'BELL',
  4: 'MELON',
  5: 'GRAPES',
  6: 'PLUM',
  7: 'LEMON',
  8: 'CHERRY',
  9: '10',
};

export interface PaytableRow {
  id: SymbolId;
  name: string;
  pay3: number;
  pay4: number;
  pay5: number;
}

/** Paytable rows in display order (Wild, highs, lows) — values in line-bet multiples. */
export function paytableRows(): PaytableRow[] {
  return (Object.keys(PAYTABLE) as unknown as SymbolId[]).map((key) => {
    const id = Number(key) as SymbolId;
    return {
      id,
      name: SYMBOL_DISPLAY[id],
      pay3: PAYTABLE[id][3],
      pay4: PAYTABLE[id][4],
      pay5: PAYTABLE[id][5],
    };
  });
}

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
  'Buy Features play a fixed set of free spins.',
  'Every spin is separate and decided fairly at random.',
];

export const CONTROLS_LINES: string[] = [
  'SPIN / Space — start a round',
  '+ / − — change your bet',
  'MENU — Buy Feature, Settings, Autoplay',
  'A — autoplay · T — turbo · M — mute',
  'B — buy feature · S — settings · I — info',
];
