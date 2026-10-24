import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOrderOverview } from "@/features/order-detail/overview/data/queries";
import { OverviewScreen } from "@/features/order-detail/overview/overview-screen";

export const metadata: Metadata = { title: "Order overview" };

export default async function OrderOverviewPage({ params }: PageProps<"/orders/[po]">) {
  const { po } = await params;
  const data = await getOrderOverview(po);
  if (!data) notFound();
  return <OverviewScreen data={data} />;
}
