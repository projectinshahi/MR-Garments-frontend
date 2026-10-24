import type { Metadata } from "next";

import { getWarehouseList } from "@/features/warehouse/data/queries";
import { WarehouseListScreen } from "@/features/warehouse/warehouse-list-screen";

export const metadata: Metadata = { title: "Warehouse" };

export default async function WarehousePage() {
  const data = await getWarehouseList();
  return <WarehouseListScreen data={data} />;
}
