import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { LOCALE, MOCK_TODAY } from "@/lib/constants";

// Formats as they appear in the references. INR and CNY both use Indian digit grouping (₹15,00,000, ¥1,41,000).

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

/** ₹13,77,000 · ₹550.80 (decimals: 2) */
export const formatINR = (value: number, decimals = 0) => signed(value, "₹", decimals);

/** ¥80,000 · "¥ 62,780" (spaced, as on the New order screen) · ¥32.00 (decimals: 2) */
export const formatCNY = (value: number, { decimals = 0, spaced = false } = {}) =>
  signed(value, spaced ? "¥ " : "¥", decimals);

/** ₹42.6 L (lakh short form, dashboard) */
export const formatLakh = (value: number) => `₹${formatNumber(value / 100_000, 1)} L`;

/** Exchange rate: 12.00 */
export const formatRate = (value: number) => formatNumber(value, 2);

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
export const formatToday = (style: "today" | "weekday" = "today") =>
  format(parseISO(MOCK_TODAY), style === "today" ? "'Today', d MMM yyyy" : "EEE, d MMM yyyy");
