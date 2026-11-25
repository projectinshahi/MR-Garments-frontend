import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { getSupplierHistoryReport } from "@/features/supplier-history/queries";
import { SupplierHistoryReportScreen } from "@/features/supplier-history/supplier-history-report";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier history" };

/** Reports › Supplier history (RPT-SH, backend docs/supplier-history.md). */
export default async function SupplierHistoryReportPage({ searchParams }: PageProps<"/reports/supplier-history">) {
  const [page, me] = await Promise.all([getSupplierHistoryReport(await searchParams), getMe()]);
  return <SupplierHistoryReportScreen page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
