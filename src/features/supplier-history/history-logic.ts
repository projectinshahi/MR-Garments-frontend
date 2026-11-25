import { isValid, parseISO } from "date-fns";

import type { FilterOption } from "@/components/shared/filters";
import { EVENT_STATUSES, EVENT_TYPES, type EventStatus, type EventType, type HistoryEvent } from "@/lib/api/supplier-history-types";
import { formatDate, formatINR, formatMoney } from "@/lib/formatters";
import type { Currency, Tone } from "@/types/domain";

// Supplier Full History (backend docs/supplier-history.md): the words the profile tabs, the report and the files use, and
// the page URL turned into the API's strict query (malformed values left out, so a hand-edited URL never answers 400).

/** What a missing author, a cutover posting and an archive row are called everywhere. */
export const NOT_RECORDED = "Not recorded";
export const MIGRATED = "Migrated 23 Nov 2026";
export const ARCHIVE = "Archive";
export const DERIVED_NOTE = "Settles now: the live FIFO settlement (oldest orders first), worked out today from the ledger; not a stored allocation.";
export const HISTORY_NOTE =
  "History shows what the records keep. Edits, deleted receipts and earlier rates were never stored, so they are not shown. 'Not recorded' means the record keeps no author; 'Migrated 23 Nov 2026' marks a posting written when the supplier ledger started (its date is the original one).";

export const EVENT_LABEL: Record<EventType, string> = {
  supplier_created: "Supplier added",
  order_placed: "Order placed",
  order_value_posted: "Order value posted",
  order_value_changed: "Order value change",
  order_cancelled: "Order deleted",
  receipt_recorded: "Goods received (China)",
  payment_recorded: "Payment",
  payment_voided: "Payment voided",
  management_adjustment: "Management adjustment",
  agent_payment: "Sea-freight payment (agent)",
  agent_payment_voided: "Sea-freight payment voided",
  container_loaded: "Container loaded",
  clearing_recorded: "Clearing",
  transport_recorded: "Transport",
  warehouse_stocked: "Warehouse receipt",
  landed_cost_final: "Landed cost final",
  account_held: "Account on hold",
};
export const EVENT_TONE: Record<EventType, Tone> = {
  supplier_created: "neutral",
  order_placed: "info",
  order_value_posted: "info",
  order_value_changed: "info",
  order_cancelled: "danger",
  receipt_recorded: "success",
  payment_recorded: "success",
  payment_voided: "danger",
  management_adjustment: "warning",
  agent_payment: "purple",
  agent_payment_voided: "danger",
  container_loaded: "neutral",
  clearing_recorded: "neutral",
  transport_recorded: "neutral",
  warehouse_stocked: "neutral",
  landed_cost_final: "success",
  account_held: "warning",
};
export const STATUS_LABEL: Record<EventStatus, string> = { active: "Active", voided: "Voided", held: "On hold (pending review)", migrated: "Migrated" };

export const TYPE_OPTIONS: FilterOption[] = [{ value: "all", label: "All events" }, ...EVENT_TYPES.map((type) => ({ value: type, label: EVENT_LABEL[type] }))];
export const STATUS_OPTIONS: FilterOption[] = [{ value: "all", label: "Any status" }, ...EVENT_STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] }))];

/** "+¥500.00" / "−$25.00" as the ledger signs it (+ a credit, − a debit), or "–". */
export function signedMoney(amount: number | null, currency: string | null) {
  if (amount === null || currency === null) return "–";
  const text = formatMoney(Math.abs(amount), currency as Currency, { decimals: 2 });
  return amount > 0 ? `+${text}` : amount < 0 ? `−${text}` : text;
}
export const inrOrDash = (value: number | null) => (value === null ? "–" : formatINR(value, 2));
export const dayOf = (event: HistoryEvent) => event.date ?? event.recordedAt?.slice(0, 10) ?? null;
export const dateText = (value: string | null) => (value ? formatDate(value) : "–");

const isDay = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
const isPage = (value: string | null): value is string => !!value && /^[1-9]\d{0,5}$/.test(value);
const isId = (value: string | null): value is string => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * The API query of a history list from the page URL: dates (swapped back when reversed), search, page, and the list's
 * own filters (`status` from `statuses`; event `type`, `supplier` on the report). "" or "?…".
 */
export function historyQuery(params: URLSearchParams, list: { statuses?: readonly string[]; events?: boolean; supplier?: boolean } = {}) {
  const query = new URLSearchParams();
  let from = params.get("from");
  let to = params.get("to");
  if (isDay(from) && isDay(to) && from > to) [from, to] = [to, from];
  if (isDay(from)) query.set("from", from);
  if (isDay(to)) query.set("to", to);
  const q = params.get("q")?.trim();
  if (q) query.set("q", q.slice(0, 100));
  const status = params.get("status");
  if (status && list.statuses?.includes(status)) query.set("status", status);
  const type = params.get("type");
  if (list.events && type && (EVENT_TYPES as readonly string[]).includes(type)) query.set("types", type);
  const supplier = params.get("supplier");
  if (list.supplier && isId(supplier)) query.set("supplierId", supplier);
  const page = params.get("page");
  if (isPage(page)) query.set("page", page);
  return query.size ? `?${query}` : "";
}

/** The filters line of the files and the header pill: "Guangzhou · 1 Nov 2026 to 25 Nov 2026 · Payment · Voided · “UTR”". */
export function historyFilterLabel(filter: { supplier?: string | null; from: string | null; to: string | null; types?: EventType[]; status?: string | null; q?: string | null }) {
  const dates = filter.from && filter.to ? `${formatDate(filter.from)} to ${formatDate(filter.to)}` : filter.from ? `From ${formatDate(filter.from)}` : filter.to ? `To ${formatDate(filter.to)}` : null;
  const parts = [
    filter.supplier,
    dates,
    filter.types?.length ? filter.types.map((type) => EVENT_LABEL[type]).join(", ") : null,
    filter.status ? STATUS_LABEL[filter.status as EventStatus] : null,
    filter.q ? `“${filter.q}”` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
