import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getReceiveGoods } from "@/features/warehouse/data/queries";
import { ReceiveGoodsScreen } from "@/features/warehouse/receive-goods-screen";

export const metadata: Metadata = { title: "Receive goods" };

// The trip id is a runtime param, read inside the (app) loading.tsx Suspense boundary.
export default async function ReceiveGoodsPage({ params }: PageProps<"/warehouse/receive/[trip]">) {
  const { trip } = await params;
  const data = await getReceiveGoods(trip);
  if (!data) notFound();
  // A save changes the saved receipt, so the form starts again from it after router.refresh().
  return <ReceiveGoodsScreen key={`${data.form.receipt?.id}:${data.form.receipt?.status}`} data={data} />;
}
