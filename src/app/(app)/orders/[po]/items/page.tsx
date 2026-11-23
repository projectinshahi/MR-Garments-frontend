import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { hasAccess } from "@/config/navigation";
import { getOrderDetail } from "@/features/order-detail/data/queries";
import { ItemsScreen } from "@/features/order-detail/items/items-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Order items" };

export default async function OrderItemsPage({ params }: PageProps<"/orders/[po]/items">) {
  const [order, me] = await Promise.all([getOrderDetail((await params).po), getMe()]);
  if (!order) notFound();
  // ORD-8: Management corrects a received line's rate; a held account refuses money writes.
  const canCorrectRates = !!me && hasAccess(me, "payments", "Full") && !order.held && order.lines.some((line) => line.received > 0);
  return <ItemsScreen order={order} canCorrectRates={canCorrectRates} />;
}
