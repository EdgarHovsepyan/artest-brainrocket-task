export type SymbolId = number;

export type Grid = SymbolId[][];

export interface LineWin {
  lineIndex: number;

  symbol: SymbolId;

  count: number;

  payout: number;
}

export interface SpinResult {
  grid: Grid;

  lineWins: LineWin[];

  totalPayout: number;

  scatters: number;

  scatterPay: number;

  freeSpins: number;
}
