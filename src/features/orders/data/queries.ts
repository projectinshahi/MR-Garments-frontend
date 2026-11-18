import { apiGet } from "@/lib/api/server";
import type { OrderLineItem, OrderListItem, OrderOptions } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";

import { type OrderProduct, productsByOrder } from "../order-products";
import { orderStatus, type OrderStatus, type StatusChip } from "../order-status";

// Orders list (05) reads ORD-1 and ORD-2, and ORD-7 for every order's products (ORD-1 names the first line only).
// These calls read the session cookie, so the page renders inside the (app) loading.tsx Suspense boundary; ORD-1 and
// ORD-2 failures throw to error.tsx, an ORD-7 failure leaves each order described by its first line, as before.

export type OrderRow = Omit<OrderListItem, "supplier"> & {
  supplier: string;
  status: string;
  tone: OrderStatus["tone"];
  chip: StatusChip;
  /** Every product on the order, in line order (order-products.ts); absent without ORD-7 (then ORD-1's first line). */
  products?: OrderProduct[];
};
export type OrderCounts = { all: number; late: number; dueSoon: number; shortReceived: number };
export type OrdersListData = Awaited<ReturnType<typeof getOrdersList>>;

/** Every order with its status for today in India, the chip counts, and the supplier filter options. */
export async function getOrdersList() {
  const [list, options, lines] = await Promise.all([
    apiGet<OrderListItem[]>("/orders"),
    apiGet<OrderOptions>("/orders/options"),
    apiGet<OrderLineItem[]>("/order-lines").catch((): null => null),
  ]);
  const today = todayInIndia();
  const products = productsByOrder(Array.isArray(lines) ? lines : []);
  const orders: OrderRow[] = list.map((order) => {
    const { label, tone, chip } = orderStatus(order, today);
    return { ...order, supplier: order.supplier.name, status: label, tone, chip, products: products.get(order.id) };
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
