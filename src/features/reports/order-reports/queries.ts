import { type SearchParams, toParams } from "@/features/calendar/params";
import type { OrderReportsResponse } from "@/lib/api/reports-types";
import { apiGet } from "@/lib/api/server";
import { todayInIndia } from "@/lib/today";

import { filterQuery } from "../data/filters";
import { orderReportsQuery } from "./params";

// The Order reports page (RPT-O2) reads GET /reports/orders with the page URL's filters. The call reads the session
// cookie, so the page renders inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

/** The filtered orders, today in India, the page's URL query and the hub filters (period, supplier) for the way back. */
export async function getOrderReports(search: SearchParams) {
  const params = toParams(search);
  const data = await apiGet<OrderReportsResponse>(`/reports/orders${orderReportsQuery(params)}`);
  return { data, today: todayInIndia(), search: params.toString(), query: filterQuery(params) };
}
export type OrderReportsPage = Awaited<ReturnType<typeof getOrderReports>>;
