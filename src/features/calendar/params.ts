import { addDays, addMonths, addWeeks, format, isValid, parseISO, startOfWeek } from "date-fns";

import type { FilterOption } from "@/components/shared/filters";

import { type Delivery, isoDay, MONDAY, supplierOptions } from "./deliveries";

// The calendar's URL: ?month=YYYY-MM (Month), ?week=YYYY-MM-DD (Week, its Monday), ?supplier= (every view) and
// ?range= (List). Missing, invalid or unknown values fall back to today's period and to "all", never to an error.

/** A page's `searchParams`, as Next passes them. */
export type SearchParams = Record<string, string | string[] | undefined>;

export const RANGE_OPTIONS: FilterOption[] = [
  { value: "all", label: "All dates" },
  { value: "next-7", label: "Next 7 days" },
  { value: "next-30", label: "Next 30 days" },
];
const RANGE_DAYS: Partial<Record<string, number>> = { "next-7": 7, "next-30": 30 };

/** The parameters the Month/Week/List tabs carry over: the filters, not the period. */
const FILTERS = ["supplier", "range"];

/** Server pages read `searchParams`; client components read `useSearchParams()`. Both end up as URLSearchParams. */
export function toParams(search: SearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) for (const v of [value ?? []].flat()) params.append(key, v);
  return params;
}

/** The date in `value` only when it is written exactly as `pattern` ("2026-02-30" and "2026-1" are invalid). */
function parseExact(value: string | null, pattern: string) {
  const date = value ? parseISO(value) : undefined;
  return date && isValid(date) && format(date, pattern) === value ? date : undefined;
}

/** First day of the month shown: `?month=YYYY-MM`, else today's month. */
export const monthParam = (params: URLSearchParams, today: string) =>
  `${format(parseExact(params.get("month"), "yyyy-MM") ?? parseISO(today), "yyyy-MM")}-01`;

/** Monday of the week shown: the week holding `?week=YYYY-MM-DD`, else today's week. */
export const weekParam = (params: URLSearchParams, today: string) =>
  isoDay(startOfWeek(parseExact(params.get("week"), "yyyy-MM-dd") ?? parseISO(today), MONDAY));

/** A select's value in the URL: one of its options, else "all". */
export const optionParam = (params: URLSearchParams, key: string, options: FilterOption[]) =>
  options.find((option) => option.value === params.get(key))?.value ?? "all";

/** The supplier (one present in CAL-1) and the List date range in the URL, "all" when missing or unknown. */
export const readFilters = (params: URLSearchParams, deliveries: Delivery[]) => ({
  supplier: optionParam(params, "supplier", supplierOptions(deliveries)),
  range: optionParam(params, "range", RANGE_OPTIONS),
});

/** One supplier's deliveries ("all": everyone's), due within the range: today to today + N days, inclusive. */
export function filterDeliveries(deliveries: Delivery[], today: string, supplier: string, range = "all") {
  const days = RANGE_DAYS[range];
  const last = days === undefined ? undefined : isoDay(addDays(parseISO(today), days));
  return deliveries.filter(
    (d) => (supplier === "all" || d.supplier === supplier) && (last === undefined || (d.due >= today && d.due <= last)),
  );
}

/** `pathname` with `key` set to `value` (removed when null), keeping every other parameter. */
export function hrefWith(pathname: string, params: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** The query the Month/Week/List tabs carry: "supplier=…&range=…". */
export const filterQuery = (params: URLSearchParams) =>
  new URLSearchParams([...params].filter(([key]) => FILTERS.includes(key))).toString();

const periodLinks = (pathname: string, params: URLSearchParams, key: string, previous: string, next: string) => ({
  previous: hrefWith(pathname, params, key, previous),
  next: hrefWith(pathname, params, key, next),
  today: hrefWith(pathname, params, key, null),
});

export type PeriodLinks = ReturnType<typeof periodLinks>;

/** ‹ › and Today on the Month view: the months either side of `month`, and today's month. */
export function monthLinks(params: URLSearchParams, month: string) {
  const first = parseISO(month);
  return periodLinks("/calendar", params, "month", format(addMonths(first, -1), "yyyy-MM"), format(addMonths(first, 1), "yyyy-MM"));
}

/** ‹ › and Today on the Week view: the Mondays either side of `monday`, and today's week. */
export function weekLinks(params: URLSearchParams, monday: string) {
  const start = parseISO(monday);
  return periodLinks("/calendar/week", params, "week", isoDay(addWeeks(start, -1)), isoDay(addWeeks(start, 1)));
}
