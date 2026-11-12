import { isValid, parseISO } from "date-fns";

import type { FilterOption } from "@/components/shared/filters";
import type { OrderReportsResponse, OrderState, PaymentState } from "@/lib/api/reports-types";
import { currencyTitle, formatDate } from "@/lib/formatters";
import { orderedCurrencies, PREFERRED_CURRENCIES } from "@/lib/currencies";
import { STAGES } from "@/types/domain";

import { isId, isMonth, monthRange } from "../data/filters";

// The Order reports page's URL (?po, ?supplier, ?from, ?to, ?status, ?warehouse, ?paymentStatus; ?period=YYYY-MM from
// the hub stands in for from/to) turned into RPT-O2's strict query. Malformed values are left out, so a hand-edited
// URL shows the unfiltered list instead of a 400.

export const PO_PARAM = "po";
/** The supplier-name text filter (a part of the name); ?supplier= stays the id select. */
export const SUPPLIER_PARAM = "supplierName";
export const DATE_PARAMS = ["from", "to"] as const;

const ORDER_STATES: OrderState[] = ["pending", "active", "closed"];
const PAYMENT_STATES: PaymentState[] = ["unpaid", "partly", "paid"];
const STATE_LABEL: Record<OrderState, string> = { pending: "Pending", active: "Active", closed: "Closed" };
const PAYMENT_LABEL: Record<PaymentState, string> = { unpaid: "Unpaid", partly: "Partly paid", paid: "Paid" };

export const STATUS_OPTIONS: FilterOption[] = [{ value: "all", label: "All statuses" }, ...ORDER_STATES.map((value) => ({ value, label: STATE_LABEL[value] }))];
export const PAYMENT_OPTIONS: FilterOption[] = [{ value: "all", label: "Any payment status" }, ...PAYMENT_STATES.map((value) => ({ value, label: PAYMENT_LABEL[value] }))];
/** The shipment status filter: the order's stage. */
export const STAGE_OPTIONS: FilterOption[] = [{ value: "all", label: "Any stage" }, ...STAGES.map((name, index) => ({ value: String(index + 1), label: `${index + 1}. ${name}` }))];
/** The currency filter: CNY, USD, INR and every other currency the listed orders are in. */
export const currencyOptions = (present: string[]): FilterOption[] => [
  { value: "all", label: "Any currency" },
  ...orderedCurrencies([...PREFERRED_CURRENCIES, ...present]).map((currency) => ({ value: currency, label: currencyTitle(currency) })),
];

const isDay = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
const oneOf = <T extends string>(values: readonly T[], value: string | null): value is T => values.includes(value as T);

/** The API query ("" or "?po=…&supplierId=…"). A swapped date range holds the same days, so it is put the right way round. */
export function orderReportsQuery(params: URLSearchParams) {
  const query = new URLSearchParams();
  const po = params.get(PO_PARAM)?.trim();
  if (po) query.set("po", po.slice(0, 50));
  const supplierName = params.get(SUPPLIER_PARAM)?.trim();
  if (supplierName) query.set("supplier", supplierName.slice(0, 200));
  const supplier = params.get("supplier");
  if (isId(supplier)) query.set("supplierId", supplier);
  let from = params.get("from");
  let to = params.get("to");
  const period = params.get("period");
  if (!isDay(from) && !isDay(to) && isMonth(period)) ({ from, to } = monthRange(period));
  if (isDay(from) && isDay(to) && from > to) [from, to] = [to, from];
  if (isDay(from)) query.set("from", from);
  if (isDay(to)) query.set("to", to);
  const status = params.get("status");
  if (oneOf(ORDER_STATES, status)) query.set("status", status);
  const stage = params.get("stage");
  if (stage && /^[1-6]$/.test(stage)) query.set("stage", stage);
  const currency = params.get("currency");
  if (currency && /^[A-Z]{3}$/.test(currency)) query.set("currency", currency);
  const warehouse = params.get("warehouse");
  if (isId(warehouse)) query.set("warehouseId", warehouse);
  const paymentStatus = params.get("paymentStatus");
  if (oneOf(PAYMENT_STATES, paymentStatus)) query.set("paymentStatus", paymentStatus);
  return query.size ? `?${query}` : "";
}

/** The header pill and the files' filters line: "PO: 20 · Foshan Fabrics · 1 Sep 2026 to 30 Sep 2026 · Closed · Main warehouse · Partly paid"; null when unfiltered. */
export function orderReportsFilterLabel(filter: OrderReportsResponse["filter"]) {
  const dates = filter.from && filter.to ? `${formatDate(filter.from)} to ${formatDate(filter.to)}` : filter.from ? `From ${formatDate(filter.from)}` : filter.to ? `To ${formatDate(filter.to)}` : null;
  const parts = [
    filter.po ? `PO: ${filter.po}` : null,
    filter.supplierName ? `Supplier: ${filter.supplierName}` : null,
    filter.supplier,
    dates,
    filter.status ? STATE_LABEL[filter.status] : null,
    filter.stage ? `${filter.stage}. ${STAGES[filter.stage - 1]}` : null,
    filter.currency,
    filter.warehouse,
    filter.paymentStatus ? PAYMENT_LABEL[filter.paymentStatus] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
