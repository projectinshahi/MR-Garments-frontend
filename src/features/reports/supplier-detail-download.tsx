"use client";

import type { SupplierStatement } from "@/lib/api/deposits-types";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { todayInIndia } from "@/lib/today";

import type { SupplierPaymentDetail } from "./data/queries";
import { detailQuery, PAGE_PARAMS } from "./data/supplier-detail-params";
import { ReportDownload } from "./report-actions";
import { supplierDetailFile } from "./supplier-detail-files";

/**
 * The supplier detail's "Download report": the page shows ten rows a list, so the file loads every row of each list
 * (RPT-5D `all=1`) with the page's filters, and the supplier's deposits (SD-1) when the user may view payments.
 */
export function SupplierDetailDownload({ supplierId, search, filters }: { supplierId: string; search: string; filters: string }) {
  const file = async () => {
    const query = new URLSearchParams(detailQuery(new URLSearchParams(search)).slice(1));
    for (const key of Object.values(PAGE_PARAMS)) query.delete(key);
    query.set("all", "1");
    const id = encodeURIComponent(supplierId);
    const [data, statement] = await Promise.all([
      apiClient.get<SupplierPaymentDetail>(`/reports/payments-per-supplier/${id}?${query}`),
      apiClient.get<SupplierStatement>(`/suppliers/${id}/deposits`).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) return null;
        throw error;
      }),
    ]);
    return supplierDetailFile(data, statement, filters, todayInIndia());
  };
  return <ReportDownload file={file} />;
}
