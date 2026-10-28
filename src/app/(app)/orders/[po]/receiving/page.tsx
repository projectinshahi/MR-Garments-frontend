import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderDetail } from "@/features/order-detail/data/queries";
import { ReceivingScreen } from "@/features/order-detail/receiving/receiving-screen";

export const metadata: Metadata = { title: "Order receiving" };

export default async function OrderReceivingPage({ params }: PageProps<"/orders/[po]/receiving">) {
  const order = await getOrderDetail((await params).po);
  // null: the user can't view receiving, so the tab doesn't exist for them.
  if (!order?.receipts) notFound();
  return <ReceivingScreen order={order} receipts={order.receipts} />;
}
