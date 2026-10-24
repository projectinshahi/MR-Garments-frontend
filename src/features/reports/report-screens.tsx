import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { BarChart } from "@/components/shared/bar-chart";
import { ProgressBar } from "@/components/shared/progress";
import { formatCNY, formatINR, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import { ContainersGantt } from "./containers-gantt";
import type {
  ContainersTimelineReport,
  DeliveriesPerDayReport,
  LandedCostByMonthReport,
  OrderStatusReport,
  PaymentsPerSupplierReport,
  ReceivedLine,
} from "./data/queries";
import { ExportActions } from "./report-actions";
import { monthTotals, summarizeReceived, supplierTotals } from "./report-logic";
import { LandedCostChart, LateOrdersTable, MonthTable, ReceivedTable, SupplierPaymentsTable } from "./report-widgets";

// The six reports (33–38): breadcrumb "Reports / <title>", export buttons, xs KPI tiles and the report body.

function ReportFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={title} parent={{ label: "Reports", href: "/reports" }} actions={<ExportActions />} />
      <PageContainer>{children}</PageContainer>
    </>
  );
}

/** Card subtitle under the title: 12.5 px muted (34, 36). */
function CardSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-[21px] text-muted-foreground">{children}</p>;
}

/** Muted note under a card (34, 37). */
function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-4 text-muted-foreground">{children}</p>;
}

