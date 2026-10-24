import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderHistory } from "@/features/order-detail/history/data/queries";
import { HistoryScreen } from "@/features/order-detail/history/history-screen";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({ params }: PageProps<"/orders/[po]/history">) {
  const { po } = await params;
  const events = await getOrderHistory(po);
  if (!events) notFound();
  return <HistoryScreen po={po} events={events} />;
}
