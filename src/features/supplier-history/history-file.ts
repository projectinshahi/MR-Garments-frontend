import type { HistoryEvent } from "@/lib/api/supplier-history-types";

import { type Column, type ReportFile, summarySection } from "../reports/report-files";
import { EVENT_LABEL, HISTORY_NOTE, MIGRATED, NOT_RECORDED } from "./history-logic";

// The Supplier History file (CSV, Excel, PDF): every event matching the filters (the API's all=1), never only the visible
// page. Amounts keep their own currency in the next column (events mix currencies, so the table has no money total);
// the summary counts events by type. The supplier is named, never coded (owner decision of 2026-11-25: no Supplier
// code in any Supplier History file; the profile keeps it).

const date = (header: string): Column => ({ header, date: true });
const text = (header: string): Column => ({ header });

export function historyFile(events: HistoryEvent[], options: { title: string; filename: string; filters: string; withSupplier: boolean }): ReportFile {
  const byType = new Map<string, number>();
  for (const event of events) byType.set(EVENT_LABEL[event.type], (byType.get(EVENT_LABEL[event.type]) ?? 0) + 1);
  return {
    title: options.title,
    filename: options.filename,
    filters: options.filters,
    sections: [
      summarySection([["Events", events.length], ...[...byType.entries()].map(([label, count]): [string, number] => [label, count])]),
      {
        sheet: "Events",
        title: "Events",
        columns: [
          date("Date"),
          text("Event"),
          ...(options.withSupplier ? [text("Supplier")] : []),
          text("PO"),
          text("Reference"),
          text("Currency"),
          text("Amount (signed)"),
          text("Amount (INR)"),
          text("Status"),
          text("Details"),
          text("Reason"),
          text("Recorded at"),
          text("Recorded by"),
        ],
        rows: events.map((event) => [
          event.date,
          EVENT_LABEL[event.type],
          ...(options.withSupplier ? [event.supplier.name] : []),
          event.po,
          event.reference,
          event.currency,
          event.amount,
          event.amountInr,
          event.status ?? null,
          event.details,
          event.reason,
          event.origin === "migrated" ? MIGRATED : event.recordedAt,
          event.origin === "migrated" ? null : (event.actor ?? NOT_RECORDED),
        ]),
      },
    ],
    notes: [HISTORY_NOTE, "Amounts are signed as the supplier ledger records them: + a credit (a payment), − a debit (an order's value). Agent payments are sea freight, outside the supplier ledger."],
  };
}
