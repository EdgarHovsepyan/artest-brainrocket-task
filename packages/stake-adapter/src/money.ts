/** Stake wire money is an integer scaled ×1,000,000; payout multipliers ×100. */
export const WIRE = 1_000_000;

export const toWire = (units: number): number => Math.round(units * WIRE);
export const fromWire = (wire: number): number => wire / WIRE;

/** Convert a ×100 payout multiplier to a real multiple. Uses round, never floor. */
export const multiplierFromX100 = (x100: number): number => Math.round(x100) / 100;
