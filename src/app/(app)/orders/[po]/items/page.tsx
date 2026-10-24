import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderItems } from "@/features/order-detail/items/data/queries";
import { ItemsScreen } from "@/features/order-detail/items/items-screen";

export const metadata: Metadata = { title: "Order items" };

export default async function OrderItemsPage({ params }: PageProps<"/orders/[po]/items">) {
  const { po } = await params;
  const data = await getOrderItems(po);
  if (!data) notFound();
  return <ItemsScreen po={po} data={data} />;
}
