import { differenceInCalendarDays, parseISO } from "date-fns";

import { MOCK_TODAY } from "@/lib/constants";

import type { OrderRow } from "./data/queries";

export type OrderChip = "all" | "late" | "dueSoon" | "shortReceived" | "completed";

export type OrderFilters = {
  query: string;
  /** Stage number 1–6. */
  stage: number | null;
  supplier: string | null;
  chip: OrderChip;
};

// "Due soon": not late, and due from MOCK_TODAY up to 7 days ahead. The reference (05) shows only the chip label,
// so this rule is a documented project decision (inventory §9), not a transcribed value.
const DUE_SOON_DAYS = 7;

const CHIP_MATCH: Record<OrderChip, (order: OrderRow) => boolean> = {
  all: () => true,
  late: (order) => order.tone === "danger",
  dueSoon: (order) => {
    const days = differenceInCalendarDays(parseISO(order.deliveryDate), parseISO(MOCK_TODAY));
    return order.tone !== "danger" && days >= 0 && days <= DUE_SOON_DAYS;
  },
  shortReceived: (order) => order.status.startsWith("Short"),
  completed: (order) => order.stage === 6,
};

/** Client-side filtering of the loaded rows: search (PO, item, supplier), stage, supplier and chip. */
export function filterOrders(orders: OrderRow[], { query, stage, supplier, chip }: OrderFilters) {
  const q = query.trim().toLowerCase();
  return orders.filter(
    (order) =>
      (!q || [order.po, order.item, order.supplier].some((field) => field.toLowerCase().includes(q))) &&
      (stage === null || order.stage === stage) &&
      (supplier === null || order.supplier === supplier) &&
      CHIP_MATCH[chip](order),
  );
}

export const isFiltered = ({ query, stage, supplier, chip }: OrderFilters) =>
  query.trim() !== "" || stage !== null || supplier !== null || chip !== "all";
