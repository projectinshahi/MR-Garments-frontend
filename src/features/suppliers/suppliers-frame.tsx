import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/layout/route-tabs";
import { TodayPill } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import { DashboardSearch } from "@/features/dashboard/dashboard-search";
import type { SuppliersSummary } from "@/lib/api/suppliers-types";

import { SupplierKpis } from "./suppliers-kpis";
import { SUPPLIER_TABS } from "./suppliers-logic";

/**
 * The Suppliers page (backend docs/suppliers.md), laid out as the reference: the global header (search, date), the
 * five KPI cards, the Supplier List / Performance / Analytics tabs and the tab's content. `actions`: the tab's own
 * header controls (the dashboards' Period and Supplier filters); `filter`: the pill naming them when set.
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
          filter ? (
            <StatusPill tone="neutral" className="max-sm:hidden">
              {filter}
            </StatusPill>
          ) : undefined
        }
        actions={
          <>
            {actions ?? <DashboardSearch />}
            {/* A tab's own actions end with its download; on a phone the date pill gives way to them. */}
            <span className={actions ? "max-sm:hidden" : undefined}>
              <TodayPill size="sm" today={today} />
            </span>
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
