import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderDetail } from "@/features/order-detail/data/queries";
import { PaymentsScreen } from "@/features/order-detail/payments/payments-screen";

export const metadata: Metadata = { title: "Order deposits and payments" };

export default async function OrderPaymentsPage({ params }: PageProps<"/orders/[po]/payments">) {
  const order = await getOrderDetail((await params).po);
  // null: the user can't view payments, so the tab doesn't exist for them.
  if (!order?.payments) notFound();
  return <PaymentsScreen order={order} payments={order.payments} />;
}
