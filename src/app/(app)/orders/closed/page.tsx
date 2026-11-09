import type { Metadata } from "next";

import { getOrdersList } from "@/features/orders/data/queries";
import { orderPermissions } from "@/features/orders/order-permissions";
import { OrdersScreen } from "@/features/orders/orders-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Closed orders" };

/** Phase 2 §5: orders whose goods are all stocked in an India warehouse (`closed`). */
export default async function ClosedOrdersPage() {
  const [data, me] = await Promise.all([getOrdersList(), getMe()]);
  return <OrdersScreen data={data} view="closed" {...orderPermissions(me)} />;
}
