// Translation + currency service. Locale and currency arrive via URL params
// (?lang=, ?currency=) — the casino platform passes them. Social mode (?social=true)
// swaps gambling terms for sweepstakes-safe copy.

type Dict = Record<string, string>;

const STRINGS: Record<string, Dict> = {
  en: {
    spin: 'SPIN',
    turbo: 'TURBO',
    auto: 'AUTO',
    sound: 'SOUND',
    muted: 'MUTED',
    buy: 'BUY FREE SPINS',
    balance: 'BALANCE',
    bet: 'BET',
    win: 'WIN',
    freeSpins: 'FREE SPINS',
    bigWin: 'BIG WIN',
    megaWin: 'MEGA WIN',
    epicWin: 'EPIC WIN',
    featureWon: 'FEATURE WON',
  },
  ru: {
    spin: 'СПИН',
    turbo: 'ТУРБО',
    auto: 'АВТО',
    sound: 'ЗВУК',
    muted: 'БЕЗ ЗВУКА',
    buy: 'КУПИТЬ ФРИСПИНЫ',
    balance: 'БАЛАНС',
    bet: 'СТАВКА',
    win: 'ВЫИГРЫШ',
    freeSpins: 'ФРИСПИНЫ',
    bigWin: 'БОЛЬШОЙ ВЫИГРЫШ',
    megaWin: 'МЕГА ВЫИГРЫШ',
    epicWin: 'ЭПИК ВЫИГРЫШ',
    featureWon: 'ФУНКЦИЯ ВЫИГРАНА',
  },
  de: {
    spin: 'DREHEN',
    turbo: 'TURBO',
    auto: 'AUTO',
    sound: 'TON',
    muted: 'STUMM',
    buy: 'FREISPIELE KAUFEN',
    balance: 'GUTHABEN',
    bet: 'EINSATZ',
    win: 'GEWINN',
    freeSpins: 'FREISPIELE',
    bigWin: 'GROSSER GEWINN',
    megaWin: 'MEGA GEWINN',
    epicWin: 'EPISCHER GEWINN',
    featureWon: 'FEATURE GEWONNEN',
  },
};

const SOCIAL: Dict = { buy: 'GET FREE SPINS', bet: 'PLAY', win: 'WIN' };

export class I18n {
  private dict: Dict;
  private readonly currency: string;
  private readonly social: boolean;

  constructor(params: URLSearchParams) {
    const lang = (params.get('lang') ?? 'en').toLowerCase().slice(0, 2);
    this.dict = STRINGS[lang] ?? STRINGS.en;
    this.currency = (params.get('currency') ?? 'USD').toUpperCase().slice(0, 6);
    this.social = params.get('social') === 'true';
  }

  t(key: keyof typeof STRINGS.en): string {
    if (this.social && key in SOCIAL) return SOCIAL[key];
    return this.dict[key] ?? STRINGS.en[key] ?? String(key);
  }

  /** Format a money amount (major units) with the active currency. No hardcoded $. */
  money(amount: number): string {
    const n = amount.toFixed(2);
    if (this.social) return `${n} GC`;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: this.currency,
      }).format(amount);
    } catch {
      return `${n} ${this.currency}`;
    }
  }
}
