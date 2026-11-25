"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { OrderReportsResponse, SupplierOrdersResponse } from "@/lib/api/reports-types";
import type { SupplierHistoryReport } from "@/lib/api/supplier-history-types";
import { handleApiError } from "@/lib/feedback";
import { todayInIndia } from "@/lib/today";

import { downloadReport, type FileFormat, type ReportFile } from "../report-files";
import { historyFile } from "../../supplier-history/history-file";
import { supplierOrdersFile } from "../supplier-orders/supplier-orders-file";
import { orderReportsFile } from "./order-reports-file";
import { orderReportsQuery } from "./params";

/**
 * A hub card's Excel and PDF buttons for a report outside GET /reports/<name>: the report with the hub's filters
 * (period as the order-date range, supplier), as its Open report link shows it. The hub has no report data, so the
 * click loads the report's own call. CardDownloads is typed on the six report names, so these cards have their own.
 */
function FetchedDownloads({ query, className, title, load }: { query: string; className: string; title: string; load: (apiQuery: string) => Promise<ReportFile> }) {
  const [pending, startTransition] = useTransition();
  const download = (format: FileFormat) =>
    startTransition(async () => {
      try {
        await downloadReport(await load(orderReportsQuery(new URLSearchParams(query))), format);
      } catch (error) {
        handleApiError(error);
      }
    });
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} disabled={pending} aria-label={`Excel export: ${title}`} onClick={() => download("xlsx")}>
        Excel
      </Button>
      <Button type="button" variant="outline" size="sm" className={className} disabled={pending} aria-label={`PDF export: ${title}`} onClick={() => download("pdf")}>
        PDF
      </Button>
    </>
  );
}

/** The Order Report card: GET /reports/orders. */
export const OrderReportsDownloads = ({ query, className }: { query: string; className: string }) => (
  <FetchedDownloads query={query} className={className} title="Order Report" load={async (q) => orderReportsFile(await apiClient.get<OrderReportsResponse>(`/reports/orders${q}`), todayInIndia())} />
);

/** The Supplier Order Details card: GET /reports/supplier-orders (RPT-S1). */
export const SupplierOrdersDownloads = ({ query, className }: { query: string; className: string }) => (
  <FetchedDownloads
    query={query}
    className={className}
    title="Supplier Order Details"
    load={async (q) => supplierOrdersFile(await apiClient.get<SupplierOrdersResponse>(`/reports/supplier-orders${q}`), todayInIndia())}
  />
);

/** The Supplier History card: GET /reports/supplier-history (RPT-SH), every matching event (the hub's period and supplier). */
export const SupplierHistoryDownloads = ({ query, className }: { query: string; className: string }) => (
  <FetchedDownloads
    query={query}
    className={className}
    title="Supplier History"
    load={async (q) => {
      const data = await apiClient.get<SupplierHistoryReport>(`/reports/supplier-history${q ? `${q}&all=1` : "?all=1"}`);
      return historyFile(data.events.rows, { title: "Supplier history", filename: `supplier-history-${todayInIndia()}`, filters: data.filter.supplier ?? "Every supplier, every event", withSupplier: true });
    }}
  />
);
