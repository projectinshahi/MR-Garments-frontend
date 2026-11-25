"use client";

import { ReportDownload } from "@/features/reports/report-actions";
import { apiClient } from "@/lib/api/client";
import type { HistoryEventsResponse, SupplierHistoryReport } from "@/lib/api/supplier-history-types";
import { notifySuccess } from "@/lib/feedback";

import { historyFile } from "./history-file";

/**
 * "Download report" for a history timeline: the click shows "Preparing…" at once, loads every matching event (all=1,
 * the page's filters) and builds the file in the browser; a toast says when it is saved, a failure is toasted.
 */
export function HistoryDownload({ apiPath, title, filename, filters, withSupplier }: { apiPath: string; title: string; filename: string; filters: string; withSupplier: boolean }) {
  return (
    <ReportDownload
      file={async () => {
        const join = apiPath.includes("?") ? "&" : "?";
        const data = await apiClient.get<HistoryEventsResponse | SupplierHistoryReport>(`${apiPath}${join}all=1`);
        return historyFile(data.events.rows, { title, filename, filters, withSupplier });
      }}
      onSaved={(file, format) => notifySuccess(`Saved ${file.filename}.${format}`)}
    />
  );
}
