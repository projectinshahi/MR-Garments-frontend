import type { RouteTab } from "@/components/layout/route-tabs";
import type { FilterOption } from "@/components/shared/filters";
import { filterRecords, type StatusFilter } from "@/features/settings/settings-logic";
import type { SupplierRow } from "@/lib/api/types";
import { formatMoneyList } from "@/lib/formatters";
import type { MoneyTotal } from "@/types/domain";

// The Suppliers page's pure logic (backend docs/suppliers.md): the list's filters and the dashboards' labels.

export const SUPPLIER_TABS: RouteTab[] = [
  { href: "/suppliers", label: "Supplier List" },
  { href: "/suppliers/performance", label: "Supplier Performance" },
  { href: "/suppliers/analytics", label: "Supplier Analytics" },
];

export type SupplierFilters = { query: string; status: StatusFilter; country: string };

/** Search (name, code or country, ignoring case and spaces), the status chips and the country select ("all"). */
export function filterSuppliers(rows: SupplierRow[], { query, status, country }: SupplierFilters) {
  const matching = filterRecords(rows, { query, status }, (row) => [row.name, row.code, row.country]);
  return country === "all" ? matching : matching.filter((row) => row.country === country);
}

/** "All countries", then every country the rows have, A to Z; a missing country is offered as "Not set". */
export function countryOptions(rows: { country: string }[]): FilterOption[] {
  const countries = [...new Set(rows.map((row) => row.country))].sort((a, b) => a.localeCompare(b));
  return [{ value: "all", label: "All countries" }, ...countries.map((country) => ({ value: country, label: country || "Not set" }))];
}

/** "¥5,800 · $200", or "–" when there is nothing (no orders). */
export const moneyText = (totals: MoneyTotal[]) => (totals.length ? formatMoneyList(totals) : "–");

/** "92%", or "–" when nothing was measured. */
export const rateText = (rate: number | null) => (rate === null ? "–" : `${rate}%`);

/** "25 days", or "–" when nothing was delivered yet. */
export const daysText = (days: number | null) => (days === null ? "–" : `${days} day${days === 1 ? "" : "s"}`);
