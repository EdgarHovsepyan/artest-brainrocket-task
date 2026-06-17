export interface CurrencyShape {
  code: string;
  symbol: string;
  position: 'prefix' | 'suffix';
  decimals: number;

  spaced?: boolean;
}

export const CURRENCIES: Record<string, CurrencyShape> = {
  USD: { code: 'USD', symbol: '$', position: 'prefix', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', position: 'suffix', decimals: 2, spaced: true },
  GBP: { code: 'GBP', symbol: '£', position: 'prefix', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', position: 'prefix', decimals: 0 },
  CNY: { code: 'CNY', symbol: '¥', position: 'prefix', decimals: 2 },
  IDR: { code: 'IDR', symbol: 'Rp', position: 'prefix', decimals: 0, spaced: true },
  VND: { code: 'VND', symbol: '₫', position: 'suffix', decimals: 0, spaced: true },
  BTC: { code: 'BTC', symbol: '₿', position: 'prefix', decimals: 8 },
};

export function safeRound(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const mult = Math.pow(10, decimals);
  return (Math.sign(value) * Math.round(Math.abs(value) * mult * (1 + Number.EPSILON))) / mult;
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return decimals > 0 ? '0.' + '0'.repeat(decimals) : '0';
  const rounded = safeRound(value, decimals);
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
}

export function formatMoney(
  value: number,
  currency: string | CurrencyShape,
  maxChars?: number,
): string {
  const c = typeof currency === 'string' ? (CURRENCIES[currency] ?? CURRENCIES.USD) : currency;
  let body = formatNumber(value, c.decimals);
  if (maxChars && body.length > maxChars) body = compactNumber(value, c.decimals);
  const gap = c.spaced ? ' ' : '';
  return c.position === 'prefix' ? `${c.symbol}${gap}${body}` : `${body}${gap}${c.symbol}`;
}

export function compactNumber(value: number, baseDecimals = 2): string {
  if (!Number.isFinite(value)) return baseDecimals > 0 ? '0.' + '0'.repeat(baseDecimals) : '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const fmt = (n: number, suffix: string) => sign + formatNumber(n, n >= 100 ? 0 : 1) + suffix;
  if (abs >= 1e12) return fmt(abs / 1e12, 'T');
  if (abs >= 1e9) return fmt(abs / 1e9, 'B');
  if (abs >= 1e6) return fmt(abs / 1e6, 'M');
  if (abs >= 1e3) return fmt(abs / 1e3, 'K');
  return formatNumber(value, baseDecimals);
}
