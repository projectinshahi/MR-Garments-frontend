import type { SupplierStatement } from "@/lib/api/deposits-types";
import { type Column, money, type ReportFile, type Section } from "@/features/reports/report-files";
import { formatDate } from "@/lib/formatters";
import { type Currency, CURRENCIES } from "@/types/domain";

import { type DepositFilters, type DepositRow, type DepositView, KIND_LABEL, STATUS_LABEL, type SupplierSummary } from "./deposits-logic";

// The Deposits pages' Excel and PDF files (docs/phase2-contracts.md section 6): built from the rows the page shows after
// its filters, one table per currency so no total adds two currencies. Amount headers name the currency code (`money`).

const date = (header: string): Column => ({ header, date: true });
const text = (header: string): Column => ({ header });
const DIRECTION_LABEL = { give: "Give", receive: "Receive" } as const;

/** Rows split by currency, in CNY, USD, INR order; none: one empty CNY table (the sheet then says "No rows"). */
function perCurrency<T extends { currency: Currency }>(rows: T[]): [Currency, T[]][] {
  const tables = CURRENCIES.map((currency): [Currency, T[]] => [currency, rows.filter((row) => row.currency === currency)]).filter(([, list]) => list.length);
  return tables.length ? tables : [["CNY", []]];
}

const VIEW_TITLE: Record<DepositView | "suppliers", string> = { all: "All deposits", pending: "Pending deposits", paid: "Paid deposits", suppliers: "Deposits by supplier" };

/** "Supplier: Foshan Fabrics · PO: 20 · Dates: 1 Oct 2026 to 31 Oct 2026 · Status: Paid …", or "All deposits" when nothing is set. */
export function filterLabel(f: DepositFilters, suppliers: { id: string; name: string }[]) {
  const parts = [
    f.supplierId && `Supplier: ${suppliers.find((s) => s.id === f.supplierId)?.name ?? f.supplierId}`,
    f.po.trim() && `PO: ${f.po.trim()}`,
    (f.from || f.to) && `Dates: ${f.from ? formatDate(f.from) : "start"} to ${f.to ? formatDate(f.to) : "today"}`,
    f.status && `Status: ${STATUS_LABEL[f.status]}`,
    f.currency && `Currency: ${f.currency}`,
    f.kind && `Kind: ${KIND_LABEL[f.kind]}`,
  ].filter((part): part is string => !!part);
  return parts.length ? parts.join(" · ") : "All deposits";
}

/** The deposits table of the All, Pending or Paid tab as shown: one table per currency. */
export function depositsFile(view: DepositView, rows: DepositRow[], filters: string, today: string): ReportFile {
  return {
    title: VIEW_TITLE[view],
    filename: `deposits-${view}-${today}`,
    filters,
    sections: perCurrency(rows).map(([currency, list]) => ({
      columns: [
        text("Supplier"),
        text("PO"),
        text("Kind"),
        text("Paid to"),
        money("Amount", currency),
        money("Paid / settled", currency),
        money("Pending", currency),
        date("Date"),
        text("Mode"),
        text("Reference"),
        text("Notes"),
        text("Status"),
      ],
      rows: list.map((r) => [r.supplier, r.po ?? "", KIND_LABEL[r.kind], r.payee, r.amount, r.paid, r.pending, r.date, r.mode, r.reference, r.notes, STATUS_LABEL[r.status]]),
    })),
  };
}

/** The Suppliers tab: a supplier's six figures, one table per currency it has deposits in. */
export function suppliersFile(summaries: SupplierSummary[], filters: string, today: string): ReportFile {
  type Line = { currency: Currency; supplier: string; figures: number[] };
  const lines: Line[] = summaries.flatMap((s) =>
    CURRENCIES.filter((currency) => [s.give, s.receive].some((d) => d.amount.some((t) => t.currency === currency))).map((currency) => {
      const of = (totals: { currency: Currency; amount: number }[]) => totals.find((t) => t.currency === currency)?.amount ?? 0;
      return { currency, supplier: s.supplier, figures: [of(s.give.amount), of(s.give.paid), of(s.give.pending), of(s.receive.amount), of(s.receive.paid), of(s.receive.pending)] };
    }),
  );
  return {
    title: VIEW_TITLE.suppliers,
    filename: `deposits-suppliers-${today}`,
    filters,
    sections: perCurrency(lines).map(([currency, list]) => ({
      columns: [
        text("Supplier"),
        money("To give", currency),
        money("Given", currency),
        money("Pending to give", currency),
        money("To receive", currency),
        money("Received", currency),
        money("Pending to receive", currency),
      ],
      rows: list.map((line) => [line.supplier, ...line.figures]),
    })),
  };
}

/** A supplier's statement: sheets Summary, Deposit to Give, Deposit to Receive and Transactions, each per currency. */
export function statementFile({ supplier, summary, deposits }: SupplierStatement, today: string): ReportFile {
  const depositSheet = (direction: "give" | "receive", sheet: string): Section[] =>
    perCurrency(deposits.filter((d) => d.direction === direction)).map(([currency, list]) => ({
      sheet,
      title: `Deposit to ${DIRECTION_LABEL[direction].toLowerCase()} (${currency})`,
      columns: [date("Opened on"), money("Amount", currency), money("Settled", currency), money("Pending", currency), text("Status"), text("Reference"), text("Notes")],
      rows: list.map((d) => [d.openedOn, d.amount, d.settled, d.pending, STATUS_LABEL[d.status], d.reference, d.notes]),
    }));
  const transactions = deposits.flatMap((d) => d.transactions.map((t) => ({ ...t, currency: d.currency, deposit: `${DIRECTION_LABEL[d.direction]} · opened ${formatDate(d.openedOn)}` })));
  return {
    title: `Supplier deposits: ${supplier.name}`,
    filename: `supplier-deposits-${supplier.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-${today}`,
    filters: `Supplier: ${supplier.name}`,
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
