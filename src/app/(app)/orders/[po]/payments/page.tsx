import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderPayments } from "@/features/order-detail/payments/data/queries";
import { PaymentsScreen } from "@/features/order-detail/payments/payments-screen";

export const metadata: Metadata = { title: "Order deposits and payments" };

export default async function OrderPaymentsPage({ params }: PageProps<"/orders/[po]/payments">) {
  const { po } = await params;
  const data = await getOrderPayments(po);
  if (!data) notFound();
  return <PaymentsScreen po={po} data={data} />;
}
