import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderReceiving } from "@/features/order-detail/receiving/data/queries";
import { ReceivingScreen } from "@/features/order-detail/receiving/receiving-screen";

export const metadata: Metadata = { title: "Order receiving" };

export default async function OrderReceivingPage({ params }: PageProps<"/orders/[po]/receiving">) {
  const { po } = await params;
  const data = await getOrderReceiving(po);
  if (!data) notFound();
  return <ReceivingScreen po={po} data={data} />;
}
