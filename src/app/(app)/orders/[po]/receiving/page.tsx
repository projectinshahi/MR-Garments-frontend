import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { hasAccess } from "@/config/navigation";
import { getOrderDetail } from "@/features/order-detail/data/queries";
import { ReceivingScreen } from "@/features/order-detail/receiving/receiving-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Order receiving" };

export default async function OrderReceivingPage({ params }: PageProps<"/orders/[po]/receiving">) {
  const { po } = await params;
  const [order, me] = await Promise.all([getOrderDetail(po), getMe()]);
  // null: the user can't view receiving, so the tab doesn't exist for them.
  if (!order?.receipts) notFound();
  // REC-4 needs receiving Full (Management); the API refuses anyone else too.
  return <ReceivingScreen order={order} receipts={order.receipts} canDelete={!!me && hasAccess(me, "receiving", "Full")} />;
}
