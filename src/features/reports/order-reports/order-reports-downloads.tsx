"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { OrderReportsResponse } from "@/lib/api/reports-types";
import { handleApiError } from "@/lib/feedback";
import { todayInIndia } from "@/lib/today";

import { downloadReport, type FileFormat } from "../report-files";
import { orderReportsFile } from "./order-reports-file";
import { orderReportsQuery } from "./params";

/**
 * The Order reports hub card's Excel and PDF buttons: the list with the hub's filters (period as the order-date range,
 * supplier), as its Open report link shows it. The hub has no report data, so the click loads GET /reports/orders.
 * CardDownloads is typed on the six report names, so this card has its own.
 */
export function OrderReportsDownloads({ query, className }: { query: string; className: string }) {
  const [pending, startTransition] = useTransition();
  const download = (format: FileFormat) =>
    startTransition(async () => {
      try {
        const data = await apiClient.get<OrderReportsResponse>(`/reports/orders${orderReportsQuery(new URLSearchParams(query))}`);
        await downloadReport(orderReportsFile(data, todayInIndia()), format);
      } catch (error) {
        handleApiError(error);
      }
    });
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} disabled={pending} aria-label="Excel export: Order reports" onClick={() => download("xlsx")}>
        Excel
      </Button>
      <Button type="button" variant="outline" size="sm" className={className} disabled={pending} aria-label="PDF export: Order reports" onClick={() => download("pdf")}>
        PDF
      </Button>
    </>
  );
}
