import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { HistoryPaymentsScreen } from "@/features/supplier-history/history-screens";
import { getHistoryPayments } from "@/features/supplier-history/queries";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier payments" };

/** Suppliers › one supplier › Payments (Supplier 360°, backend docs/supplier-history.md). */
export default async function SupplierPaymentsPage({ params, searchParams }: PageProps<"/suppliers/[id]/payments">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [page, me] = await Promise.all([getHistoryPayments(id, search), getMe()]);
  return <HistoryPaymentsScreen id={id} page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
