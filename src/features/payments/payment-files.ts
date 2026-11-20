import { amountsText, type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import type { LedgerTotal } from "@/lib/api/ledger-types";
import { sumByCurrency } from "@/lib/formatters";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { live, MILESTONE_STATUS, PAYMENT_STATUS, paymentType } from "./money";

// Payments report download (backend docs/report-downloads.md, unified ledger): the orders and payments the page's
// search keeps (every one, not only the table's page). Orders carry the API's FIFO figures; supplier payments and
// shipping-agent payments (sea freight) are separate tables, each in its own currency with the rate typed for that
// payment and its INR at that rate. Voided payments are listed, marked "Voided" with the reason, and every total
// leaves them out. Currencies are never added together.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const round2 = (value: number) => Math.round(value * 100) / 100;
const statusOf = (p: Payment) => (p.voided ? "Voided" : p.status === "paid" ? "Paid" : "Due");

function paymentTables(list: Payment[], sheet: string, heading: string, agent: boolean): Section[] {
  return perCurrency(list).map(([currency, rows]) => {
    const counted = live(rows);
    return {
      sheet,
      title: `${heading} (${currency})`,
      columns: [
        text("Reference"),
        date("Payment date"),
        date("Due date"),
        text("Supplier"),
        text("PO"),
        ...(agent ? [text("Paid to (agent)")] : []),
        text("Payment type"),
        text("Payment method"),
        text("Currency"),
        money("Amount", currency),
        rate("Exchange rate", currency),
        money("INR equivalent", "INR"),
        text("Status"),
        text("Void reason"),
        text("Notes"),
      ],
      rows: rows.map((p) => [
        p.reference || null,
        p.paidOn,
        p.dueDate,
        p.supplier,
        p.po,
        ...(agent ? [p.payee] : []),
        paymentType(p),
        p.mode,
        p.currency,
        p.amountCny,
        p.rateInr,
        p.amountInr,
        statusOf(p),
        p.voided ? p.voidReason || null : null,
        p.notes || null,
      ]),
      // Voided payments are not in the totals.
      total: rows.length
        ? [
            "Total (voided left out)",
            ...Array<null>(agent ? 8 : 7).fill(null),
            round2(counted.reduce((sum, p) => sum + p.amountCny, 0)),
            null,
            round2(counted.reduce((sum, p) => sum + (p.amountInr ?? 0), 0)),
            null,
            null,
            null,
          ]
        : undefined,
    };
  });
}

/** The page's orders and payments after its search; `totals`: LED-2's per-currency payable and available. */
export function paymentsFile(orders: OrderPaymentRow[], payments: Payment[], query: string, today: string, totals: LedgerTotal[] = []): ReportFile {
  const counted = live(payments);
  const toSupplier = payments.filter((p) => p.payeeRole === "supplier");
  const toAgents = payments.filter((p) => p.payeeRole === "agent");
  const due = counted.filter((p) => p.status === "due");
  const known = (pick: (o: OrderPaymentRow) => number | null) => amountsText(sumByCurrency(orders.filter((o) => pick(o) !== null), (o) => o.currency, (o) => pick(o) ?? 0));
  return {
    title: "Payments",
    filename: `payments-${today}`,
    filters: query.trim() ? `Search: "${query.trim()}"` : "All orders and payments",
    notes: [
      "Supplier payments are recorded against the supplier's account in its currency; each order is settled from the account, oldest first (settled and outstanding are that projection).",
      "Each payment keeps the exchange rate typed when it was paid (INR per 1 unit); a due payment has no rate until it is paid.",
      "Voided payments are listed and marked; every total leaves them out. Held accounts (pending review) count in no total.",
    ],
    sections: [
      summarySection([
        ["Orders", orders.length],
        ["Order value", known((o) => o.orderValueCny)],
        ["Settled", known((o) => o.settledCny)],
        ["Outstanding", known((o) => o.outstandingCny)],
        ...(totals.length
          ? ([
              ["Payable to suppliers", amountsText(totals.filter((t) => t.payableCny > 0).map((t) => ({ currency: t.currency, amount: t.payableCny })))],
              ["Available with suppliers", amountsText(totals.filter((t) => t.availableCny > 0).map((t) => ({ currency: t.currency, amount: t.availableCny })))],
            ] satisfies [string, string][])
          : []),
        ["Paid, all payees (INR)", round2(counted.filter((p) => p.status === "paid").reduce((sum, p) => sum + (p.amountInr ?? 0), 0))],
        ["Supplier payments", live(toSupplier).length],
        ["Shipping-agent payments", live(toAgents).length],
        ["Voided payments", payments.length - counted.length],
        ["Due payments", `${due.length} · ${amountsText(sumByCurrency(due, (p) => p.currency, (p) => p.amountCny))}`],
      ]),
      ...perCurrency(orders).map(([currency, list]) => ({
        sheet: "Payments by Order",
        title: `Payments by order (${currency})`,
        columns: [
          text("PO"),
          text("Supplier"),
          money("Order value", currency),
          money("Settled", currency),
          money("Outstanding", currency),
          text("Payment status"),
          money("Deposit required", currency),
          money("Deposit settled", currency),
          money("Deposit pending", currency),
          text("Deposit milestone"),
          money("Paid to agents", currency),
          money("Paid, goods and sea freight", "INR"),
          date("Next due"),
        ],
        rows: list.map((o) => [
          o.po,
          o.supplier,
          o.orderValueCny,
          o.settledCny,
          o.outstandingCny,
          o.held ? "Pending review" : o.paymentStatus ? PAYMENT_STATUS[o.paymentStatus].label : null,
          o.depositRequiredCny,
          o.depositSettledCny,
          o.depositPendingCny,
          o.depositStatus ? MILESTONE_STATUS[o.depositStatus].label : null,
          o.agentPaidCny,
          o.paidInr,
          o.nextDue,
        ]),
      })),
      ...paymentTables(toSupplier, "Supplier Payments", "Supplier payments", false),
      // No sheet of nothing: the summary already says when no agent was paid.
      ...(toAgents.length ? paymentTables(toAgents, "Agent Payments", "Shipping-agent payments", true) : []),
    ],
  };
}
