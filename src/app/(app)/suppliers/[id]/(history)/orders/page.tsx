import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { HistoryOrdersScreen } from "@/features/supplier-history/history-screens";
import { getHistoryOrders } from "@/features/supplier-history/queries";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier orders" };

/** Suppliers › one supplier › Orders (Supplier 360°, backend docs/supplier-history.md). */
export default async function SupplierOrdersPage({ params, searchParams }: PageProps<"/suppliers/[id]/orders">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [page, me] = await Promise.all([getHistoryOrders(id, search), getMe()]);
  return <HistoryOrdersScreen id={id} page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
