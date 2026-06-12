/** Engine-neutral UI helpers shared by Pixi and Cocos games.
 *  Grows into HUD/compliance primitives (info modal, RG link, bet stepper rules). */

/** Format a money amount (in major units) for display, e.g. 12.5 -> "12.50". */
export function formatMoney(units: number, fractionDigits = 2): string {
  return units.toFixed(fractionDigits);
}

/** Tiered label for a win expressed as a multiple of the total bet. */
export function winTier(multiple: number): 'none' | 'big' | 'mega' | 'epic' {
  if (multiple >= 100) return 'epic';
  if (multiple >= 50) return 'mega';
  if (multiple >= 10) return 'big';
  return 'none';
}
