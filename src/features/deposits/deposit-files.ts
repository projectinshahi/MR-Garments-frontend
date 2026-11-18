import type { AdvanceAccount, SupplierAdvanceBalance, SupplierStatement } from "@/lib/api/deposits-types";
import { amountsText, type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import { formatDate } from "@/lib/formatters";
import { orderedCurrencies } from "@/lib/currencies";
import type { Currency } from "@/types/domain";

import {
  ADVANCE_KIND_LABEL,
  advanceHistory,
  type AdvanceHistoryRow,
  depositsOf,
  excessOf,
  netApplied,
  recordedOf,
  signedAdvance,
  type SupplierAdvanceRow,
} from "./advance-logic";
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

/** The supplier advance account: money added before any order, plus the deposits paid with orders (owner decision 2026-11-18). */
export const ADVANCE_NOTE =
  "Supplier advance = money added as advance before any order, supplier payments beyond an order's value (excess payments, available for other orders) and the deposits paid to the supplier with an order (applied to that order). Each payment counts once: up to its order's value toward that order, the rest as excess. Available advance is applied to new orders automatically. Supplier deposits (Deposits › Suppliers) are separate.";

/** The advance account's figures per currency, as every screen shows them: recorded less applied (net) is available. */
const advanceSummaryColumns = (currency: Currency): Column[] => [
  money("Advance recorded", currency),
  money("Added as advance", currency),
  money("Excess payments", currency),
  money("Order deposits", currency),
  money("Applied from added advance", currency),
  money("Returned from orders", currency),
  money("Applied to orders (net)", currency),
  money("Available", currency),
  text("Orders"),
];
const advanceSummaryRow = (line: AdvanceAccount["summary"][number]) => [
  recordedOf(line),
  line.receivedCny,
  excessOf(line),
  depositsOf(line),
  line.allocatedCny,
  line.reversedCny,
  netApplied(line),
  line.availableCny,
  line.orders,
];

/**
 * A supplier's advance account (SD-1, RPT-5D `advance`): its totals and its history (the ledger and the order deposits,
 * newest first; `history` when filtered), one table per currency.
 */
export function advanceSections(account: AdvanceAccount | undefined, history: AdvanceHistoryRow[] = account ? advanceHistory(account) : []): Section[] {
  if (!account) return [];
  return [
    ...perCurrency(account.summary).map(([currency, lines]) => ({
      sheet: "Advance Summary",
      title: `Supplier advance (${currency})`,
      columns: advanceSummaryColumns(currency),
      rows: lines.map(advanceSummaryRow),
    })),
    ...perCurrency(history).map(([currency, list]) => ({
      sheet: "Advance Ledger",
      title: `Advance ledger (${currency})`,
      columns: [
        date("Date"),
        text("Type"),
        text("PO"),
        // An order deposit: its amount, recorded and applied at once (the available advance does not move).
        money("Amount (+ in, - out)", currency),
        rate("Exchange rate", currency),
        money("INR equivalent", "INR"),
        money("Available after", currency),
        text("Mode"),
        text("Reference"),
        text("Notes"),
        date("From advance paid on"),
        text("Advance reference"),
      ],
      rows: list.map((e) => [e.entryDate, ADVANCE_KIND_LABEL[e.kind], e.po, signedAdvance(e), e.exchangeRate, e.amountInr, e.balance, e.mode, e.reference, e.notes, e.advancePaidOn, e.advanceReference ?? ""]),
    })),
  ];
}

/**
 * The supplier-wise overview (Deposits › Supplier advance) as shown (filtered): one row per supplier and currency it holds
 * an advance in, then the suppliers without one. Never a total across suppliers or currencies.
 */
export function advanceOverviewFile(rows: SupplierAdvanceRow[], filters: string, today: string): ReportFile {
  return {
    title: "Supplier advance by supplier",
    filename: `supplier-advance-${today}`,
    filters,
    notes: [ADVANCE_NOTE, "Each supplier and currency on its own row: amounts in different currencies or of different suppliers are never added together."],
    sections: [
      {
        title: "Supplier advance by supplier",
        columns: [
          { header: "Supplier" },
          { header: "Currency" },
          { header: "Advance recorded" },
          { header: "Added as advance" },
          { header: "Excess payments" },
          { header: "Order deposits" },
          { header: "Applied from added advance" },
          { header: "Returned from orders" },
          { header: "Applied to orders (net)" },
          { header: "Available balance" },
          { header: "Orders" },
        ],
        rows: rows.flatMap((row) =>
          row.accounts.length
            ? row.accounts.map((a) => [row.supplier, a.currency, ...advanceSummaryRow(a)])
            : [[row.supplier, null, null, null, null, null, null, null, null, null, 0]],
        ),
      },
    ],
  };
}

/** One supplier's advance account as its own report (Deposits › Supplier advance): pass the entries as shown (filtered). */
export function advanceFile(supplier: { name: string; currency: string }, account: AdvanceAccount, history: AdvanceHistoryRow[], filters: string, today: string): ReportFile {
  return {
    title: `Supplier advance: ${supplier.name}`,
    filename: `supplier-advance-${supplier.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-${today}`,
    filters,
    notes: [ADVANCE_NOTE, `Supplier currency now: ${supplier.currency}. Each entry keeps the rate of the advance it belongs to (INR per 1 unit).`],
    sections: advanceSections(account, history),
  };
}

/**
 * The deposits table of the All, Pending or Paid tab as shown (every matching row): one table per currency. `advances`
 * (DEP-1, every supplier's advance balance, not filtered) adds a Supplier Advances sheet when there is one.
 */
export function depositsFile(view: DepositView, rows: DepositRow[], filters: string, today: string, advances: SupplierAdvanceBalance[] = []): ReportFile {
  return {
    title: VIEW_TITLE[view],
    filename: `deposits-${view}-${today}`,
    filters,
    notes: advances.length ? [...DEPOSIT_NOTES, ADVANCE_NOTE] : DEPOSIT_NOTES,
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
      ...(advances.length
        ? perCurrency(advances).map(([currency, list]) => ({
            sheet: "Supplier Advances",
            title: `Supplier advances (${currency})`,
            columns: [text("Supplier"), ...advanceSummaryColumns(currency)],
            rows: list.map((a) => [a.supplier, ...advanceSummaryRow(a)]),
          }))
        : []),
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

/** A supplier's statement: sheets Summary, Deposit to Give, Deposit to Receive and Transactions, each per currency, then the advance account. */
export function statementFile({ supplier, summary, deposits, advance }: SupplierStatement, today: string): ReportFile {
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
    notes: advance ? [DEPOSIT_NOTES[0]!, ADVANCE_NOTE] : [DEPOSIT_NOTES[0]!],
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
      ...advanceSections(advance),
    ],
  };
}
