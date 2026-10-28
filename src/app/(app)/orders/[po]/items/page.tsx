import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderDetail } from "@/features/order-detail/data/queries";
import { ItemsScreen } from "@/features/order-detail/items/items-screen";

export const metadata: Metadata = { title: "Order items" };

export default async function OrderItemsPage({ params }: PageProps<"/orders/[po]/items">) {
  const order = await getOrderDetail((await params).po);
  if (!order) notFound();
  return <ItemsScreen order={order} />;
}
