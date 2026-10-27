import type { OrderRow } from "./data/queries";

export type OrderChip = "all" | "late" | "dueSoon" | "shortReceived" | "completed";

export type OrderFilters = {
  query: string;
  /** Stage number 1–6. */
  stage: number | null;
  supplier: string | null;
  chip: OrderChip;
};

const chipMatch = (order: OrderRow, chip: OrderChip) =>
  chip === "all" || (chip === "completed" ? order.stage === 6 : order.chip === chip);

/** Client-side filtering of the loaded rows: search (PO, item, supplier), stage, supplier and chip. */
export function filterOrders(orders: OrderRow[], { query, stage, supplier, chip }: OrderFilters) {
  const q = query.trim().toLowerCase();
  return orders.filter(
    (order) =>
      (!q || [order.po, order.item, order.supplier].some((field) => field.toLowerCase().includes(q))) &&
      (stage === null || order.stage === stage) &&
      (supplier === null || order.supplier === supplier) &&
      chipMatch(order, chip),
  );
}

export const isFiltered = ({ query, stage, supplier, chip }: OrderFilters) =>
  query.trim() !== "" || stage !== null || supplier !== null || chip !== "all";
