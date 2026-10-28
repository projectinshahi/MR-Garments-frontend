import { format, parseISO } from "date-fns";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { BarChart } from "@/components/shared/bar-chart";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { ProgressBar } from "@/components/shared/progress";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { formatCNY, formatINR, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import { ContainersGantt } from "./containers-gantt";
import type { CsvCell } from "./csv";
import { filterLabel } from "./data/filters";
import type {
  ContainersTimelineReport,
  DeliveriesPerDayReport,
  LandedCostByMonthReport,
  OrderedVsReceivedReport,
  OrderStatusReport,
  PaymentsPerSupplierReport,
  ReportPage,
} from "./data/queries";
import { ExportActions } from "./report-actions";
import { LandedCostChart, LateOrdersTable, MonthTable, ReceivedTable, SupplierPaymentsTable } from "./report-widgets";

// The six reports (33–38): breadcrumb "Reports / <title>" (back to the hub with the same filters), the filters in a
// pill when set, export buttons, xs KPI tiles and the report body. Each CSV holds the report's table as shown.

type Filtered = { filter: { from: string | null; supplier: string | null } };

const plural = (count: number, noun: string, nouns = `${noun}s`) => `${count} ${count === 1 ? noun : nouns}`;
/** Up to three items joined, then "+N". */
const few = (list: string[], separator: string) => (list.length > 3 ? `${list.slice(0, 3).join(separator)} +${list.length - 3}` : list.join(separator));
const orDash = (value: number | null, show: (value: number) => string) => (value === null ? "–" : show(value));

type FrameProps = { title: string; name: string; page: ReportPage<Filtered>; csv: CsvCell[][]; period?: boolean; children: React.ReactNode };

/** `period={false}`: the report ignores the period (13.2 always shows the next 14 days), so its pill leaves it out. */
function ReportFrame({ title, name, page, csv, period = true, children }: FrameProps) {
  const label = filterLabel(period ? page.data.filter : { ...page.data.filter, from: null });
  return (
    <>
      <PageHeader
        title={title}
        parent={{ label: "Reports", href: `/reports${page.query}` }}
        titleAddon={label ? <StatusPill tone="neutral">{label}</StatusPill> : undefined}
        actions={<ExportActions csv={{ filename: `${name}-${page.today}.csv`, rows: csv }} />}
      />
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
export function OrderStatusScreen({ page }: { page: ReportPage<OrderStatusReport> }) {
  const { data } = page;
  const max = Math.max(...data.stageCounts);
  const csv: CsvCell[][] = [
    ["Stage", "Orders"],
    ...data.stageCounts.map((count, index) => [`${index + 1}. ${STAGES[index]}`, count]),
    [],
    ["PO", "Supplier", "Due", "Late by (days)"],
    ...data.late.map((order) => [order.po, order.supplier, order.due, order.lateDays]),
  ];
  return (
    <ReportFrame title="Order status" name="order-status" page={page} csv={csv}>
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Active orders" value={formatNumber(data.total)} sub={`across ${STAGES.length} stages`} />
        <KpiCard size="xs" label="Late orders" value={formatNumber(data.late.length)} sub="need follow-up" tone="danger" />
        <KpiCard size="xs" label="Finished this month" value={formatNumber(data.finishedThisMonth)} sub="reached the warehouse" />
        <KpiCard size="xs" label="Average order time" value={orDash(data.averageOrderDays, (n) => plural(n, "day"))} sub="order to warehouse" />
      </KpiRow>
      {data.total === 0 ? (
        <EmptyState title="No orders yet." />
      ) : (
        <div className="grid gap-(--page-gap) lg:grid-cols-2">
          <SectionCard title="Orders by stage" titleGap="none" className="pb-[18.5px]">
            <ul className="mt-3">
              {data.stageCounts.map((count, index) => {
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
            <div className="mt-3">{data.late.length ? <LateOrdersTable rows={data.late} /> : <EmptyState title="No late orders." />}</div>
          </SectionCard>
        </div>
      )}
    </ReportFrame>
  );
}

/** "Thu 1" */
const dayLabel = (date: string) => format(parseISO(date), "EEE d");

/** 13.2 Deliveries per day (34_13.2_Deliveries_per_day.jpeg). */
export function DeliveriesPerDayScreen({ page }: { page: ReportPage<DeliveriesPerDayReport> }) {
  const { data } = page;
  const busiest = data.busiest;
  const csv: CsvCell[][] = [["Date", "Deliveries due"], ...data.days.map((day) => [day.date, day.count])];
  return (
    <ReportFrame title="Deliveries per day" name="deliveries-per-day" page={page} csv={csv} period={false}>
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Due next 7 days" value={formatNumber(data.dueNext7)} sub={`from ${plural(data.suppliersNext7, "supplier")}`} />
        <KpiCard size="xs" label="Due next 14 days" value={formatNumber(data.dueNext14)} sub={`${formatShortDate(data.from)} to ${formatShortDate(data.to)}`} />
        <KpiCard
          size="xs"
          label="Busiest day"
          value={busiest ? few(busiest.dates.map(dayLabel), " · ") : "–"}
          sub={busiest ? `${plural(busiest.count, "delivery", "deliveries")}${busiest.dates.length > 1 ? " each" : ""}` : "nothing due"}
        />
        <KpiCard size="xs" label="Days with none" value={formatNumber(data.daysWithNone)} sub="in next 14 days" />
      </KpiRow>
      <SectionCard title="Deliveries due per day" titleGap="none" className="pb-[26.5px]">
        <CardSubtitle>
          Next 14 days, {formatShortDate(data.from)} to {format(parseISO(data.to), "d MMM yyyy")}
        </CardSubtitle>
        {data.dueNext14 === 0 ? (
          <EmptyState title="No deliveries due in the next 14 days." />
        ) : (
          <div className="overflow-x-auto">
            <BarChart
              size="sm"
              label="Deliveries due per day, next 14 days"
              data={data.days.map((day) => ({ label: dayLabel(day.date), value: day.count }))}
              className="mt-[80px] h-[176px] min-w-[560px] px-[3px]"
            />
          </div>
        )}
      </SectionCard>
      <Footnote>Late deliveries ({data.late}) are not in this chart. See the Delivery Calendar.</Footnote>
    </ReportFrame>
  );
}

/** 13.3 Ordered vs received (35_13.3_Ordered_vs_received.jpeg). */
export function OrderedVsReceivedScreen({ page }: { page: ReportPage<OrderedVsReceivedReport> }) {
  const { data } = page;
  const csv: CsvCell[][] = [
    ["PO", "Supplier", "Item", "Unit", "Ordered", "Received", "Short", "Value of short (CNY)", "Payment"],
    ...data.lines.map((l) => [l.po, l.supplier, l.item, l.unit, l.ordered, l.received, l.short, l.shortValueCny, l.short > 0 ? "Reduced" : "Full"]),
  ];
  return (
    <ReportFrame title="Ordered vs received" name="ordered-vs-received" page={page} csv={csv}>
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Orders checked" value={formatNumber(data.ordersChecked)} sub="received in China" />
        <KpiCard size="xs" label="Orders with a shortage" value={formatNumber(data.shortPos.length)} sub={few(data.shortPos, " · ") || "none"} tone="danger" />
        <KpiCard size="xs" label="Value of shortages" value={formatCNY(data.shortValueCny)} sub="taken off supplier payments" />
        <KpiCard size="xs" label="Orders received in full" value={formatNumber(data.fullOrders)} sub="no shortage" />
      </KpiRow>
      <div className="min-w-0">{data.lines.length ? <ReceivedTable lines={data.lines} /> : <EmptyState title="No orders received in China yet." />}</div>
    </ReportFrame>
  );
}

/** 13.4 Containers timeline (36_13.4_Containers_timeline.jpeg). */
export function ContainersTimelineScreen({ page }: { page: ReportPage<ContainersTimelineReport> }) {
  const { data } = page;
  const csv: CsvCell[][] = [["Container", "Status", "Loaded", "Arrival"], ...data.containers.map((c) => [c.number, c.status, c.loadedOn, c.arrival])];
  return (
    <ReportFrame title="Containers timeline" name="containers-timeline" page={page} csv={csv}>
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Active containers" value={formatNumber(data.active)} />
        <KpiCard size="xs" label="Arriving in 7 days" value={formatNumber(data.arrivingIn7Days.length)} sub={few(data.arrivingIn7Days.map(formatShortDate), " · ")} />
        <KpiCard size="xs" label="Average sea time" value={orDash(data.averageSeaDays, (n) => plural(n, "day"))} sub="loaded to arrival" />
        <KpiCard size="xs" label="Next arrival" value={data.nextArrival ? formatShortDate(data.nextArrival.date) : "–"} sub={data.nextArrival?.number} />
      </KpiRow>
      <SectionCard title="Container timeline" titleGap="none" className="pb-[15px]">
        <CardSubtitle>From the day of loading to arrival in India</CardSubtitle>
        {data.containers.length ? (
          <ContainersGantt data={data} today={page.today} />
        ) : (
          <EmptyState title="No containers in this period." />
        )}
      </SectionCard>
    </ReportFrame>
  );
}

/** 13.5 Payments per supplier (37_13.5_Payments_per_supplier.jpeg). */
export function PaymentsPerSupplierScreen({ page }: { page: ReportPage<PaymentsPerSupplierReport> }) {
  const { data } = page;
  const { totals } = data;
  const csv: CsvCell[][] = [
    ["Supplier", "Orders", "Order value (CNY)", "Paid (CNY)", "Paid (INR)", "Balance (CNY)"],
    ...data.suppliers.map((s) => [s.supplier, s.orders.join(", "), s.orderValueCny, s.paidCny, s.paidInr, s.balanceCny]),
    ["Total", plural(totals.orders, "open order"), totals.orderValueCny, totals.paidCny, totals.paidInr, totals.balanceCny],
  ];
  return (
    <ReportFrame title="Payments per supplier" name="payments-per-supplier" page={page} csv={csv}>
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Order value" value={formatCNY(totals.orderValueCny)} sub={plural(totals.orders, "open order")} />
        <KpiCard size="xs" label="Paid so far" value={formatCNY(totals.paidCny)} sub={`${formatINR(totals.paidInr)} at payment-day rates`} />
        <KpiCard size="xs" label="Balance to pay" value={formatCNY(totals.balanceCny)} sub={`next 30 days ${formatCNY(data.dueNext30Cny)} due`} />
      </KpiRow>
      <div className="min-w-0">
        {data.suppliers.length ? <SupplierPaymentsTable rows={data.suppliers} totals={totals} /> : <EmptyState title="No open orders." />}
      </div>
      {/* "Paid payments page" is plain text: that page is not designed. */}
      <Footnote>
        Open orders only.{data.finishedPos.length ? ` Finished orders (${few(data.finishedPos, ", ")}) are in the Paid payments page.` : null}
      </Footnote>
    </ReportFrame>
  );
}

/** 13.6 Landed cost by month (38_13.6_Landed_cost_by_month.jpeg). */
export function LandedCostByMonthScreen({ page }: { page: ReportPage<LandedCostByMonthReport> }) {
  const { data } = page;
  const { totals, biggest } = data;
  const csv: CsvCell[][] = [
    ["Month", "Pieces", "Landed cost (INR)", "Per piece (INR)"],
    ...data.months.map((m) => [m.month, m.pieces, m.landedCostInr, m.perPieceInr]),
    ["Total", totals.pieces, totals.landedCostInr, totals.perPieceInr],
  ];
  return (
    <ReportFrame title="Landed cost by month" name="landed-cost-by-month" page={page} csv={csv}>
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Landed cost, all months" value={formatINR(totals.landedCostInr)} sub={formatQty(totals.pieces, "pcs")} />
        <KpiCard
          size="xs"
          label="Biggest month"
          value={biggest ? format(parseISO(`${biggest.month}-01`), "MMMM") : "–"}
          sub={biggest ? formatINR(biggest.landedCostInr) : "no finished orders"}
        />
        <KpiCard size="xs" label="Average per piece" value={orDash(totals.perPieceInr, (n) => formatINR(n, 2))} sub="all months" />
      </KpiRow>
      {totals.orders === 0 ? (
        <EmptyState title="No finished orders yet." description="An order counts here once all its costs are entered and its goods are in the warehouse." />
      ) : (
        <div className="grid gap-(--page-gap) lg:grid-cols-2">
          <SectionCard title="Landed cost by month" titleGap="none">
            <LandedCostChart months={data.months} className="mt-[22px] h-[269px]" />
          </SectionCard>
          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <SectionCard title="By month" titleGap="none" className="pb-[19.5px]">
              <div className="mt-3">
                <MonthTable months={data.months} totals={totals} />
              </div>
            </SectionCard>
            <Callout size="sm" className="py-[10.75px]">Month = the month the goods were received in the India warehouse.</Callout>
          </div>
        </div>
      )}
    </ReportFrame>
  );
}
