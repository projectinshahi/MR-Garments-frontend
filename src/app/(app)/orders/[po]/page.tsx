import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderDetail } from "@/features/order-detail/data/queries";
import { OverviewScreen } from "@/features/order-detail/overview/overview-screen";

export const metadata: Metadata = { title: "Order overview" };

export default async function OrderOverviewPage({ params }: PageProps<"/orders/[po]">) {
  const order = await getOrderDetail((await params).po);
  if (!order) notFound();
  return <OverviewScreen order={order} />;
}
