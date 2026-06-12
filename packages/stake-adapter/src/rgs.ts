import { createRng, generateOutcomeBooks } from '@artest/math-core';
import type { BookRow, GameEvent, LookupRow, SlotMathConfig } from '@artest/math-core';

export interface PlayResult {
  bookId: number;
  /** Win as a multiple of total bet, ×100 (integer) — never recomputed by the client. */
  payoutMultiplier: number;
  events: GameEvent[];
}

/** The Stake contract from the client's side: the server decides, the client plays back. */
export interface RgsClient {
  play(mode?: string): Promise<PlayResult>;
}

/**
 * In-memory RGS for local dev / replay: samples a lookup row by weight and
 * returns the matching book's events — exactly what the real RGS does, so the
 * frontend code path is identical offline and online.
 */
export class MockRgs implements RgsClient {
  private readonly rng = createRng(0xc0ffee);
  private readonly byId = new Map<number, BookRow>();
  private readonly totalWeight: number;

  constructor(
    private readonly lookup: LookupRow[],
    books: BookRow[],
  ) {
    for (const b of books) this.byId.set(b.id, b);
    this.totalWeight = lookup.reduce((s, r) => s + r.weight, 0);
  }

  async play(): Promise<PlayResult> {
    let roll = this.rng.next() * this.totalWeight;
    let chosen = this.lookup[this.lookup.length - 1];
    for (const row of this.lookup) {
      roll -= row.weight;
      if (roll <= 0) {
        chosen = row;
        break;
      }
    }
    const book = this.byId.get(chosen.simIdx)!;
    return { bookId: book.id, payoutMultiplier: book.payoutMultiplier, events: book.events };
  }
}

/** One round the frontend plays back. The client never recomputes the payout. */
export interface RoundOutcome {
  mode: string;
  /** Win as a multiple of total bet, ×100 (integer). */
  payoutMultiplier: number;
  events: GameEvent[];
}

/** What a game's view layer talks to — same shape for mock and real RGS. */
export interface OutcomeSource {
  play(mode?: string): Promise<RoundOutcome>;
  endRound(): Promise<void>;
}

/** Multi-mode book sampler — the dev/offline RGS. Same code path as production. */
export class BookRgs implements OutcomeSource {
  private readonly rng: ReturnType<typeof createRng>;
  private readonly modes = new Map<
    string,
    { lookup: LookupRow[]; byId: Map<number, BookRow>; total: number }
  >();

  constructor(seed = 0xc0ffee) {
    this.rng = createRng(seed);
  }

  add(mode: string, lookup: LookupRow[], books: BookRow[]): this {
    const byId = new Map(books.map((b) => [b.id, b]));
    this.modes.set(mode, { lookup, byId, total: lookup.reduce((s, r) => s + r.weight, 0) });
    return this;
  }

  async play(mode = 'base'): Promise<RoundOutcome> {
    const m = this.modes.get(mode) ?? this.modes.get('base');
    if (!m) throw new Error(`BookRgs: no mode "${mode}"`);
    let roll = this.rng.next() * m.total;
    let chosen = m.lookup[m.lookup.length - 1];
    for (const row of m.lookup) {
      roll -= row.weight;
      if (roll <= 0) {
        chosen = row;
        break;
      }
    }
    const book = m.byId.get(chosen.simIdx)!;
    return { mode, payoutMultiplier: book.payoutMultiplier, events: book.events };
  }

  async endRound(): Promise<void> {}
}

export interface LocalSourceSpec {
  mode: string;
  count: number;
  seed?: number;
  forceFreeSpins?: number;
}

/** Build a dev RGS by generating a small book sample per mode in-memory. */
export function createLocalSource(
  config: SlotMathConfig,
  specs: LocalSourceSpec[],
  seed = 0xc0ffee,
): BookRgs {
  const rgs = new BookRgs(seed);
  for (const s of specs) {
    const ob = generateOutcomeBooks(config, {
      mode: s.mode,
      count: s.count,
      seed: s.seed,
      forceFreeSpins: s.forceFreeSpins,
    });
    rgs.add(s.mode, ob.lookup, ob.books);
  }
  return rgs;
}

/**
 * Minimal real RGS client (production). `rgsUrl` arrives WITHOUT a scheme and is
 * normalised. Money is X6 on the wire. The client only plays back what the server
 * decides; it never recomputes a payout.
 */
export class HttpRgs implements OutcomeSource {
  private readonly base: string;
  private sessionId = '';

  constructor(
    rgsUrl: string,
    private readonly game: string,
    private readonly currency = 'USD',
  ) {
    this.base = rgsUrl.startsWith('http') ? rgsUrl : `https://${rgsUrl}`;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`RGS ${path} → ${res.status}`);
    return res.json();
  }

  async authenticate(): Promise<void> {
    const data = (await this.post('/wallet/authenticate', {
      game: this.game,
      currency: this.currency,
    })) as { sessionID?: string };
    this.sessionId = data.sessionID ?? '';
  }

  async play(mode = 'base'): Promise<RoundOutcome> {
    const data = (await this.post('/wallet/play', { sessionID: this.sessionId, mode })) as {
      round?: { payoutMultiplier?: number; state?: GameEvent[] };
    };
    return {
      mode,
      payoutMultiplier: data.round?.payoutMultiplier ?? 0,
      events: data.round?.state ?? [],
    };
  }

  async endRound(): Promise<void> {
    await this.post('/wallet/end-round', { sessionID: this.sessionId });
  }
}
