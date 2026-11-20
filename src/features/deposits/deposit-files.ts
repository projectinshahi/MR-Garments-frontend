import type { SupplierStatement } from "@/lib/api/deposits-types";
import { type Column, money, perCurrency, rate, type ReportFile, type Section } from "@/features/reports/report-files";
import { formatDate } from "@/lib/formatters";

import { STATUS_LABEL } from "./deposits-logic";

// The supplier-deposit archive (SD-1, read-only since the unified supplier ledger, D8) as file sections, one table per
// currency so no total adds two currencies. The supplier report (supplier-detail-files.ts) and the order report write
// it beside the ledger; the ledger pages have their own files (features/supplier-ledger/ledger-files.ts).

const date = (header: string): Column => ({ header, date: true });
const text = (header: string): Column => ({ header });
const DIRECTION_LABEL = { give: "Give", receive: "Receive" } as const;

/** Supplier-level deposits are an archive of the supplier's account: never a payment of a PO, never on the ledger. */
const DEPOSIT_NOTE =
  "Supplier deposits (to give, to receive) are a read-only archive of the supplier's account: never counted as PO payments or in the supplier ledger. Amounts in different currencies are never added together.";

/** A supplier's deposit archive: sheets Summary, Deposit to Give, Deposit to Receive and Transactions, each per currency. */
export function statementFile({ supplier, summary, deposits }: SupplierStatement, today: string): ReportFile {
  const depositSheet = (direction: "give" | "receive", sheet: string): Section[] =>
    perCurrency(deposits.filter((d) => d.direction === direction)).map(([currency, list]) => ({
      sheet,
      title: `Deposit to ${DIRECTION_LABEL[direction].toLowerCase()} (${currency})`,
      columns: [
        date("Opened on"),
        money("Amount", currency),
        money("Settled", currency),
        money("Pending", currency),
        rate("Rate when opened", currency),
        money("INR equivalent", "INR"),
        text("Status"),
        text("Reference"),
        text("Notes"),
      ],
      rows: list.map((d) => [d.openedOn, d.amount, d.settled, d.pending, d.exchangeRate ?? null, d.amountInr ?? null, STATUS_LABEL[d.status], d.reference, d.notes]),
    }));
  const transactions = deposits.flatMap((d) => d.transactions.map((t) => ({ ...t, currency: d.currency, deposit: `${DIRECTION_LABEL[d.direction]} · opened ${formatDate(d.openedOn)}` })));
  return {
    title: `Supplier deposits: ${supplier.name}`,
    filename: `supplier-deposits-${supplier.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-${today}`,
    filters: `Supplier: ${supplier.name}`,
    notes: [DEPOSIT_NOTE],
    sections: [
      ...perCurrency(summary).map(([currency, lines]) => ({
        sheet: "Summary",
        title: `Summary (${currency})`,
        columns: [text("Direction"), money("Amount", currency), money("Settled", currency), money("Pending", currency)],
        rows: lines.map((line) => [DIRECTION_LABEL[line.direction], line.amount, line.settled, line.pending]),
      })),
      ...depositSheet("give", "Deposit to Give"),
      ...depositSheet("receive", "Deposit to Receive"),
      ...perCurrency(transactions).map(([currency, list]) => ({
        sheet: "Transactions",
        title: `Transactions (${currency})`,
        columns: [date("Date"), text("Deposit"), money("Amount", currency), text("Mode"), text("Reference"), text("Notes")],
        rows: list.map((t) => [t.paidOn, t.deposit, t.amount, t.mode, t.reference, t.notes]),
      })),
    ],
  };
}
