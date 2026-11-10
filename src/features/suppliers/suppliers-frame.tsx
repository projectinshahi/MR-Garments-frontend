import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/layout/route-tabs";
import { TodayPill } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import type { SuppliersSummary } from "@/lib/api/suppliers-types";

import { SupplierKpis } from "./suppliers-kpis";
import { SUPPLIER_TABS } from "./suppliers-logic";

/**
 * The Suppliers page (backend docs/suppliers.md): the header with the date, the five KPI cards, the Supplier List /
 * Performance / Analytics tabs and the tab's content. `actions`: the tab's own header controls (the dashboards'
 * Period and Supplier filters); `filter`: the pill naming them when set.
 */
export function SuppliersFrame({
  summary,
  today,
  actions,
  filter,
  children,
}: {
  summary: SuppliersSummary;
  today: string;
  actions?: React.ReactNode;
  filter?: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Suppliers"
        // Hidden on phones (an undesigned width), where it would squeeze the title out of the header beside the date.
        titleAddon={
          <StatusPill tone="neutral" className="max-sm:hidden">
            {filter ?? "Management only"}
          </StatusPill>
        }
        actions={
          <>
            {actions}
            <TodayPill size="sm" today={today} />
          </>
        }
      />
      <PageContainer className="flex-none pb-0">
        <SupplierKpis summary={summary} />
      </PageContainer>
      <div className="mt-(--page-gap)">
        <RouteTabs tabs={SUPPLIER_TABS} label="Supplier sections" />
      </div>
      <PageContainer>{children}</PageContainer>
    </>
  );
}
