"use client";

import { orderReportFile } from "@/features/reports/order-report/order-report-file";
import { ReportDownload } from "@/features/reports/report-actions";
import { apiClient } from "@/lib/api/client";
import type { OrderReport } from "@/lib/api/reports-types";
import { todayInIndia } from "@/lib/today";

/**
 * Every order tab's "Download report": the order's full report (RPT-O1 and its eleven sheets, the Report tab's file),
 * loaded when a format is chosen, so a tab never loads more than it shows.
 */
export function OrderReportDownload({ po }: { po: string }) {
  return (
    <ReportDownload
      file={async () => orderReportFile(await apiClient.get<OrderReport>(`/orders/${encodeURIComponent(po)}/report`), todayInIndia())}
    />
  );
}
