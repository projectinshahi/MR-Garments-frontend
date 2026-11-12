import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { LOCALE, MOCK_TODAY } from "@/lib/constants";
import { currencyLabel, currencySymbol, currencyTitle, minorUnits, orderedCurrencies } from "@/lib/currencies";
import type { Currency, MoneyTotal } from "@/types/domain";

// Formats as they appear in the references. Every currency uses Indian digit grouping (₹15,00,000, ¥1,41,000, $1,200).

const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, decimals = 0) {
  let nf = numberFormats.get(decimals);
  if (!nf) {
    nf = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, nf);
  }
  return nf.format(value);
}

const signed = (value: number, symbol: string, decimals: number) =>
  `${value < 0 ? "−" : ""}${symbol}${formatNumber(Math.abs(value), decimals)}`;

// On screen an amount shows its symbol (lib/currencies: ¥, $, ₹, €, "A$", or the code of a currency without one);
// selects and labels add the code ("USD ($)"), files use the code alone.
export { currencyLabel, currencySymbol, currencyTitle };

type MoneyOptions = { decimals?: number; spaced?: boolean };

/**
 * ¥80,000 · "$ 62,780" (spaced, as on the New order screen) · ₹32.00 (decimals: 2) · "AED 1,200" (a code stands apart
 * from the number) · "JPY 1,000" even with decimals: 2 (a whole amount gets no more decimals than the currency's minor
 * unit), but "JPY 999.50": amounts are stored with 2 decimals, and a stored fraction is never hidden. One formatter for
 * every currency.
 */
export const formatMoney = (value: number, currency: Currency, { decimals = 0, spaced = false }: MoneyOptions = {}) => {
  const symbol = currencySymbol(currency);
  const apart = spaced || /[A-Za-z]$/.test(symbol);
  const units = minorUnits(currency);
  return signed(value, apart ? `${symbol} ` : symbol, Number.isInteger(value * 10 ** units) ? Math.min(decimals, units) : decimals);
};

/** ₹13,77,000 · ₹550.80 (decimals: 2) */
export const formatINR = (value: number, decimals = 0) => formatMoney(value, "INR", { decimals });

/** ¥80,000 · "¥ 62,780" (spaced) · ¥32.00 (decimals: 2) */
export const formatCNY = (value: number, options: MoneyOptions = {}) => formatMoney(value, "CNY", options);

/**
 * One total per currency (CNY, USD, INR, then the rest by code), for the currencies the rows have: amounts in
 * different currencies are never added together. Rounded to the cent, as the API rounds.
 */
export function sumByCurrency<T>(rows: T[], currencyOf: (row: T) => Currency, amountOf: (row: T) => number): MoneyTotal[] {
  return orderedCurrencies(rows.map(currencyOf)).map((currency) => ({
    currency,
    amount: Math.round(rows.reduce((sum, row) => sum + (currencyOf(row) === currency ? amountOf(row) : 0), 0) * 100) / 100,
  }));
}

/** "¥80,000 · $1,200": each currency apart, zeros left out; "¥0" (or `empty`'s symbol) when nothing is left. */
export function formatMoneyList(totals: MoneyTotal[], options: MoneyOptions = {}, empty: Currency = "CNY") {
  const shown = totals.filter((total) => total.amount !== 0);
  if (shown.length === 0) return formatMoney(0, totals[0]?.currency ?? empty, options);
  return shown.map((total) => formatMoney(total.amount, total.currency, options)).join(" · ");
}

/** ₹42.6 L (lakh short form, dashboard) */
export const formatLakh = (value: number) => `₹${formatNumber(value / 100_000, 1)} L`;

/** Exchange rate: 12.00 */
export const formatRate = (value: number) => formatNumber(value, 2);

/** A supplier's or order's INR rate: ₹12.50, or ₹11.8765 when it was typed with more decimals (at most 4). */
export const formatRateInr = (rate: number) => formatINR(rate, Math.max(2, Math.min(4, (String(rate).split(".")[1] ?? "").length)));
/** "1 CNY = ₹12.50": the rate with its direction, as the supplier form, the lists and the reports say it. */
export const rateText = (currency: Currency, rate: number) => `1 ${currency} = ${formatRateInr(rate)}`;

/** 2,400 m · 1,800 pcs · 30,000 sets */
export const formatQty = (value: number, unit: string) => `${formatNumber(value)} ${unit}`;

const toDate = (value: string | Date) => (typeof value === "string" ? parseISO(value) : value);

/** 30 Sep 2026 */
export const formatDate = (value: string | Date) => format(toDate(value), "d MMM yyyy");

/** 26 Sep */
export const formatShortDate = (value: string | Date) => format(toDate(value), "d MMM");

/** 3 Oct 2026, 16:10 */
export const formatDateTime = (value: string | Date) => format(toDate(value), "d MMM yyyy, HH:mm");

/** Today, 09:12 · Yesterday, 17:05 · 26 Sep, 14:02 (relative to MOCK_TODAY) */
export function formatRelativeDateTime(value: string | Date) {
  const date = toDate(value);
  const days = differenceInCalendarDays(parseISO(MOCK_TODAY), date);
  const time = format(date, "HH:mm");
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${format(date, "d MMM")}, ${time}`;
}

/** "Today, 30 Sep 2026" (dashboard, calendar) or "Wed, 30 Sep 2026" (staff home) */
/** Mock screens are snapshots on MOCK_TODAY; live screens pass the real date (todayInIndia). */
export const formatToday = (style: "today" | "weekday" = "today", today = MOCK_TODAY) =>
  format(parseISO(today), style === "today" ? "'Today', d MMM yyyy" : "EEE, d MMM yyyy");
