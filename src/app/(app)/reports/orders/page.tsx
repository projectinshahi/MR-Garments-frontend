import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { OrderReportsScreen } from "@/features/reports/order-reports/order-reports-screen";
import { getOrderReports } from "@/features/reports/order-reports/queries";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Order reports" };

export default async function OrderReportsPage({ searchParams }: PageProps<"/reports/orders">) {
  const [page, me] = await Promise.all([getOrderReports(await searchParams), getMe()]);
  return <OrderReportsScreen page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
