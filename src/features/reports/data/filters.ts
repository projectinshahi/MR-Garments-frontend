import { addMonths, endOfMonth, format, parseISO } from "date-fns";
import { z } from "zod";

import type { FilterOption } from "@/components/shared/filters";

// The URL filters of the Reports hub and reports (?period=YYYY-MM, ?supplier=<id>) and of Landed Cost (?supplier=,
// ?team=), turned into the API's query (from, to, supplierId, teamId). Missing or malformed values are left out, so a
// hand-edited URL shows the unfiltered page instead of an error.

export const isId = (value: string | null): value is string => z.uuid().safeParse(value).success;
const isMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const asQuery = (query: URLSearchParams) => (query.size ? `?${query}` : "");

/** The well-formed ids among `keys` (URL key -> API key), as an API query: "" or "?supplierId=…". */
export function idQuery(params: URLSearchParams, keys: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, apiKey] of Object.entries(keys)) {
    const value = params.get(key);
    if (isId(value)) query.set(apiKey, value);
  }
  return asQuery(query);
}

/** First and last day of a YYYY-MM month. */
const monthRange = (month: string) => ({ from: `${month}-01`, to: format(endOfMonth(parseISO(`${month}-01`)), "yyyy-MM-dd") });

/** The reports' API query: `?period=` becomes from/to of that month, `?supplier=` the supplierId. */
export function reportQuery(params: URLSearchParams) {
  const period = params.get("period");
  const query = new URLSearchParams(isMonth(period) ? monthRange(period) : {});
  const supplier = params.get("supplier");
  if (isId(supplier)) query.set("supplierId", supplier);
  return asQuery(query);
}

/** The page's own filters (period, supplier) as a query string for links between the hub and the reports. */
export const filterQuery = (params: URLSearchParams) => asQuery(new URLSearchParams([...params].filter(([key]) => key === "period" || key === "supplier")));

/** "1 Sep – 30 Sep 2026" for 2026-09. */
export function periodLabel(month: string) {
  const { from, to } = monthRange(month);
  return `${format(parseISO(from), "d MMM")} – ${format(parseISO(to), "d MMM yyyy")}`;
}

/** The hub's Period options: all dates, then this month and the 11 before it. */
export function periodOptions(today: string): FilterOption[] {
  const months = Array.from({ length: 12 }, (_, index) => format(addMonths(parseISO(today), -index), "yyyy-MM"));
  return [{ value: "all", label: "All dates" }, ...months.map((month) => ({ value: month, label: periodLabel(month) }))];
}

/** The header pill of a filtered report: "1 Sep – 30 Sep 2026 · Foshan Fabrics", or null when unfiltered. */
export function filterLabel({ from, supplier }: { from: string | null; supplier: string | null }) {
  const parts = [from ? periodLabel(from.slice(0, 7)) : null, supplier].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
