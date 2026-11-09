import type { Metadata } from "next";

import { getOrdersList } from "@/features/orders/data/queries";
import { orderPermissions } from "@/features/orders/order-permissions";
import { ClosedOrdersPageList } from "@/features/orders/orders-tab-list";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Closed orders" };

/**
 * Sidebar "Closed Orders" (after Warehouse): only the orders whose goods are all stocked in an India warehouse (phase 2
 * §5 `closed`), on their own page. The same ORD-1 load, filters, export and pager as the Closed tab under Orders.
 */
export default async function ClosedOrdersPage() {
  const [data, me] = await Promise.all([getOrdersList(), getMe()]);
  return <ClosedOrdersPageList {...data} canEdit={orderPermissions(me).canEdit} />;
}
