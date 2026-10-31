import { apiGet } from "@/lib/api/server";
import type { OrderListItem, OrderOptions } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";

import { orderStatus, type OrderStatus, type StatusChip } from "../order-status";

// Orders list (05) reads ORD-1 and ORD-2. These calls read the session cookie, so the page renders inside the
// (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type OrderRow = Omit<OrderListItem, "supplier"> & {
  supplier: string;
  status: string;
  tone: OrderStatus["tone"];
  chip: StatusChip;
};
export type OrderCounts = { all: number; late: number; dueSoon: number; shortReceived: number };
export type OrdersListData = Awaited<ReturnType<typeof getOrdersList>>;

/** Every order with its status for today in India, the chip counts, and the supplier filter options. */
export async function getOrdersList() {
  const [list, options] = await Promise.all([apiGet<OrderListItem[]>("/orders"), apiGet<OrderOptions>("/orders/options")]);
  const today = todayInIndia();
  const orders: OrderRow[] = list.map((order) => {
    const { label, tone, chip } = orderStatus(order, today);
    return { ...order, supplier: order.supplier.name, status: label, tone, chip };
  });
  const count = (chip: StatusChip) => orders.filter((o) => o.chip === chip).length;
  const counts: OrderCounts = { all: orders.length, late: count("late"), dueSoon: count("dueSoon"), shortReceived: count("shortReceived") };
  // Active suppliers, plus any inactive one that still has orders, so every row can be filtered.
  const supplierNames = [...new Set([...options.suppliers.map((s) => s.name), ...orders.map((o) => o.supplier)])];
  return { orders, counts, supplierNames };
}

/** ORD-2's active items, for the Edit order lines. */
export async function getActiveItems() {
  return (await apiGet<OrderOptions>("/orders/options")).items;
}
