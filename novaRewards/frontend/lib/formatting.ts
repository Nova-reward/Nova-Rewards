/**
 * Single source of truth for formatting NOVA token amounts across all components.
 * 
 * Requirements (Issue #852):
 * - Format Stellar token amounts using 7 decimal places by default.
 * - Use locale-aware thousands separators (Intl.NumberFormat).
 * - Display values smaller than 0.0000001 as: '< 0.0000001' (or '-< 0.0000001' for negative).
 * - Efficiently cache Intl.NumberFormat instances to prevent performance overhead.
 * - Handle zero, negative values, large values, string/number inputs, null/undefined, and invalid values gracefully.
 */

export interface FormatTokenAmountOptions {
  /** Number of decimal places. Defaults to 7. */
  decimals?: number;
  /** BCP 47 language tag / locale string. Defaults to 'en-US'. */
  locale?: string;
  /** Fallback string returned when input is invalid, null, or undefined. Default formats 0 with decimals. */
  fallback?: string;
  /** Custom threshold string override for values below minimum display precision. */
  thresholdDisplay?: string;
}

const DEFAULT_DECIMALS = 7;
const DEFAULT_LOCALE = 'en-US';

// Cache Intl.NumberFormat instances for maximum performance during frequent re-renders
const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Generates the threshold display string for tiny amounts (e.g. "< 0.0000001")
 */
function getThresholdString(decimals: number): string {
  if (decimals <= 0) return '0';
  return `0.${'0'.repeat(decimals - 1)}1`;
}

/**
 * Formats a raw or string NOVA token amount into a standard, locale-aware display string.
 *
 * @param value Token amount as string, number, null, or undefined
 * @param options Formatting configuration options
 * @returns Formatted token amount string
 */
export function formatTokenAmount(
  value: number | string | null | undefined,
  options: FormatTokenAmountOptions = {}
): string {
  const decimals = options.decimals ?? DEFAULT_DECIMALS;
  const locale = options.locale ?? DEFAULT_LOCALE;

  const formatter = getFormatter(locale, decimals);

  if (value === null || value === undefined || value === '') {
    return options.fallback ?? formatter.format(0);
  }

  const num = typeof value === 'number' ? value : Number(value);

  if (isNaN(num)) {
    return options.fallback ?? formatter.format(0);
  }

  if (num === 0) {
    return formatter.format(0);
  }

  const threshold = Math.pow(10, -decimals);
  const thresholdStr = options.thresholdDisplay ?? getThresholdString(decimals);

  if (num > 0 && num < threshold) {
    return `< ${thresholdStr}`;
  }

  if (num < 0 && num > -threshold) {
    return `-< ${thresholdStr}`;
  }

  return formatter.format(num);
}

export default formatTokenAmount;
