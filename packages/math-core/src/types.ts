/** Symbol identifier. By convention `wildId` (default 0) substitutes for all others. */
export type SymbolId = number;

/** Visible symbols, indexed [reel][row]. */
export type Grid = SymbolId[][];

/** Reel composition: how many copies of each symbol sit on one reel strip. */
export type ReelWeights = Record<SymbolId, number>;

/** Payout per match count, e.g. { 3: 50, 4: 500, 5: 1000 }. In line-bet multiples. */
export type SymbolPayouts = Record<number, number>;

/** Payout table keyed by symbol id. */
export type Paytable = Record<SymbolId, SymbolPayouts>;

/** Scatter symbol: pays from anywhere and/or triggers free spins by count. */
export interface ScatterConfig {
  id: SymbolId;
  /** Pay by scatter count, as a multiple of TOTAL bet (e.g. { 3: 2, 4: 9, 5: 48 }). */
  pays?: Record<number, number>;
  /** Free spins awarded by scatter count (e.g. { 3: 10, 4: 12, 5: 15 }). */
  triggers?: Record<number, number>;
}

/** Free-spins feature parameters. */
export interface FeatureConfig {
  /** Global multiplier applied to every line win during free spins. */
  multiplier: number;
  /** Scatter count that retriggers; 0 disables retrigger. */
  retriggerScatters: number;
  /** Extra spins awarded on retrigger. */
  retriggerSpins: number;
  /** Hard cap on total free spins played. */
  cap: number;
}

/** WILD STRIKE: when >= minWilds wilds land, multiply the spin's line wins. */
export interface WildStrikeConfig {
  minWilds: number;
  /** A fixed multiplier, or 'count' to use the wild count itself. */
  multiplier: number | 'count';
  /** Optional cap when multiplier is 'count'. */
  maxMultiplier?: number;
}

/** Win-to-total-bet thresholds for ceremony tiers, ascending. */
export interface WinTierThresholds {
  /** [returned(<=), win, nice, big, mega] — anything >= last is "epic". */
  steps: [number, number, number, number, number];
}

/** Everything the pure math needs. Engine-agnostic and serializable. */
export interface SlotMathConfig {
  reels: number;
  rows: number;
  /** Symbol that substitutes for all others. */
  wildId: SymbolId;
  paytable: Paytable;
  /** Each entry has length `reels`; values are row indices in [0, rows). */
  paylines: number[][];
  /** One weight map per reel (length `reels`). */
  reelWeights: ReelWeights[];
  /** Optional scatter (pays + free-spin triggers). */
  scatter?: ScatterConfig;
  /** Optional free-spins feature. */
  feature?: FeatureConfig;
  /** Optional WILD STRIKE base-game multiplier. */
  wildStrike?: WildStrikeConfig;
  /** Hard cap on a round's win, as a multiple of TOTAL bet (e.g. 5000). */
  maxWinX?: number;
}

export interface LineWin {
  /** Index into `paylines`. */
  lineIndex: number;
  /** Winning symbol after Wild resolution. */
  symbol: SymbolId;
  /** Matched reels from the left (>= 3). */
  count: number;
  /** Payout in line-bet multiples. */
  payout: number;
}

export interface SpinResult {
  grid: Grid;
  lineWins: LineWin[];
  /** Sum of all line payouts, in line-bet multiples. */
  totalPayout: number;
}
