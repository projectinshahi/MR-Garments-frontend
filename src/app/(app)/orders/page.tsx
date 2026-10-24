import type { Metadata } from "next";

import { getOrdersList } from "@/features/orders/data/queries";
import { OrdersScreen } from "@/features/orders/orders-screen";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const data = await getOrdersList();
  return <OrdersScreen data={data} />;
}
