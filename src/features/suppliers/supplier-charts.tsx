"use client";

import { BarChart } from "@/components/shared/bar-chart";
import { EmptyState } from "@/components/shared/states";
import { CURRENCY_NAME, formatINR, formatMoney, formatNumber } from "@/lib/formatters";
import { CURRENCIES, type MoneyTotal } from "@/types/domain";

// The Suppliers dashboards' charts: the shared BarChart (Reports), one per order currency for money, since amounts
// in different currencies are never added together. Client-side because the value formatters are functions.

/** A chart label that fits a bar: up to 14 characters, then an ellipsis. */
export const shortLabel = (label: string) => (label.length > 15 ? `${label.slice(0, 14)}…` : label);

export type MoneyBar = { label: string; totals: MoneyTotal[] };

/**
 * Bars per currency present in `rows` (CNY, USD, INR order), each chart in its own currency with its name above it when
 * there is more than one. Nothing but zeros: the empty state.
 */
export function MoneyCharts({ rows, label, empty }: { rows: MoneyBar[]; label: string; empty: string }) {
  const currencies = CURRENCIES.filter((currency) => rows.some((row) => row.totals.some((total) => total.currency === currency && total.amount !== 0)));
  if (currencies.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="flex flex-col gap-4">
      {currencies.map((currency) => (
        <div key={currency}>
          {currencies.length > 1 ? <p className="text-[12.5px] leading-[21px] text-muted-foreground">{CURRENCY_NAME[currency]}</p> : null}
          <div className="overflow-x-auto">
            <BarChart
              label={`${label}, ${currency}`}
              data={rows.map((row) => ({ label: shortLabel(row.label), value: row.totals.find((total) => total.currency === currency)?.amount ?? 0 }))}
              formatValue={(value) => formatMoney(value, currency)}
              className="mt-3 h-[210px] min-w-[480px]"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Bars of counts, percentages, days or INR (`unit`). The empty state shows without rows, and for counts and INR when
 * every value is 0; a 0 % rate or 0 days is a real measurement and stays drawn.
 */
export function ValueChart({
  rows,
  label,
  unit = "count",
  empty,
}: {
  rows: { label: string; value: number }[];
  label: string;
  unit?: "count" | "percent" | "inr" | "days";
  empty: string;
}) {
  const nothing = rows.length === 0 || ((unit === "count" || unit === "inr") && rows.every((row) => row.value === 0));
  if (nothing) return <EmptyState title={empty} />;
  const format = (value: number) => (unit === "inr" ? formatINR(value) : unit === "percent" ? `${formatNumber(value)}%` : unit === "days" ? `${formatNumber(value)} d` : formatNumber(value));
  return (
    <div className="overflow-x-auto">
      <BarChart label={label} data={rows.map((row) => ({ label: shortLabel(row.label), value: row.value }))} formatValue={format} className="mt-3 h-[210px] min-w-[480px]" />
    </div>
  );
}
