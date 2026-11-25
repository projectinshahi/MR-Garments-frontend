import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { HistoryLandedCostScreen } from "@/features/supplier-history/history-screens";
import { getHistoryLandedCost } from "@/features/supplier-history/queries";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier landed cost" };

/** Suppliers › one supplier › Landed cost (Supplier 360°, backend docs/supplier-history.md). */
export default async function SupplierLandedCostPage({ params, searchParams }: PageProps<"/suppliers/[id]/landed-cost">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [page, me] = await Promise.all([getHistoryLandedCost(id, search), getMe()]);
  return <HistoryLandedCostScreen id={id} page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
