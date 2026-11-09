import type { Tone } from "@/types/domain";

import type { OrderRow } from "./data/queries";

export type OrderChip = "all" | "late" | "dueSoon" | "shortReceived" | "closed";

export type OrderFilters = {
  query: string;
  /** Stage number 1–6. */
  stage: number | null;
  supplier: string | null;
  chip: OrderChip;
};

// Phase 2 fixes §4: "Closed" is the closure flag (every carrier stocked), not stage 6 alone.
const chipMatch = (order: OrderRow, chip: OrderChip) => chip === "all" || (chip === "closed" ? order.closed : order.chip === chip);

/** Search over PO, item and supplier; `q` is already trimmed and lower-cased. */
const matchesSearch = (order: OrderRow, q: string) => !q || [order.po, order.item, order.supplier].some((field) => field.toLowerCase().includes(q));

/** Client-side filtering of the loaded rows: search (PO, item, supplier), stage, supplier and chip. */
export function filterOrders(orders: OrderRow[], { query, stage, supplier, chip }: OrderFilters) {
  const q = query.trim().toLowerCase();
  return orders.filter(
    (order) =>
      matchesSearch(order, q) && (stage === null || order.stage === stage) && (supplier === null || order.supplier === supplier) && chipMatch(order, chip),
  );
}

export const isFiltered = ({ query, stage, supplier, chip }: OrderFilters) =>
  query.trim() !== "" || stage !== null || supplier !== null || chip !== "all";

// Phase 2 §1 and §5: the Pending and Closed tabs and their derived columns.

/** Pending = no China receipt yet (stage 1); REC-3 moves the order on at the first receipt. */
export const pendingOrders = (orders: OrderRow[]) => orders.filter((order) => order.stage === 1);
/** Closed = stage 6 with every carrier's warehouse receipt stocked, read live by the API. */
export const closedOrders = (orders: OrderRow[]) => orders.filter((order) => order.closed);

/** Main line still to receive; excess (received > ordered) never goes below 0. */
export const pendingQty = (order: Pick<OrderRow, "quantity" | "received">) => Math.max(0, order.quantity - order.received);

/** Balance owed to the supplier in the order's currency (order value less what the supplier was paid; agent payments are sea freight), to the cent. */
export const balanceCny = (order: Pick<OrderRow, "orderValueCny" | "supplierPaidCny">) => Math.round((order.orderValueCny - order.supplierPaidCny) * 100) / 100;

export type PaymentStatus = { label: "Unpaid" | "Partly paid" | "Paid"; tone: Tone };
/** Deposit/payment status from the payments to the supplier against the order value (13.5). Proposed tones: neutral, warning, success. */
export function paymentStatus({ supplierPaidCny, orderValueCny }: Pick<OrderRow, "supplierPaidCny" | "orderValueCny">): PaymentStatus {
  if (supplierPaidCny <= 0) return { label: "Unpaid", tone: "neutral" };
  if (supplierPaidCny >= orderValueCny) return { label: "Paid", tone: "success" };
  return { label: "Partly paid", tone: "warning" };
}

export type TabFilters = {
  query: string;
  supplier: string | null;
  /** YYYY-MM-DD bounds on the tab's date (order date, closed date), inclusive; "" leaves that end open. */
  from: string;
  to: string;
};

/** The Pending and Closed tabs: search (PO, item, supplier), supplier and the date range on `dateOf`. */
export function filterTabOrders(orders: OrderRow[], { query, supplier, from, to }: TabFilters, dateOf: (order: OrderRow) => string | null) {
  const q = query.trim().toLowerCase();
  return orders.filter((order) => {
    // ISO dates compare as text; a missing date never falls inside a bound.
    const date = dateOf(order) ?? "";
    return matchesSearch(order, q) && (supplier === null || order.supplier === supplier) && (!from || date >= from) && (!to || date <= to);
  });
}
