// Jurisdiction compliance thresholds — pure TypeScript, NO Cocos. Mirrors the
// flagship COMPLY table (the rows that affect the Cocos feature set). The active
// jurisdiction would be chosen by the platform; INT is the open default.

export interface ComplyRules {
  /** Minutes of session time before a Reality Check is forced. */
  realityCheckMin: number;
  /** Spins since the last check before a Reality Check is forced. */
  realityCheckSpins: number;
  /** Max autoplay count (Infinity = uncapped, 0 = autoplay disabled). */
  autoplayMax: number;
  /** A return <= 1x bet must not play triumphant audio/visual (LDW). */
  allowLdwCelebration: boolean;
}

export const JURISDICTIONS: Record<string, ComplyRules> = {
  INT: {
    realityCheckMin: 30,
    realityCheckSpins: 100,
    autoplayMax: Infinity,
    allowLdwCelebration: true,
  },
  UKGC: {
    realityCheckMin: 30,
    realityCheckSpins: 100,
    autoplayMax: 250,
    allowLdwCelebration: false,
  },
  MGA: { realityCheckMin: 60, realityCheckSpins: 150, autoplayMax: 100, allowLdwCelebration: true },
  SE: { realityCheckMin: 60, realityCheckSpins: 100, autoplayMax: 0, allowLdwCelebration: false },
  DE: { realityCheckMin: 60, realityCheckSpins: 150, autoplayMax: 0, allowLdwCelebration: false },
  US: {
    realityCheckMin: 60,
    realityCheckSpins: 200,
    autoplayMax: Infinity,
    allowLdwCelebration: true,
  },
};

export const DEFAULT_JURISDICTION = 'INT';

export function getComply(code?: string): ComplyRules {
  return JURISDICTIONS[code ?? DEFAULT_JURISDICTION] ?? JURISDICTIONS[DEFAULT_JURISDICTION];
}

/** Mutable per-session counters the controller feeds; pure helpers below. */
export interface SessionStats {
  spinsSinceCheck: number;
  startedAtMs: number;
  totalBetCents: number;
  totalWonCents: number;
}

export function newSession(nowMs: number): SessionStats {
  return { spinsSinceCheck: 0, startedAtMs: nowMs, totalBetCents: 0, totalWonCents: 0 };
}

/** Record one settled spin into the session. */
export function recordSpin(s: SessionStats, betCents: number, wonCents: number): SessionStats {
  return {
    ...s,
    spinsSinceCheck: s.spinsSinceCheck + 1,
    totalBetCents: s.totalBetCents + betCents,
    totalWonCents: s.totalWonCents + wonCents,
  };
}

/** Has the player crossed a Reality Check threshold (time OR spins)? */
export function realityCheckDue(s: SessionStats, rules: ComplyRules, nowMs: number): boolean {
  const elapsedMin = (nowMs - s.startedAtMs) / 60000;
  return s.spinsSinceCheck >= rules.realityCheckSpins || elapsedMin >= rules.realityCheckMin;
}

/** Reset the check counters after the player acknowledges (CONTINUE). */
export function ackRealityCheck(s: SessionStats, nowMs: number): SessionStats {
  return { ...s, spinsSinceCheck: 0, startedAtMs: nowMs };
}

export function sessionNetCents(s: SessionStats): number {
  return s.totalWonCents - s.totalBetCents;
}
