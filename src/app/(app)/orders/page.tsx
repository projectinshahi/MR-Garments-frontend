import type { Metadata } from "next";

import { hasAccess } from "@/config/navigation";
import { getOrdersList } from "@/features/orders/data/queries";
import { OrdersScreen } from "@/features/orders/orders-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const [data, me] = await Promise.all([getOrdersList(), getMe()]);
  return <OrdersScreen data={data} canCreate={!!me && hasAccess(me, "ordersEdit", "Enter")} />;
}
