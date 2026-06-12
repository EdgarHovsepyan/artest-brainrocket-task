import {
  generateOutcomeBooks,
  buildIndex,
  toLookupCsv,
  toBooksJsonl,
  rtpFromLookup,
} from '@artest/math-core';
import type { SlotMathConfig } from '@artest/math-core';

/** One playable mode to publish (base, or a buy/feature mode). */
export interface ModeSpec {
  name: string;
  /** Cost as a multiple of total bet (base = 1). */
  cost: number;
  /** Number of rounds to simulate into the book. */
  count: number;
  seed?: number;
  /** Buy mode: every round is a free-spins sequence of this many spins. */
  forceFreeSpins?: number;
}

export interface MathFile {
  name: string;
  content: string;
}

/** The Stake "Math" upload: index.json + lookUpTable_*.csv + books_*.jsonl. */
export interface MathPackage {
  indexJson: string;
  files: MathFile[];
  rtpByMode: Record<string, number>;
}

/**
 * Build the Stake math artifacts for a game from its SlotMathConfig. Pure (no fs)
 * so it's testable; a game's package script writes the files to stake-build/back/.
 */
export function buildMathArtifacts(config: SlotMathConfig, modes: ModeSpec[]): MathPackage {
  const files: MathFile[] = [];
  const rtpByMode: Record<string, number> = {};
  const built = modes.map((m) => {
    const ob = generateOutcomeBooks(config, {
      mode: m.name,
      cost: m.cost,
      count: m.count,
      seed: m.seed,
      forceFreeSpins: m.forceFreeSpins,
    });
    files.push({ name: `lookUpTable_${m.name}_0.csv`, content: toLookupCsv(ob.lookup) });
    files.push({ name: `books_${m.name}_0.jsonl`, content: toBooksJsonl(ob.books) });
    rtpByMode[m.name] = rtpFromLookup(ob.lookup) / (m.cost || 1);
    return { books: ob, idx: 0 };
  });
  return { indexJson: JSON.stringify(buildIndex(built), null, 2), files, rtpByMode };
}
