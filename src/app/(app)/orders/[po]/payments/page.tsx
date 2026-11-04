import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { hasAccess } from "@/config/navigation";
import { getOrderDetail } from "@/features/order-detail/data/queries";
import { PaymentsScreen } from "@/features/order-detail/payments/payments-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Order deposits and payments" };

export default async function OrderPaymentsPage({ params }: PageProps<"/orders/[po]/payments">) {
  const { po } = await params;
  const [order, me] = await Promise.all([getOrderDetail(po), getMe()]);
  // null: the user can't view payments, so the tab doesn't exist for them.
  if (!order?.payments) notFound();
  // PAY-3 needs payments Full (Management); the API refuses anyone else too.
  return <PaymentsScreen order={order} payments={order.payments} canDelete={!!me && hasAccess(me, "payments", "Full")} />;
}
