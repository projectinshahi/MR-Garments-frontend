import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatMoneyList, formatNumber } from "@/lib/formatters";

import { ExportActions } from "../report-actions";
import { Footnote } from "../report-screens";
import { OrderReportsFilters } from "./order-reports-filters";
import { orderReportsFile } from "./order-reports-file";
import { OrderReportsTable } from "./order-reports-table";
import { orderReportsFilterLabel } from "./params";
import type { OrderReportsPage } from "./queries";

// Order reports (RPT-O2, backend docs/phase2-contracts.md 4.2). No reference screenshot: the Reports frame (breadcrumb,
// filter pill, export buttons, xs KPI tiles) over a filter row and the list table. The exports hold the rows shown.

type Totals = OrderReportsPage["data"]["summary"]["byCurrency"][number];

export function OrderReportsScreen({ page, linkPos }: { page: OrderReportsPage; linkPos: boolean }) {
  const { data, today } = page;
  const { summary } = data;
  const label = orderReportsFilterLabel(data.filter);
  // One amount per order currency ("¥5,800 · $200"), never added together; INR amounts add up.
  const each = (pick: (total: Totals) => number) => formatMoneyList(summary.byCurrency.map((total) => ({ currency: total.currency, amount: pick(total) })));
  return (
    <>
      <PageHeader
        title="Order reports"
        parent={{ label: "Reports", href: `/reports${page.query}` }}
        titleAddon={label ? <StatusPill tone="neutral">{label}</StatusPill> : undefined}
        actions={<ExportActions file={orderReportsFile(data, today)} formats={["xlsx", "pdf"]} />}
      />
      <PageContainer>
        <OrderReportsFilters options={data.options} />
        <KpiRow gap="sm" className="md:grid-flow-row lg:grid-flow-col">
          <KpiCard size="xs" label="Orders" value={formatNumber(summary.orders)} sub={label ? "matching the filters" : "every order"} />
          <KpiCard size="xs" label="Order value" value={each((t) => t.orderValueCny)} sub="all stages" />
          <KpiCard size="xs" label="Paid to suppliers" value={each((t) => t.paidCny)} sub={`${formatINR(summary.paidInr)} at payment-day rates`} />
          <KpiCard size="xs" label="Balance" value={each((t) => t.balanceCny)} sub="order value less paid" />
          <KpiCard size="xs" label="Landed cost" value={formatINR(summary.landedCostInr)} sub="orders with a cost so far" />
        </KpiRow>
        <OrderReportsTable rows={data.rows} today={today} linkPos={linkPos} />
        <Footnote>
          Paid and balance count payments to the supplier only; payments to shipping agents are sea freight in the landed cost. Landed cost is the
          order&apos;s allocated share so far, final or estimate; the Report link opens the order&apos;s full report.
        </Footnote>
      </PageContainer>
    </>
  );
}
