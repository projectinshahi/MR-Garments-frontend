import type { Metadata } from "next";

import { getOrdersList } from "@/features/orders/data/queries";
import { orderPermissions } from "@/features/orders/order-permissions";
import { OrdersScreen } from "@/features/orders/orders-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Pending orders" };

/** Phase 2 §5: orders at stage 1 (no China receipt yet). */
export default async function PendingOrdersPage() {
  const [data, me] = await Promise.all([getOrdersList(), getMe()]);
  return <OrdersScreen data={data} view="pending" {...orderPermissions(me)} />;
}
