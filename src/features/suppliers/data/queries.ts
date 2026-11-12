import { type SearchParams, toParams } from "@/features/calendar/params";
import { filterQuery, periodOptions, reportQuery } from "@/features/reports/data/filters";
import { supplierDraft } from "@/features/settings/data/fixtures";
import { getCurrencies } from "@/features/settings/data/queries";
import { apiGet } from "@/lib/api/server";
import type { SuppliersInsights, SuppliersSummary } from "@/lib/api/suppliers-types";
import type { SupplierRow } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";

// The Suppliers page (backend docs/suppliers.md) reads MD-1, SUP-1 and SUP-2. The calls read the session cookie, so
// the pages render inside the (app) Suspense boundary; failures throw to error.tsx. Today is read after the calls
// (Cache Components).

/** Supplier List: every supplier (search, status and country stay client-side) and the KPI cards. */
export async function getSuppliersPage() {
  const [suppliers, summary, currencies] = await Promise.all([apiGet<SupplierRow[]>("/suppliers"), apiGet<SuppliersSummary>("/suppliers/summary"), getCurrencies()]);
  return { suppliers, summary, currencies, today: todayInIndia(), draft: structuredClone(supplierDraft) };
}
export type SuppliersPageData = Awaited<ReturnType<typeof getSuppliersPage>>;

/** Performance and Analytics: SUP-2 for the URL's ?period= and ?supplier= (the Reports filters), the cards and the filter options. */
export async function getSupplierInsights(search: SearchParams) {
  const params = toParams(search);
  const [data, summary, suppliers] = await Promise.all([
    apiGet<SuppliersInsights>(`/suppliers/insights${reportQuery(params)}`),
    apiGet<SuppliersSummary>("/suppliers/summary"),
    apiGet<SupplierRow[]>("/suppliers?status=Active"),
  ]);
  const today = todayInIndia();
  return { data, summary, today, periods: periodOptions(today), suppliers: suppliers.map(({ id, name }) => ({ id, name })), query: filterQuery(params) };
}
export type SupplierInsightsData = Awaited<ReturnType<typeof getSupplierInsights>>;
