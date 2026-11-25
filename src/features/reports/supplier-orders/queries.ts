import { type SearchParams, toParams } from "@/features/calendar/params";
import type { SupplierOrdersResponse } from "@/lib/api/reports-types";
import { apiGet } from "@/lib/api/server";
import { todayInIndia } from "@/lib/today";

import { filterQuery } from "../data/filters";
import { orderReportsQuery } from "../order-reports/params";

// Supplier order details (RPT-S1) reads GET /reports/supplier-orders with the Order reports page's URL filters (the same
// query). The call reads the session cookie, so the page renders inside the (app) loading.tsx Suspense boundary.

export async function getSupplierOrders(search: SearchParams) {
  const params = toParams(search);
  const data = await apiGet<SupplierOrdersResponse>(`/reports/supplier-orders${orderReportsQuery(params)}`);
  return { data, today: todayInIndia(), search: params.toString(), query: filterQuery(params) };
}
export type SupplierOrdersPage = Awaited<ReturnType<typeof getSupplierOrders>>;
