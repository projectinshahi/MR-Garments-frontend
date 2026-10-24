import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getWarehouseReceipt } from "@/features/order-detail/warehouse/data/queries";
import { WarehouseScreen } from "@/features/order-detail/warehouse/warehouse-screen";

export const metadata: Metadata = { title: "Warehouse" };

export default async function WarehousePage({ params }: PageProps<"/orders/[po]/warehouse">) {
  const { po } = await params;
  const data = await getWarehouseReceipt(po);
  if (!data) notFound();
  return <WarehouseScreen po={po} data={data} />;
}
