import type { SupplierStatement } from "@/lib/api/deposits-types";
import { amountsText, type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import { formatDate } from "@/lib/formatters";
import { orderedCurrencies } from "@/lib/currencies";
import type { Currency } from "@/types/domain";

import { type DepositFilters, type DepositRow, type DepositView, KIND_LABEL, STATUS_LABEL, type SupplierSummary, totals } from "./deposits-logic";

// The Deposits pages' Excel and PDF files (docs/phase2-contracts.md section 6): built from the rows the page shows after
// its filters, one table per currency so no total adds two currencies. Amount headers name the currency code (`money`).

const date = (header: string): Column => ({ header, date: true });
const text = (header: string): Column => ({ header });
const DIRECTION_LABEL = { give: "Give", receive: "Receive" } as const;


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

/** The overview cards of the rows shown: payables and receivables apart, each per currency, never netted. */
const depositSummary = (rows: DepositRow[]) => {
  const { pay, receive } = totals(rows);
  return summarySection([
    ["Deposits to pay", `${pay.count} · ${amountsText(pay.amount)}`],
    ["Paid", amountsText(pay.paid)],
    ["Pending to pay", amountsText(pay.pending)],
    ["Deposits to receive", `${receive.count} · ${amountsText(receive.amount)}`],
    ["Received", amountsText(receive.paid)],
    ["Pending to receive", amountsText(receive.pending)],
  ]);
};

/** Supplier-level deposits are the supplier's account: never a payment of a PO, so never in a PO's paid figure. */
const DEPOSIT_NOTES = [
  "Order deposits are payments of a PO. Supplier deposits (to give, to receive) belong to the supplier's account and are never counted as PO payments.",
  "Exchange rate: a paid order deposit's own rate, or the supplier's rate when a supplier deposit was opened (INR per 1 unit). Amounts in different currencies are never added together.",
];

/** The deposits table of the All, Pending or Paid tab as shown (every matching row): one table per currency. */
export function depositsFile(view: DepositView, rows: DepositRow[], filters: string, today: string): ReportFile {
  return {
    title: VIEW_TITLE[view],
    filename: `deposits-${view}-${today}`,
    filters,
    notes: DEPOSIT_NOTES,
    sections: [
      depositSummary(rows),
      ...perCurrency(rows).map(([currency, list]) => ({
        sheet: "Deposits",
        title: `Deposits (${currency})`,
        columns: [
          text("Supplier"),
          text("PO"),
          text("Kind"),
          text("Paid to"),
          text("Currency"),
          money("Amount", currency),
          money("Paid / settled", currency),
          money("Pending", currency),
          rate("Exchange rate", currency),
          money("INR equivalent", "INR"),
          date("Date"),
          text("Mode"),
          text("Reference"),
          text("Notes"),
          text("Status"),
          text("Payments"),
        ],
        // Payments: how many deposit payments an obligation row sums; blank on other rows.
        rows: list.map((r) => [
          r.supplier,
          r.po ?? "",
          r.payeeRole === "agent" ? `${KIND_LABEL[r.kind]} (to shipping agent)` : KIND_LABEL[r.kind],
          r.payee,
          r.currency,
          r.amount,
          r.paid,
          r.pending,
          r.rate,
          r.amountInr,
          r.date,
          r.mode,
          r.reference,
          r.notes,
          STATUS_LABEL[r.status],
          r.payments ?? "",
        ]),
      })),
    ],
  };
}

/** The Suppliers tab: a supplier's six figures, one table per currency it has deposits in. */
export function suppliersFile(summaries: SupplierSummary[], filters: string, today: string): ReportFile {
  type Line = { currency: Currency; supplier: string; figures: number[] };
  const lines: Line[] = summaries.flatMap((s) =>
    orderedCurrencies([s.give, s.receive].flatMap((d) => d.amount.map((t) => t.currency))).map((currency) => {
      const of = (totals: { currency: Currency; amount: number }[]) => totals.find((t) => t.currency === currency)?.amount ?? 0;
      return { currency, supplier: s.supplier, figures: [of(s.give.amount), of(s.give.paid), of(s.give.pending), of(s.receive.amount), of(s.receive.paid), of(s.receive.pending)] };
    }),
  );
  return {
    title: VIEW_TITLE.suppliers,
    filename: `deposits-suppliers-${today}`,
    filters,
    notes: [DEPOSIT_NOTES[0]!],
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
      columns: [date("Opened on"), money("Amount", currency), money("Settled", currency), money("Pending", currency), rate("Rate when opened", currency), text("Status"), text("Reference"), text("Notes")],
      rows: list.map((d) => [d.openedOn, d.amount, d.settled, d.pending, d.exchangeRate ?? null, STATUS_LABEL[d.status], d.reference, d.notes]),
    }));
  const transactions = deposits.flatMap((d) => d.transactions.map((t) => ({ ...t, currency: d.currency, deposit: `${DIRECTION_LABEL[d.direction]} · opened ${formatDate(d.openedOn)}` })));
  return {
    title: `Supplier deposits: ${supplier.name}`,
    filename: `supplier-deposits-${supplier.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-${today}`,
    filters: `Supplier: ${supplier.name}`,
    notes: [DEPOSIT_NOTES[0]!],
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
