import type { Metadata } from "next";

import { getOrderStatusReport } from "@/features/reports/data/queries";
import { OrderStatusScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Order status" };

export default async function OrderStatusPage({ searchParams }: PageProps<"/reports/order-status">) {
  const page = await getOrderStatusReport(await searchParams);
  return <OrderStatusScreen page={page} />;
}
