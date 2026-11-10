import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { UrlSelect } from "@/features/reports/report-actions";
import { CardSubtitle, Footnote } from "@/features/reports/report-screens";
import { formatNumber } from "@/lib/formatters";

import type { SupplierInsightsData } from "./data/queries";
import { ValueChart } from "./supplier-charts";
import { PerformanceTable, TopPerformersTable } from "./supplier-tables";
import { daysText, rateText } from "./suppliers-logic";

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;

/** The dashboards' header filters: the Reports hub's Period and Supplier selects, kept in the URL. */
export function InsightFilters({ periods, suppliers }: Pick<SupplierInsightsData, "periods" | "suppliers">) {
  return (
    // Hidden on phones (an undesigned width), where they would squeeze the page title out of the header.
    <div className="hidden items-center gap-3.5 sm:flex">
      <UrlSelect param="period" size="sm" showLabel label="Period" options={periods} className="h-[37px]" />
      <UrlSelect param="supplier" size="sm" label="Supplier" options={[{ value: "all", label: "All suppliers" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} className="h-[37px]" />
    </div>
  );
}

/**
 * Supplier Performance (SUP-2): completion and delivery figures from the orders placed in the period and their China
 * receipts, the top performers, on-time rates per supplier and the supplier-wise purchase table.
 */
export function SupplierPerformance({ data }: { data: SupplierInsightsData }) {
  const { summary, suppliers, bySupplier, top } = data.data;
  const measured = bySupplier.filter((row) => row.delivered > 0);
  return (
    <>
      <KpiRow gap="sm" className="grid-cols-1 sm:grid-cols-2 md:grid-flow-row md:grid-cols-3 xl:grid-cols-5">
        <KpiCard size="xs" label="Total suppliers" value={formatNumber(suppliers.total)} sub={`${formatNumber(suppliers.active)} active`} />
        <KpiCard size="xs" label="PO completion rate" value={rateText(summary.completionRate)} sub={`${formatNumber(summary.completed)} of ${plural(summary.orders, "order")} closed`} />
        <KpiCard size="xs" label="On-time delivery rate" value={rateText(summary.onTimeRate)} sub={`${formatNumber(summary.onTime)} of ${formatNumber(summary.delivered)} ${summary.delivered === 1 ? "delivery" : "deliveries"} on time`} />
        <KpiCard size="xs" label="Delayed deliveries" value={formatNumber(summary.delayed)} tone={summary.delayed > 0 ? "danger" : "default"} sub="late or overdue" />
        <KpiCard size="xs" label="Average delivery time" value={daysText(summary.averageDeliveryDays)} sub="order to China receipt" />
      </KpiRow>
      <div className="grid gap-(--page-gap) lg:grid-cols-2">
        <SectionCard title="Top-performing suppliers" titleGap="none" className="min-w-0">
          <CardSubtitle>Best on-time rate among suppliers that delivered, then most completed</CardSubtitle>
          <div className="mt-3">{top.length ? <TopPerformersTable rows={top} /> : <EmptyState title="No deliveries recorded in this period." />}</div>
        </SectionCard>
        <SectionCard title="On-time delivery by supplier" titleGap="none" className="min-w-0">
          <CardSubtitle>Share of deliveries received in China by the delivery date</CardSubtitle>
          <ValueChart
            label="On-time delivery rate by supplier"
            unit="percent"
            rows={measured.map((row) => ({ label: row.name, value: row.onTimeRate ?? 0 }))}
            empty="No deliveries recorded in this period."
          />
        </SectionCard>
      </div>
      <div className="grid gap-(--page-gap) lg:grid-cols-2">
        <SectionCard title="Average delivery time by supplier" titleGap="none" className="min-w-0">
          <CardSubtitle>Days from the order date to the first China receipt</CardSubtitle>
          <ValueChart label="Average delivery days by supplier" unit="days" rows={measured.map((row) => ({ label: row.name, value: row.averageDeliveryDays ?? 0 }))} empty="No deliveries recorded in this period." />
        </SectionCard>
        <SectionCard title="Delayed deliveries by supplier" titleGap="none" className="min-w-0">
          <CardSubtitle>Received after the delivery date, or overdue and not received</CardSubtitle>
          <ValueChart label="Delayed deliveries by supplier" rows={bySupplier.map((row) => ({ label: row.name, value: row.delayed }))} empty="No delayed deliveries." />
        </SectionCard>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <SectionCard title="Supplier-wise purchase value" titleGap="none" className="min-w-0">
          <CardSubtitle>Every supplier with orders in the period, biggest purchase value first (per currency, CNY first)</CardSubtitle>
          <div className="mt-3">
            <PerformanceTable rows={bySupplier} />
          </div>
        </SectionCard>
        <Footnote>
          Measured from the records: an order counts as delivered on the day of its first China receipt and as completed once it is closed (all goods
          stocked in India). Money is shown per order currency and never added across currencies. Nothing is estimated.
        </Footnote>
      </div>
    </>
  );
}
