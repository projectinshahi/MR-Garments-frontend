import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CostScreen } from "@/features/order-detail/cost/cost-screen";
import { getOrderCost } from "@/features/order-detail/cost/data/queries";

export const metadata: Metadata = { title: "Cost" };

export default async function CostPage({ params }: PageProps<"/orders/[po]/cost">) {
  const { po } = await params;
  const data = await getOrderCost(po);
  if (!data) notFound();
  return <CostScreen po={po} data={data} />;
}
