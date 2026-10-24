import type { Metadata } from "next";

import { getOrderStatusReport } from "@/features/reports/data/queries";
import { OrderStatusScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Order status" };

export default async function OrderStatusPage() {
  const data = await getOrderStatusReport();
  return <OrderStatusScreen data={data} />;
}
