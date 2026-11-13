"use client";

import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { Button } from "@/components/ui/button";
import { ReportDownload } from "@/features/reports/report-actions";
import type { ReportFile } from "@/features/reports/report-files";

// Phase 2 §5: the three orders lists share one header and the All orders · Pending · Closed tab bar.
const TABS: RouteTab[] = [
  { href: "/orders", label: "All orders", chip: "1" },
  { href: "/orders/pending", label: "Pending", chip: "2" },
  { href: "/orders/closed", label: "Closed", chip: "3" },
];

/**
 * "Orders" header (Download report: PDF, Excel or CSV of every order the list's filters match; "+ New order" for
 * ordersEdit >= Enter), the tab bar and the page body. Each list renders it, because the list owns the filters the
 * download reads; the file is built only when a format is chosen (§6).
 */
export function OrdersFrame({ canEdit, file, children }: { canEdit: boolean; file: () => Promise<ReportFile>; children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <>
            <ReportDownload file={file} size="header" />
            {canEdit ? (
              <Button asChild size="header">
                <Link href="/orders/new">+ New order</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <RouteTabs tabs={TABS} label="Orders lists" />
      <PageContainer>{children}</PageContainer>
    </>
  );
}

/** "Closed Orders" (sidebar, after Warehouse): the Closed list on its own page, with the same download and no tab bar. */
export function ClosedOrdersFrame({ file, children }: { file: () => Promise<ReportFile>; children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Closed Orders" actions={<ReportDownload file={file} size="header" />} />
      <PageContainer>{children}</PageContainer>
    </>
  );
}
