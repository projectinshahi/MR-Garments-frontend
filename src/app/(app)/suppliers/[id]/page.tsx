import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { getSupplierPaymentDetail } from "@/features/reports/data/queries";
import { SupplierDetailScreen } from "@/features/reports/supplier-detail-screen";
import { HistoryTotals } from "@/features/supplier-history/history-screens";
import { getHistoryOverview } from "@/features/supplier-history/queries";
import { EditSupplierButton, SupplierTabs } from "@/features/supplier-history/supplier-frame";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier" };

/**
 * Suppliers › one supplier (the View action), the profile's Overview tab: the profile, the money summary and the
 * orders, payments and products lists of the supplier detail (RPT-5D), with the history at a glance (SH-1: the live
 * balances apart from the historical totals) and the tabs of Supplier Full History. An unknown supplier is the 404 page.
 */
export default async function SupplierPage({ params, searchParams }: PageProps<"/suppliers/[id]">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [page, overview, me] = await Promise.all([getSupplierPaymentDetail(id, search), getHistoryOverview(id), getMe()]);
  return (
    <SupplierDetailScreen
      page={page}
      linkPos={!!me && canOpen(me, "/orders")}
      parent={{ label: "Suppliers", href: "/suppliers" }}
      base={`/suppliers/${id}`}
      actions={<EditSupplierButton id={id} />}
      tabs={<SupplierTabs id={id} />}
      extra={<HistoryTotals overview={overview} />}
    />
  );
}
