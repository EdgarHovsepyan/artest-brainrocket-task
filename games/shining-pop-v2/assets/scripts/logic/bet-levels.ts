// Bet levels — pure TypeScript, NO Cocos. Master parity: the +/- steppers and
// the QUICK BET panel move through a fixed ladder of preset stakes (never raw
// arithmetic on the current value), so every reachable bet is a designed one.

export const BET_LEVELS_CENTS: readonly number[] = [100, 200, 300, 500, 700, 1000];

export function minBet(): number {
  return BET_LEVELS_CENTS[0];
}

export function maxBet(): number {
  return BET_LEVELS_CENTS[BET_LEVELS_CENTS.length - 1];
}

/** Snap an arbitrary value to the nearest level (ties resolve downward). */
export function snapBet(cents: number): number {
  let best = BET_LEVELS_CENTS[0];
  for (const lv of BET_LEVELS_CENTS) {
    if (Math.abs(lv - cents) < Math.abs(best - cents)) best = lv;
  }
  return best;
}

/** Step to the adjacent level; clamps at the ladder ends. */
export function stepBet(currentCents: number, dir: 1 | -1): number {
  const idx = BET_LEVELS_CENTS.indexOf(snapBet(currentCents));
  const next = Math.max(0, Math.min(BET_LEVELS_CENTS.length - 1, idx + dir));
  return BET_LEVELS_CENTS[next];
}
