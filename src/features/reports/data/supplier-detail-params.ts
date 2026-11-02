import { isValid, parseISO } from "date-fns";

import { isMonth, monthRange } from "./filters";

// The supplier detail's URL (?period, ?supplier kept for the way back, ?paymentFrom, ?paymentTo, ?stage and a page per
// list) turned into the strict API query (from, to, paymentFrom, paymentTo, stage, paymentsPage, ordersPage, linesPage).
// Malformed values are left out, so a hand-edited URL shows the unfiltered list instead of a 400.

export const PAGE_PARAMS = { payments: "paymentsPage", orders: "ordersPage", lines: "linesPage" } as const;

const isDay = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));

export function detailQuery(params: URLSearchParams) {
  const period = params.get("period");
  const query = new URLSearchParams(isMonth(period) ? monthRange(period) : {});
  let from = params.get("paymentFrom");
  let to = params.get("paymentTo");
  // The API refuses paymentFrom > paymentTo; swapped, the range holds the same days.
  if (isDay(from) && isDay(to) && from > to) [from, to] = [to, from];
  if (isDay(from)) query.set("paymentFrom", from);
  if (isDay(to)) query.set("paymentTo", to);
  const stage = params.get("stage");
  if (stage && /^[1-6]$/.test(stage)) query.set("stage", stage);
  // Six digits at most: beyond that the API's whole-number check could fail, and no list is that long.
  for (const key of Object.values(PAGE_PARAMS)) {
    const page = params.get(key);
    if (page && /^[1-9]\d{0,5}$/.test(page)) query.set(key, page);
  }
  return query.size ? `?${query}` : "";
}

/** The query `search` with `changes` applied (null removes a key), keeping every other parameter. */
export function withParams(search: string, changes: Record<string, string | null>) {
  const next = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next.toString();
}
