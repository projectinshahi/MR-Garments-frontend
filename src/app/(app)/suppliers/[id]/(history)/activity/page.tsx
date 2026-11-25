import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { HistoryActivityScreen } from "@/features/supplier-history/history-screens";
import { getHistoryEvents } from "@/features/supplier-history/queries";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier activity" };

/** Suppliers › one supplier › Activity (Supplier 360°, backend docs/supplier-history.md). */
export default async function SupplierActivityPage({ params, searchParams }: PageProps<"/suppliers/[id]/activity">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [page, me] = await Promise.all([getHistoryEvents(id, search), getMe()]);
  return <HistoryActivityScreen id={id} page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
