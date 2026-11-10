import { SectionCard } from "@/components/shared/cards";
import { monthLabel } from "@/features/reports/report-logic";
import { CardSubtitle, Footnote } from "@/features/reports/report-screens";

import type { SupplierInsightsData } from "./data/queries";
import { MoneyCharts, ValueChart } from "./supplier-charts";
import { TopValueTable } from "./supplier-tables";

/**
 * Supplier Analytics (SUP-2): purchase value per supplier, suppliers per country, monthly purchase and payment trends,
 * outstanding balances and the top suppliers, from the orders placed in the period.
 */
export function SupplierAnalytics({ data }: { data: SupplierInsightsData }) {
  const { bySupplier, byCountry, monthly } = data.data;
  const months = monthly.map((month) => ({ ...month, label: monthLabel(month.month) }));
  return (
    <>
      <div className="grid gap-(--page-gap) lg:grid-cols-2">
        <SectionCard title="Supplier-wise purchase value" titleGap="none" className="min-w-0">
          <CardSubtitle>Order value of the orders placed in the period, per supplier and per currency (CNY first)</CardSubtitle>
          <MoneyCharts label="Purchase value by supplier" rows={bySupplier.map((row) => ({ label: row.name, totals: row.value }))} empty="No orders in this period." />
        </SectionCard>
        <SectionCard title="Country-wise supplier distribution" titleGap="none" className="min-w-0">
          <CardSubtitle>Every supplier by the country on its profile</CardSubtitle>
          <ValueChart label="Suppliers by country" rows={byCountry.map((row) => ({ label: row.country || "Not set", value: row.suppliers }))} empty="No suppliers yet." />
        </SectionCard>
      </div>
      <SectionCard title="Monthly purchase trends" titleGap="none" className="min-w-0">
        <CardSubtitle>Order value by the month the orders were placed</CardSubtitle>
        <MoneyCharts label="Purchase value by month" rows={months.map((month) => ({ label: month.label, totals: month.value }))} empty="No orders in these months." />
      </SectionCard>
      <div className="grid gap-(--page-gap) lg:grid-cols-2">
        <SectionCard title="Outstanding balance by supplier" titleGap="none" className="min-w-0">
          <CardSubtitle>Order value less payments to the supplier, per order currency</CardSubtitle>
          <MoneyCharts label="Outstanding balance by supplier" rows={bySupplier.map((row) => ({ label: row.name, totals: row.balance }))} empty="Nothing outstanding." />
        </SectionCard>
        <SectionCard title="Top suppliers by purchase value" titleGap="none" className="min-w-0">
          <CardSubtitle>The five biggest in the period, ranked per currency (CNY first)</CardSubtitle>
          <div className="mt-3">
            <TopValueTable rows={bySupplier} />
          </div>
        </SectionCard>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <SectionCard title="Supplier payment trends" titleGap="none" className="min-w-0">
          <CardSubtitle>Payments to suppliers by the month they were paid, in INR at each payment&apos;s own rate</CardSubtitle>
          <ValueChart label="Supplier payments by month, INR" unit="inr" rows={months.map((month) => ({ label: month.label, value: month.paidInr }))} empty="No supplier payments in these months." />
        </SectionCard>
        <Footnote>
          Supplier payments only: payments to shipping agents (sea freight) are not included. Amounts in different order currencies are charted apart
          and never added together.
        </Footnote>
      </div>
    </>
  );
}
