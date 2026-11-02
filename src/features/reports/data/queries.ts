import { notFound } from "next/navigation";

import { type SearchParams, toParams } from "@/features/calendar/params";
import { ApiError } from "@/lib/api/errors";
import type {
  ContainersTimelineReport,
  DeliveriesPerDayReport,
  LandedCostByMonthReport,
  OrderedVsReceivedReport,
  OrderStatusReport,
  PaymentsPerSupplierReport,
  ReportsSummary,
  SupplierPaymentDetail,
} from "@/lib/api/reports-types";
import { apiGet } from "@/lib/api/server";
import { todayInIndia } from "@/lib/today";

import { filterQuery, periodOptions, reportQuery } from "./filters";
import { detailQuery } from "./supplier-detail-params";

// The Reports hub (32) and the six reports (33–38) read GET /reports/<name>, filtered by the page URL's ?period=YYYY-MM
// and ?supplier=<id>. The calls read the session cookie, so the pages render inside the (app) loading.tsx Suspense
// boundary; failures throw to error.tsx. Today is read after the API call (Cache Components).

/** A report's data, today in India, and the page's filter query (kept on the links back to the hub). */
async function report<T>(name: string, search: SearchParams) {
  const params = toParams(search);
  const data = await apiGet<T>(`/reports/${name}${reportQuery(params)}`);
  return { data, today: todayInIndia(), query: filterQuery(params) };
}

export type ReportPage<T> = Awaited<ReturnType<typeof report<T>>>;

/** Reports hub: the stat strips, the supplier options and this year's periods. */
export async function getReportsHub(search: SearchParams) {
  const { data, today, query } = await report<ReportsSummary>("summary", search);
  return { summary: data, periods: periodOptions(today), query };
}
export type ReportsHubData = Awaited<ReturnType<typeof getReportsHub>>;

export const getOrderStatusReport = (search: SearchParams) => report<OrderStatusReport>("order-status", search);
export const getDeliveriesPerDayReport = (search: SearchParams) => report<DeliveriesPerDayReport>("deliveries-per-day", search);
export const getOrderedVsReceivedReport = (search: SearchParams) => report<OrderedVsReceivedReport>("ordered-vs-received", search);
export const getContainersTimelineReport = (search: SearchParams) => report<ContainersTimelineReport>("containers-timeline", search);
export const getPaymentsPerSupplierReport = (search: SearchParams) => report<PaymentsPerSupplierReport>("payments-per-supplier", search);
export const getLandedCostByMonthReport = (search: SearchParams) => report<LandedCostByMonthReport>("landed-cost-by-month", search);

/**
 * One supplier's payments, orders and lines (RPT-5D) for the report's period, with the page's own list filters and
 * pages; `query` is the report's filters (for the way back), `search` the whole URL query (for the list controls). An
 * unknown supplier is a 404: the not-found page.
 */
export async function getSupplierPaymentDetail(supplierId: string, search: SearchParams) {
  const params = toParams(search);
  let data: SupplierPaymentDetail;
  try {
    data = await apiGet<SupplierPaymentDetail>(`/reports/payments-per-supplier/${encodeURIComponent(supplierId)}${detailQuery(params)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return { data, today: todayInIndia(), query: filterQuery(params), search: params.toString() };
}
export type SupplierDetailPage = Awaited<ReturnType<typeof getSupplierPaymentDetail>>;

export type {
  ContainersTimelineReport,
  DeliveriesPerDayReport,
  LandedCostByMonthReport,
  OrderedVsReceivedReport,
  OrderStatusReport,
  PaymentsPerSupplierReport,
  ReportsSummary,
  SupplierPaymentDetail,
};
