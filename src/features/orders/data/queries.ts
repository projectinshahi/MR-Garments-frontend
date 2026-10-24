import { listOrderDetailPOs } from "@/features/order-detail/shared/queries";
import { listSuppliers } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { OrderCounts } from "./fixtures";

export type OrderRow = fixtures.OrderListRow & {
  /** True when the PO has a designed detail view (only PO-2028); other rows call notInPrototype (D5). */
  hasDetail: boolean;
};

export type OrdersListData = Awaited<ReturnType<typeof getOrdersList>>;

/** Page 1 of the orders list, the chip counts, and the supplier filter options. Async so a real API can replace it. */
export async function getOrdersList() {
  const [suppliers, detailPOs] = await Promise.all([listSuppliers(), listOrderDetailPOs()]);
  const orders: OrderRow[] = fixtures.orders.map((order) => ({ ...order, hasDetail: detailPOs.includes(order.po) }));
  // Master suppliers, plus any shown on this page that the master lacks (Hangzhou Silk House), so every row can be filtered.
  const supplierNames = [...new Set([...suppliers.map((s) => s.name), ...orders.map((o) => o.supplier)])];
  return { orders, counts: { ...fixtures.counts }, supplierNames };
}
