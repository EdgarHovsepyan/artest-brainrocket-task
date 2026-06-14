// Pure game-logic types. NO Cocos imports here — this layer stays engine-agnostic
// so it can be unit-tested and RTP-simulated outside the editor.

/** Symbol identifier. 0 = Wild (substitutes for all other symbols). */
export type SymbolId = number;

/** Grid is indexed [reelIndex][rowIndex]. 5 reels x 3 rows for this game. */
export type Grid = SymbolId[][];

/** A single winning payline result. */
export interface LineWin {
  /** 0-based index into PAYLINES. */
  lineIndex: number;
  /** Winning symbol after Wild resolution. */
  symbol: SymbolId;
  /** Number of matched reels from the left (3..5). */
  count: number;
  /** Payout expressed in line-bet multiples (raw paytable value). */
  payout: number;
}

/** Full evaluated result of one spin. */
export interface SpinResult {
  /** Visible symbols, indexed [reelIndex][rowIndex]. */
  grid: Grid;
  /** All winning lines (left-to-right). Empty if no win. */
  lineWins: LineWin[];
  /** Sum of all line payouts, in line-bet multiples. */
  totalPayout: number;
  /** SCATTER symbols anywhere on the grid this spin. */
  scatters: number;
  /** Flat scatter pay in line-bet multiples (0 below SCATTER_MIN). NOT
   *  WILD-STRIKE-multiplied. */
  scatterPay: number;
  /** Free spins awarded by the scatters this spin (0 = no trigger). */
  freeSpins: number;
}
