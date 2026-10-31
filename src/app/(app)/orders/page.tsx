import type { Metadata } from "next";

import { getOrdersList } from "@/features/orders/data/queries";
import { orderPermissions } from "@/features/orders/order-permissions";
import { OrdersScreen } from "@/features/orders/orders-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const [data, me] = await Promise.all([getOrdersList(), getMe()]);
  return <OrdersScreen data={data} {...orderPermissions(me)} />;
}