/** 13.1 Order status (33_13.1_Order_status.jpeg). */
export function OrderStatusScreen({ data }: { data: OrderStatusReport }) {
  const { kpis, stageCounts, lateOrders } = data;
  const max = Math.max(...stageCounts);
  return (
    <ReportFrame title="Order status">
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Active orders" value={formatNumber(kpis.active)} sub={`across ${STAGES.length} stages`} />
        <KpiCard size="xs" label="Late orders" value={formatNumber(kpis.late)} sub="need follow-up" tone="danger" />
        <KpiCard size="xs" label="Finished this month" value={formatNumber(kpis.finishedThisMonth)} sub="reached the warehouse" />
        <KpiCard size="xs" label="Average order time" value={`${kpis.averageDays} days`} sub="order to warehouse" />
      </KpiRow>
      <div className="grid gap-(--page-gap) lg:grid-cols-2">
        <SectionCard title="Orders by stage" titleGap="none" className="pb-[18.5px]">
          <ul className="mt-3">
            {stageCounts.map((count, index) => {
              const label = `${index + 1}. ${STAGES[index]}`;
              return (
                <li key={label} className="grid h-[34px] grid-cols-[minmax(0,202px)_minmax(0,1fr)_62px] items-center text-sm">
                  <span>{label}</span>
                  <ProgressBar value={count} max={max} label={label} className="h-5" />
                  <span className="text-right font-bold">{formatNumber(count)}</span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
        <SectionCard title="Late orders" titleGap="none" className="min-w-0">
          <div className="mt-3">
            <LateOrdersTable rows={lateOrders} />
          </div>
        </SectionCard>
      </div>
    </ReportFrame>
  );
}

/** 13.2 Deliveries per day (34_13.2_Deliveries_per_day.jpeg). */
export function DeliveriesPerDayScreen({ data }: { data: DeliveriesPerDayReport }) {
  const { kpis } = data;
  return (
    <ReportFrame title="Deliveries per day">
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Due next 7 days" value={formatNumber(kpis.dueNext7)} sub={`from ${kpis.suppliers} suppliers`} />
        <KpiCard size="xs" label="Due next 14 days" value={formatNumber(kpis.dueNext14)} sub={kpis.range} />
        <KpiCard size="xs" label="Busiest day" value={kpis.busiest} sub={`${kpis.busiestCount} deliveries each`} />
        <KpiCard size="xs" label="Days with none" value={formatNumber(kpis.daysWithNone)} sub="in next 14 days" />
      </KpiRow>
      <SectionCard title="Deliveries due per day" titleGap="none" className="pb-[26.5px]">
        <CardSubtitle>{data.subtitle}</CardSubtitle>
        <div className="overflow-x-auto">
          <BarChart size="sm" label="Deliveries due per day, next 14 days" data={data.days} className="mt-[80px] h-[176px] min-w-[560px] px-[3px]" />
        </div>
      </SectionCard>
      <Footnote>Late deliveries ({data.lateCount}) are not in this chart. See the Delivery Calendar.</Footnote>
    </ReportFrame>
  );
}

/** 13.3 Ordered vs received (35_13.3_Ordered_vs_received.jpeg). */
export function OrderedVsReceivedScreen({ lines }: { lines: ReceivedLine[] }) {
  const summary = summarizeReceived(lines);
  return (
    <ReportFrame title="Ordered vs received">
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Orders checked" value={formatNumber(summary.checked)} sub="received in China" />
        <KpiCard size="xs" label="Orders with a shortage" value={formatNumber(summary.shortPos.length)} sub={summary.shortPos.join(" · ")} tone="danger" />
        <KpiCard size="xs" label="Value of shortages" value={formatCNY(summary.shortValue)} sub="taken off supplier payments" />
        <KpiCard size="xs" label="Orders received in full" value={formatNumber(summary.full)} sub="no shortage" />
      </KpiRow>
      <div className="min-w-0">
        <ReceivedTable lines={lines} />
      </div>
    </ReportFrame>
  );
}

/** 13.4 Containers timeline (36_13.4_Containers_timeline.jpeg). */
export function ContainersTimelineScreen({ data }: { data: ContainersTimelineReport }) {
  const { kpis } = data;
  return (
    <ReportFrame title="Containers timeline">
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Active containers" value={formatNumber(data.containers.length)} />
        <KpiCard
          size="xs"
          label="Arriving in 7 days"
          value={formatNumber(kpis.arrivingIn7Days.length)}
          sub={kpis.arrivingIn7Days.map(formatShortDate).join(" · ")}
        />
        <KpiCard size="xs" label="Average sea time" value={`${kpis.averageSeaDays} days`} sub="loaded to arrival" />
        <KpiCard size="xs" label="Next arrival" value={formatShortDate(kpis.nextArrival.date)} sub={kpis.nextArrival.container} />
      </KpiRow>
      <SectionCard title="Container timeline" titleGap="none" className="pb-[15px]">
        <CardSubtitle>From the day of loading to arrival in India</CardSubtitle>
        <ContainersGantt axis={data.axis} containers={data.containers} />
      </SectionCard>
    </ReportFrame>
  );
}

/** 13.5 Payments per supplier (37_13.5_Payments_per_supplier.jpeg). */
export function PaymentsPerSupplierScreen({ data }: { data: PaymentsPerSupplierReport }) {
  const totals = supplierTotals(data.suppliers);
  return (
    <ReportFrame title="Payments per supplier">
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Order value" value={formatCNY(totals.orderValue)} sub={`${totals.orders} open orders`} />
        <KpiCard size="xs" label="Paid so far" value={formatCNY(totals.paid)} sub={`${formatINR(totals.paidInr)} at payment-day rates`} />
        <KpiCard size="xs" label="Balance to pay" value={formatCNY(totals.balance)} sub={`next 30 days est. ${formatINR(data.dueNext30DaysInr)}`} />
      </KpiRow>
      <div className="min-w-0">
        <SupplierPaymentsTable rows={data.suppliers} />
      </div>
      {/* "Paid payments page" is plain text: that page is not designed. */}
      <Footnote>Open orders only. Finished orders ({data.finishedOrders.join(", ")}) are in the Paid payments page.</Footnote>
    </ReportFrame>
  );
}

/** 13.6 Landed cost by month (38_13.6_Landed_cost_by_month.jpeg). */
export function LandedCostByMonthScreen({ data }: { data: LandedCostByMonthReport }) {
  const totals = monthTotals(data.months);
  return (
    <ReportFrame title="Landed cost by month">
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Landed cost, all months" value={formatINR(totals.landedCost)} sub={formatQty(totals.pieces, "pcs")} />
        <KpiCard size="xs" label="Biggest month" value={data.biggestMonth} sub={formatINR(totals.biggest)} />
        <KpiCard size="xs" label="Average per piece" value={totals.perPiece === null ? "–" : formatINR(totals.perPiece, 2)} sub="all months" />
      </KpiRow>
      <div className="grid gap-(--page-gap) lg:grid-cols-2">
        <SectionCard title="Landed cost by month" titleGap="none">
          <LandedCostChart months={data.months} className="mt-[22px] h-[269px]" />
        </SectionCard>
        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="By month" titleGap="none" className="pb-[19.5px]">
            <div className="mt-3">
              <MonthTable months={data.months} />
            </div>
          </SectionCard>
          <Callout size="sm" className="py-[10.75px]">Month = the month the goods were received in the India warehouse.</Callout>
        </div>
      </div>
    </ReportFrame>
  );
}
