import { notFound } from "next/navigation";

import { type SearchParams, toParams } from "@/features/calendar/params";
import type { AdvanceArchiveResponse, SupplierStatement } from "@/lib/api/deposits-types";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type {
  HistoryEventsResponse,
  HistoryLandedCostResponse,
  HistoryOrdersResponse,
  HistoryPaymentsResponse,
  HistoryReceiptsResponse,
  SupplierHistoryHeader,
  SupplierHistoryOverview,
  SupplierHistoryReport,
} from "@/lib/api/supplier-history-types";
import { todayInIndia } from "@/lib/today";

import { historyQuery } from "./history-logic";

// Supplier Full History reads (backend docs/supplier-history.md). Each profile tab makes one call; the header's overview
// (SH-0: supplier, holds, live balances) is loaded once by the tabs' layout; SH-1's totals only by the Overview. The calls read the session cookie; an unknown supplier is the 404 page.

async function load<T>(path: string) {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
const base = (id: string) => `/suppliers/${encodeURIComponent(id)}/history`;

export const getHistoryOverview = (id: string) => load<SupplierHistoryOverview>(base(id));
export const getHistoryHeader = (id: string) => load<SupplierHistoryHeader>(`${base(id)}/header`);

/** A tab's data with the page URL's query (`search`, for the paging links) and today in India. */
async function tab<T>(id: string, segment: string, search: SearchParams, list: Parameters<typeof historyQuery>[1]) {
  const params = toParams(search);
  const data = await load<T>(`${base(id)}${segment}${historyQuery(params, list)}`);
  return { data, search: params.toString(), today: todayInIndia() };
}
export const getHistoryOrders = (id: string, search: SearchParams) => tab<HistoryOrdersResponse>(id, "/orders", search, { statuses: ["pending", "active", "closed"] });
export const getHistoryPayments = (id: string, search: SearchParams) => tab<HistoryPaymentsResponse>(id, "/payments", search, { statuses: ["active", "voided"] });
export const getHistoryReceipts = (id: string, search: SearchParams) => tab<HistoryReceiptsResponse>(id, "/receipts", search, {});
export const getHistoryLandedCost = (id: string, search: SearchParams) => tab<HistoryLandedCostResponse>(id, "/landed-cost", search, { statuses: ["final", "estimate", "none"] });
export const getHistoryEvents = (id: string, search: SearchParams) => tab<HistoryEventsResponse>(id, "/events", search, { statuses: ["active", "voided", "held", "migrated"], events: true });

/** The legacy archives (ADV-1, SD-1), read-only: shown as they are, never on the account. */
export async function getHistoryArchive(id: string) {
  const key = encodeURIComponent(id);
  const archive = <T,>(path: string) => apiGet<T>(path).catch((): null => null);
  const [advances, deposits] = await Promise.all([archive<AdvanceArchiveResponse>(`/suppliers/${key}/advances`), archive<SupplierStatement>(`/suppliers/${key}/deposits`)]);
  return { advances, deposits };
}

/** RPT-SH: the Supplier History report with the page URL's filters. */
export async function getSupplierHistoryReport(search: SearchParams) {
  const params = toParams(search);
  const data = await apiGet<SupplierHistoryReport>(`/reports/supplier-history${historyQuery(params, { statuses: ["active", "voided", "held", "migrated"], events: true, supplier: true })}`);
  return { data, search: params.toString(), today: todayInIndia() };
}
export type SupplierHistoryReportPage = Awaited<ReturnType<typeof getSupplierHistoryReport>>;
