import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { getSupplierOrders } from "@/features/reports/supplier-orders/queries";
import { SupplierOrdersScreen } from "@/features/reports/supplier-orders/supplier-orders-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier order details" };

export default async function SupplierOrdersPage({ searchParams }: PageProps<"/reports/supplier-orders">) {
  const [page, me] = await Promise.all([getSupplierOrders(await searchParams), getMe()]);
  return <SupplierOrdersScreen page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
