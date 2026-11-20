import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderDetail } from "@/features/order-detail/data/queries";
import { PaymentsScreen } from "@/features/order-detail/payments/payments-screen";
import { getPaymentAccess } from "@/features/payments/data/queries";

export const metadata: Metadata = { title: "Order payments" };

export default async function OrderPaymentsPage({ params }: PageProps<"/orders/[po]/payments">) {
  const { po } = await params;
  const [order, access] = await Promise.all([getOrderDetail(po), getPaymentAccess()]);
  // null: the user can't view payments, so the tab doesn't exist for them.
  if (!order?.payments) notFound();
  // Record payment (payments Enter) for the order's supplier when it is active (ADV-5 lists it); Void needs payments Full.
  return (
    <PaymentsScreen
      order={order}
      payments={order.payments}
      canVoid={access.canVoid}
      supplier={access.suppliers?.find((s) => s.id === order.supplier.id) ?? null}
      agents={access.agents}
    />
  );
}
