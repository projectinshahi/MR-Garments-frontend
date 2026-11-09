"use client";

import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { Button } from "@/components/ui/button";
import { ExportActions } from "@/features/reports/report-actions";
import type { ReportFile } from "@/features/reports/report-files";

// Phase 2 §5: the three orders lists share one header and the All orders · Pending · Closed tab bar.
const TABS: RouteTab[] = [
  { href: "/orders", label: "All orders", chip: "1" },
  { href: "/orders/pending", label: "Pending", chip: "2" },
  { href: "/orders/closed", label: "Closed", chip: "3" },
];

/**
 * "Orders" header (Excel/PDF of the rows the list shows after its filters, "+ New order" for ordersEdit >= Enter), the
 * tab bar and the page body. Each list renders it, because the list owns the filters the export reads; the file is
 * built only when a button is clicked (§6).
 */
export function OrdersFrame({ canEdit, file, children }: { canEdit: boolean; file: () => ReportFile; children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <>
            <ExportActions file={file} formats={["xlsx", "pdf"]} size="header" />
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

/** "Closed Orders" (sidebar, after Warehouse): the Closed list on its own page, with the same Excel/PDF export and no tab bar. */
export function ClosedOrdersFrame({ file, children }: { file: () => ReportFile; children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Closed Orders" actions={<ExportActions file={file} formats={["xlsx", "pdf"]} size="header" />} />
      <PageContainer>{children}</PageContainer>
    </>
  );
}
