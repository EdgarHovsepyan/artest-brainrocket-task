export interface ComplyRules {
  realityCheckMin: number;

  realityCheckSpins: number;

  autoplayMax: number;

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

export interface SessionStats {
  spinsSinceCheck: number;
  startedAtMs: number;
  totalBetCents: number;
  totalWonCents: number;
}

export function newSession(nowMs: number): SessionStats {
  return { spinsSinceCheck: 0, startedAtMs: nowMs, totalBetCents: 0, totalWonCents: 0 };
}

export function recordSpin(s: SessionStats, betCents: number, wonCents: number): SessionStats {
  return {
    ...s,
    spinsSinceCheck: s.spinsSinceCheck + 1,
    totalBetCents: s.totalBetCents + betCents,
    totalWonCents: s.totalWonCents + wonCents,
  };
}

export function realityCheckDue(s: SessionStats, rules: ComplyRules, nowMs: number): boolean {
  const elapsedMin = (nowMs - s.startedAtMs) / 60000;
  return s.spinsSinceCheck >= rules.realityCheckSpins || elapsedMin >= rules.realityCheckMin;
}

export function ackRealityCheck(s: SessionStats, nowMs: number): SessionStats {
  return { ...s, spinsSinceCheck: 0, startedAtMs: nowMs };
}

export function sessionNetCents(s: SessionStats): number {
  return s.totalWonCents - s.totalBetCents;
}
