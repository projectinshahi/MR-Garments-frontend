import { filterLabel } from "@/features/reports/data/filters";
import { monthLabel } from "@/features/reports/report-logic";
import { amountsText, type Column, money, perCurrency, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import type { SupplierInsightRow } from "@/lib/api/suppliers-types";
import type { Currency } from "@/types/domain";

import type { SupplierInsightsData } from "./data/queries";

// Supplier Performance / Analytics report download (backend docs/suppliers.md SUP-2, docs/report-downloads.md): the
// tab's figures for the URL's period and supplier, as SUP-2 counts them: performance per supplier, the top suppliers,
// suppliers per country and the month-by-month order value and payments (one table per currency, never added).

const text = (header: string): Column => ({ header });
const pct = (rate: number | null) => (rate === null ? null : `${rate}%`);

const performanceColumns = [
  text("Supplier code"),
  text("Supplier"),
  text("Country"),
  text("Orders"),
  text("Completed"),
  text("Completion rate"),
  text("Delivered"),
  text("On time"),
  text("On-time rate"),
  text("Delayed"),
  text("Average delivery days"),
  text("Order value"),
  text("Balance"),
];
const performanceRow = (s: SupplierInsightRow) => [
  s.code || null,
  s.name,
  s.country || null,
  s.orders,
  s.completed,
  pct(s.completionRate),
  s.delivered,
  s.onTime,
  pct(s.onTimeRate),
  s.delayed,
  s.averageDeliveryDays,
  amountsText(s.value),
  amountsText(s.balance),
];

export function supplierInsightsFile(page: SupplierInsightsData, tab: "performance" | "analytics"): ReportFile {
  const { data, today } = page;
  const s = data.summary;
  const monthly = data.monthly.flatMap((m) =>
    [...new Set([...m.value, ...m.paid].map((t) => t.currency))].map((currency: Currency) => ({
      month: m.month,
      currency,
      value: m.value.find((t) => t.currency === currency)?.amount ?? 0,
      paid: m.paid.find((t) => t.currency === currency)?.amount ?? 0,
    })),
  );
  const monthlySections: Section[] = [
    ...perCurrency(monthly).map(([currency, list]) => ({
      sheet: "Monthly",
      title: `Order value and payments by month (${currency})`,
      columns: [text("Month"), money("Order value placed", currency), money("Paid to suppliers", currency)],
      rows: list.map((m) => [monthLabel(m.month), m.value, m.paid]),
    })),
    {
      sheet: "Monthly",
      title: "Payments by month in INR (each at its payment-day rate)",
      columns: [text("Month"), money("Paid", "INR")],
      rows: data.monthly.map((m) => [monthLabel(m.month), m.paidInr]),
    },
  ];
  return {
    title: tab === "performance" ? "Supplier performance" : "Supplier analytics",
    filename: `supplier-${tab}-${today}`,
    filters: filterLabel({ from: data.filter.from, supplier: data.filter.supplier }) ?? "All dates · All suppliers",
    notes: ["Rates are whole percentages of the orders measured; \"–\" where nothing was measured. Amounts are one total per order currency."],
    sections: [
      summarySection([
        ["Suppliers", data.suppliers.total],
        ["Active suppliers", data.suppliers.active],
        ["Orders", s.orders],
        ["Completed", s.completed],
        ["Completion rate", pct(s.completionRate) ?? "–"],
        ["Delivered", s.delivered],
        ["On time", s.onTime],
        ["On-time rate", pct(s.onTimeRate) ?? "–"],
        ["Delayed", s.delayed],
        ["Average delivery days", s.averageDeliveryDays ?? "–"],
      ]),
      { sheet: "By Supplier", title: "Performance by supplier", columns: performanceColumns, rows: data.bySupplier.map(performanceRow) },
      { sheet: "Top Suppliers", title: "Top suppliers", columns: performanceColumns, rows: data.top.map(performanceRow) },
      { sheet: "By Country", title: "Suppliers by country", columns: [text("Country"), text("Suppliers")], rows: data.byCountry.map((c) => [c.country || "Not set", c.suppliers]) },
      ...monthlySections,
    ],
  };
}
