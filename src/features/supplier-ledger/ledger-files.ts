import { ADVANCE_KIND_LABEL } from "@/features/deposits/advance-logic";
import { balanceText, HELD_BALANCE, MILESTONE_STATUS, PAYMENT_STATUS } from "@/features/payments/money";
import { amountsText, type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import type { AdvanceArchiveResponse, DepositMilestone } from "@/lib/api/deposits-types";
import type { LedgerAccount, LedgerEntry, LedgerTotal, SupplierLedgerResponse } from "@/lib/api/ledger-types";
import { formatDateTime } from "@/lib/formatters";

import { ENTRY_LABEL, type OverviewRow, reasonOf } from "./ledger-logic";

// Supplier ledger downloads (PDF, Excel, CSV) through the report download helpers: one table per currency, so no total
// adds two currencies. Balances are signed (+ available with the supplier, − payable to the supplier); held accounts
// are marked and count in no total.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const slug = (name: string) => name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
/** Per-currency totals of the accounts given, held ones left out, in whole cents (LedgerTotal's shape). */
function totalsOf(list: { currency: string; held: boolean; balanceCny: number | null; outstandingCny: number | null }[]): LedgerTotal[] {
  const counted = list.filter((account) => !account.held && account.balanceCny !== null);
  const currencies = [...new Set(counted.map((account) => account.currency))];
  const cents = (value: number) => Math.round(value * 100);
  return currencies.map((currency) => {
    const own = counted.filter((account) => account.currency === currency);
    const total = (pick: (balance: number, outstanding: number) => number) => own.reduce((sum, a) => sum + cents(pick(a.balanceCny!, a.outstandingCny ?? 0)), 0) / 100;
    return {
      currency,
      accounts: own.length,
      balanceCny: total((balance) => balance),
      payableCny: total((balance) => Math.max(0, -balance)),
      availableCny: total((balance) => Math.max(0, balance)),
      outstandingCny: total((_balance, outstanding) => outstanding),
    };
  });
}

const SIGN_NOTE = "Balances are signed: positive is money available with the supplier, zero is settled, negative is payable to the supplier.";
const HELD_NOTE = "A held account (pending review) has no figures and is left out of every total.";

/**
 * LED-2 as shown (filtered): one row per supplier and currency, with per-currency totals of exactly those rows (held
 * accounts left out), so the summary always matches the rows the file holds.
 */
export function ledgerOverviewFile(rows: OverviewRow[], filters: string, today: string): ReportFile {
  const accounts = rows.filter((row) => row.account);
  const totals = totalsOf(accounts.map((row) => row.account!));
  return {
    title: "Supplier ledger",
    filename: `supplier-ledger-${today}`,
    filters,
    notes: [SIGN_NOTE, HELD_NOTE],
    sections: [
      summarySection([
        ["Accounts", accounts.length],
        ["Payable to suppliers", amountsText(totals.filter((t) => t.payableCny > 0).map((t) => ({ currency: t.currency, amount: t.payableCny })))],
        ["Available with suppliers", amountsText(totals.filter((t) => t.availableCny > 0).map((t) => ({ currency: t.currency, amount: t.availableCny })))],
        ["Net balance", amountsText(totals.map((t) => ({ currency: t.currency, amount: t.balanceCny })))],
        ["Outstanding on open orders", amountsText(totals.map((t) => ({ currency: t.currency, amount: t.outstandingCny })))],
      ]),
      ...perCurrency(accounts.map((row) => ({ ...row, currency: row.account!.currency }))).map(([currency, list]) => ({
        sheet: "Accounts",
        title: `Supplier accounts (${currency})`,
        columns: [
          text("Supplier"),
          text("Code"),
          text("Status"),
          money("Credits", currency),
          money("Debits", currency),
          money("Balance (+ available, - payable)", currency),
          text("Balance"),
          money("Outstanding", currency),
          text("Open orders"),
          date("Last payment"),
        ],
        rows: list.map(({ supplier, code, status, account: a }) => [
          supplier,
          code || null,
          status,
          a!.creditsCny,
          a!.debitsCny,
          a!.balanceCny,
          a!.held || a!.balanceCny === null ? HELD_BALANCE : balanceText(a!.balanceCny, currency),
          a!.outstandingCny,
          a!.openOrders,
          a!.lastPaymentOn,
        ]),
      })),
    ],
  };
}

const entryDetails = (e: LedgerEntry) =>
  [
    e.payment?.mode,
    e.payment?.reference,
    e.payment?.memoPo ? `recorded against ${e.payment.memoPo}` : null,
    e.payment?.voided ? "voided" : null,
    e.advance ? "legacy advance receipt" : null,
  ]
    .filter(Boolean)
    .join(" · ") || null;

export const LEDGER_NOTES = [SIGN_NOTE, HELD_NOTE, "Orders are settled from the account oldest first; outstanding is never negative. Each entry keeps the exchange rate of its source (INR per 1 unit)."];

/** One supplier's statement (LED-1, as filtered), the orders projection and the legacy advance archive. */
export function statementFile(data: SupplierLedgerResponse, entries: LedgerEntry[], filters: string, today: string, advances: AdvanceArchiveResponse | null = null): ReportFile {
  const { supplier, accounts, orders } = data;
  return {
    title: `Supplier ledger: ${supplier.name}`,
    filename: `supplier-ledger-${slug(supplier.name)}-${today}`,
    filters,
    notes: LEDGER_NOTES,
    sections: [
      ...ledgerSections(accounts, entries),
      ...perCurrency(orders).map(([currency, list]) => ({
        sheet: "Orders",
        title: `Orders, oldest first (${currency})`,
        columns: [
          text("PO"),
          date("Order date"),
          money("Order value", currency),
          money("Settled", currency),
          money("Outstanding", currency),
          text("Payment status"),
          money("Deposit required", currency),
          money("Deposit pending", currency),
          text("Deposit milestone"),
          money("Settled INR (goods)", "INR"),
        ],
        rows: list.map((o) => [
          o.po,
          o.orderDate,
          o.valueCny,
          o.settledCny,
          o.outstandingCny,
          o.held ? "Pending review" : o.paymentStatus ? PAYMENT_STATUS[o.paymentStatus].label : null,
          o.depositRequiredCny,
          o.depositPendingCny,
          o.depositStatus ? MILESTONE_STATUS[o.depositStatus].label : null,
          o.settledInr,
        ]),
      })),
      ...(advances?.entries.length
        ? perCurrency(advances.entries).map(([currency, list]) => ({
            sheet: "Legacy Advance",
            title: `Legacy advance history, archive (${currency})`,
            columns: [date("Date"), text("Kind"), text("PO"), money("Amount", currency), rate("Exchange rate", currency), money("INR equivalent", "INR"), text("Mode"), text("Reference"), text("Notes"), text("Recorded by")],
            rows: list.map((a) => [a.entryDate, ADVANCE_KIND_LABEL[a.kind], a.po || null, a.amount, a.exchangeRate, a.amountInr, a.mode || null, a.reference || null, a.notes || null, a.recordedBy || null]),
          }))
        : []),
    ],
  };
}

/** A supplier's accounts (signed balances) and its statement, one table per currency: the ledger file and the reports (RPT-5D, RPT-O1). */
export function ledgerSections(accounts: LedgerAccount[], entries: LedgerEntry[]): Section[] {
  return [
    {
      sheet: "Summary",
      title: "Accounts",
      columns: [text("Currency"), text("Credits"), text("Debits"), text("Balance (+ available, - payable)"), text("Balance"), text("Outstanding"), text("Open orders"), date("Last payment")],
      rows: accounts.map((a) => [
        a.currency,
        a.creditsCny,
        a.debitsCny,
        a.balanceCny,
        a.held || a.balanceCny === null ? HELD_BALANCE : balanceText(a.balanceCny, a.currency),
        a.outstandingCny,
        a.openOrders,
        a.lastPaymentOn,
      ]),
      csv: false,
    },
    ...perCurrency(entries).map(([currency, list]) => ({
      sheet: "Statement",
      title: `Statement (${currency})`,
      columns: [
        date("Date"),
        text("Type"),
        text("PO"),
        money("Amount (+ credit, - debit)", currency),
        rate("Exchange rate", currency),
        money("INR equivalent", "INR"),
        money("Balance after", currency),
        text("Reason"),
        money("Balance before (adjustment, when recorded)", currency),
        money("Balance after (adjustment, when recorded)", currency),
        text("Details"),
        text("Recorded by"),
        text("Recorded at"),
        text("Origin"),
      ],
      rows: list.map((e) => [
        e.entryDate,
        ENTRY_LABEL[e.entryType],
        e.po,
        e.amount,
        e.exchangeRate,
        e.amountInr,
        e.runningBalance,
        reasonOf(e) || null,
        e.balanceBefore,
        e.balanceAfter,
        entryDetails(e),
        e.recordedBy || null,
        formatDateTime(e.recordedAt),
        e.origin === "backfill" ? "Opening (migrated)" : "App",
      ]),
    })),
  ];
}

/** DEP-1 milestones as shown (filtered), one table per currency. */
export function milestonesFile(rows: DepositMilestone[], filters: string, today: string): ReportFile {
  return {
    title: "Deposit milestones",
    filename: `deposit-milestones-${today}`,
    filters,
    notes: [
      "A Deposit Required is a milestone of the order, never a balance: it is met once what the supplier account settled of the order reaches it.",
      HELD_NOTE,
    ],
    sections: perCurrency(rows).map(([currency, list]) => ({
      title: `Deposit milestones (${currency})`,
      columns: [text("PO"), date("Order date"), text("Supplier"), money("Deposit required", currency), money("Settled", currency), money("Pending", currency), text("Milestone")],
      rows: list.map((m) => [
        m.po,
        m.orderDate,
        m.supplier,
        m.depositRequiredCny,
        m.depositSettledCny,
        m.depositPendingCny,
        m.held ? "Pending review" : m.depositStatus ? MILESTONE_STATUS[m.depositStatus].label : null,
      ]),
    })),
  };
}
