import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import type {
  ContainersTimelineReport,
  DeliveriesPerDayReport,
  LandedCostByMonthReport,
  OrderedVsReceivedReport,
  OrderStatusReport,
  PaymentsPerSupplierReport,
} from "@/lib/api/reports-types";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { type Currency, STAGES } from "@/types/domain";

import { type CsvCell, toCsv } from "./csv";
import { periodLabel } from "./data/filters";
import { monthLabel } from "./report-logic";

// Report downloads (CSV, Excel, PDF): the tables a report shows, built in the browser from its own API response
// (GET /reports/<name>): the report page passes the data it rendered, a hub card fetches the same call with the hub's
// filters. Nothing is stored. A table the page shows as empty is written as its header and a "No rows" line.

export type Cell = CsvCell;
/** `date`: the cells are YYYY-MM-DD. `currency`: the cells are amounts in that currency. */
export type Column = { header: string; date?: true; currency?: Currency };
/** One table: the header, the rows and an optional total row. */
export type Section = { columns: Column[]; rows: Cell[][]; total?: Cell[] };
export type ReportFile = { title: string; filename: string; filters: string; sections: Section[] };
export type FileFormat = "csv" | "xlsx" | "pdf";

export const NO_ROWS = "No rows";

/** The one place a currency reaches the files: its code in the header ("Paid (INR)"), never ₹ or ¥ (the PDF fonts have no ₹). */
export const money = (header: string, currency: Currency): Column => ({ header: `${header} (${currency})`, currency });
const date = (header: string): Column => ({ header, date: true });
const columns = (...list: (string | Column)[]) => list.map((column) => (typeof column === "string" ? { header: column } : column));
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

type Spec<T> = {
  title: string;
  sections: (data: T) => Section[];
  /** The report's own date window, shown instead of the period (13.2: the next 14 days; 13.4: the month or today ±25 days). */
  window?: (data: T) => { from: string; to: string };
  /** false: the report ignores the period filter (13.2). */
  period?: false;
};

type Reports = {
  "order-status": OrderStatusReport;
  "deliveries-per-day": DeliveriesPerDayReport;
  "ordered-vs-received": OrderedVsReceivedReport;
  "containers-timeline": ContainersTimelineReport;
  "payments-per-supplier": PaymentsPerSupplierReport;
  "landed-cost-by-month": LandedCostByMonthReport;
};
export type ReportName = keyof Reports;
export type ReportResponse = Reports[ReportName];

// The tables of 33–38, as the screens show them (human labels, amounts with their currency); a table is empty when its
// screen shows the empty state.
const REPORTS: { [N in ReportName]: Spec<Reports[N]> } = {
  "order-status": {
    title: "Order status",
    sections: (d) => [
      { columns: columns("Stage", "Orders"), rows: d.total ? d.stageCounts.map((count, index) => [`${index + 1}. ${STAGES[index]}`, count]) : [] },
      { columns: columns("PO", "Supplier", date("Due"), "Late by (days)"), rows: d.late.map((o) => [o.po, o.supplier, o.due, o.lateDays]) },
    ],
  },
  "deliveries-per-day": {
    title: "Deliveries per day",
    period: false,
    window: (d) => d,
    sections: (d) => [{ columns: columns(date("Date"), "Deliveries due"), rows: d.dueNext14 ? d.days.map((day) => [day.date, day.count]) : [] }],
  },
  "ordered-vs-received": {
    title: "Ordered vs received",
    sections: (d) => [
      {
        columns: columns("PO", "Supplier", "Item", "Unit", "Ordered", "Received", "Short", money("Value of short", "CNY"), "Payment"),
        rows: d.lines.map((l) => [l.po, l.supplier, l.item, l.unit, l.ordered, l.received, l.short, l.shortValueCny, l.short > 0 ? "Reduced" : "Full"]),
      },
    ],
  },
  "containers-timeline": {
    title: "Containers timeline",
    window: (d) => d,
    sections: (d) => [
      {
        columns: columns("Container", "Status", date("Loaded"), date("Arrival")),
        rows: d.containers.map((c) => [c.number, CONTAINER_STATUS[c.status].label, c.loadedOn, c.arrival]),
      },
    ],
  },
  "payments-per-supplier": {
    title: "Payments per supplier",
    sections: ({ suppliers, totals: t }) => [
      {
        columns: columns("Supplier", "Orders", money("Order value", "CNY"), money("Paid", "CNY"), money("Paid", "INR"), money("Balance", "CNY")),
        rows: suppliers.map((s) => [s.supplier, s.orders.join(", "), s.orderValueCny, s.paidCny, s.paidInr, s.balanceCny]),
        total: suppliers.length ? ["Total", plural(t.orders, "open order"), t.orderValueCny, t.paidCny, t.paidInr, t.balanceCny] : undefined,
      },
    ],
  },
  "landed-cost-by-month": {
    title: "Landed cost by month",
    sections: ({ months, totals: t }) => [
      {
        columns: columns("Month", "Pieces", money("Landed cost", "INR"), money("Per piece", "INR")),
        rows: t.orders ? months.map((m) => [`${monthLabel(m.month)}${m.soFar ? " (so far)" : ""}`, m.pieces, m.landedCostInr, m.perPieceInr]) : [],
        total: t.orders ? ["Total", t.pieces, t.landedCostInr, t.perPieceInr] : undefined,
      },
    ],
  },
};

/** Report `name`'s file from its API response, named `<name>-<YYYY-MM period, else today>`. */
export function reportFile<N extends ReportName>(name: N, data: Reports[N], today: string): ReportFile {
  const spec: Spec<Reports[N]> = REPORTS[name];
  const { from, supplier } = data.filter;
  const window = spec.window?.(data);
  const period = window ? `${formatDate(window.from)} to ${formatDate(window.to)}` : from ? periodLabel(from.slice(0, 7)) : "All dates";
  return {
    title: spec.title,
    filename: `${name}-${spec.period !== false && from ? from.slice(0, 7) : today}`,
    filters: `Period: ${period} · Supplier: ${supplier ?? "All suppliers"}`,
    sections: spec.sections(data),
  };
}

/** CSV lines: each table's header, rows (or "No rows") and total, with an empty line between tables. */
export const csvRows = (file: ReportFile): Cell[][] =>
  file.sections.flatMap((s, index) => [...(index ? [[]] : []), s.columns.map((c) => c.header), ...(s.rows.length ? s.rows : [[NO_ROWS]]), ...(s.total ? [s.total] : [])]);

const TYPES: Record<FileFormat, string> = {
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** Writes the file (the Excel and PDF writers load on first use) and saves it to the user's computer. */
export async function downloadReport(file: ReportFile, format: FileFormat) {
  const generated = `Generated ${formatDateTime(new Date())}`;
  // CSV: UTF-8 with a byte-order mark, so Excel reads ₹ and ¥ in names.
  const body =
    format === "csv"
      ? `﻿${toCsv(csvRows(file))}`
      : format === "xlsx"
        ? (await import("./xlsx")).toXlsx(file, generated)
        : (await import("./pdf")).toPdf(file, generated);
  const url = URL.createObjectURL(new Blob([body], { type: TYPES[format] }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${file.filename}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
