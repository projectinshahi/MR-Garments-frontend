import { amountsText, type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import { sumByCurrency } from "@/lib/formatters";

import type { OrderPaymentRow, Payment } from "./data/queries";

// Deposits & Payments report download (backend docs/report-downloads.md): the orders the page's search matches (every
// one, not only what the table shows), their payments by order, then every payment of those orders as recorded:
// supplier payments and shipping-agent payments (sea freight) in separate tables, never mixed, each in its order's
// currency with the rate typed for that payment and its INR at that rate. Due payments have no rate until paid.
// Clearing and transport charges are not payments here: they are in the Clearing and Transport reports.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const STATUS = { paid: "Paid", due: "Due" } as const;

function paymentTables(list: (Payment & { supplier: string })[], sheet: string, heading: string, agent: boolean): Section[] {
  return perCurrency(list).map(([currency, rows]) => ({
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
      text("Notes"),
    ],
    rows: rows.map((p) => [
      p.reference || null,
      p.paidOn,
      p.dueDate,
      p.supplier,
      p.po,
      ...(agent ? [p.payee] : []),
      p.kind,
      p.mode,
      p.currency,
      p.amountCny,
      p.rateInr,
      p.amountInr,
      STATUS[p.status],
      p.notes || null,
    ]),
    total: rows.length
      ? [
          "Total",
          ...Array<null>(agent ? 8 : 7).fill(null),
          Math.round(rows.reduce((sum, p) => sum + p.amountCny, 0) * 100) / 100,
          null,
          Math.round(rows.reduce((sum, p) => sum + (p.amountInr ?? 0), 0) * 100) / 100,
          null,
          null,
        ]
      : undefined,
  }));
}

/** The page's orders after its search, and every payment of those orders (PAY-1, newest first). */
export function paymentsFile(orders: OrderPaymentRow[], payments: Payment[], query: string, today: string): ReportFile {
  const supplierOf = new Map(orders.map((o) => [o.po, o.supplier]));
  const shown = payments.filter((p) => supplierOf.has(p.po)).map((p) => ({ ...p, supplier: supplierOf.get(p.po)! }));
  const toSupplier = shown.filter((p) => p.payeeRole === "supplier");
  const toAgents = shown.filter((p) => p.payeeRole === "agent");
  const due = shown.filter((p) => p.status === "due");
  const known = orders.filter((o) => o.supplierPaid !== null);
  return {
    title: "Deposits & Payments",
    filename: `payments-${today}`,
    filters: query.trim() ? `Search: "${query.trim()}"` : "All orders",
    notes: [
      "Each payment keeps the exchange rate typed when it was paid (INR per 1 unit of the order's currency); a due payment has no rate until it is paid.",
      "Supplier payments and shipping-agent payments (sea freight) are listed apart. The balance counts supplier payments only.",
    ],
    sections: [
      summarySection([
        ["Orders", orders.length],
        ["Order value", amountsText(sumByCurrency(orders, (o) => o.currency, (o) => o.orderValue))],
        ["Paid to supplier", amountsText(sumByCurrency(known, (o) => o.currency, (o) => o.supplierPaid ?? 0))],
        ["Balance to supplier", amountsText(sumByCurrency(known, (o) => o.currency, (o) => o.balance ?? 0))],
        ["Paid, all payees (INR)", Math.round(orders.reduce((sum, o) => sum + o.paidInr, 0) * 100) / 100],
        ["Supplier payments", toSupplier.length],
        ["Shipping-agent payments", toAgents.length],
        ["Due payments", `${due.length} · ${amountsText(sumByCurrency(due, (p) => p.currency, (p) => p.amountCny))}`],
      ]),
      ...perCurrency(orders).map(([currency, list]) => ({
        sheet: "Payments by Order",
        title: `Payments by order (${currency})`,
        columns: [
          text("PO"),
          text("Supplier"),
          money("Order value", currency),
          money("Paid to supplier", currency),
          money("Paid to supplier", "INR"),
          money("Paid, all payees", "INR"),
          money("Balance to supplier", currency),
          money("Deposit required", currency),
          money("Deposit paid", currency),
          text("Deposit status"),
          date("Next due"),
        ],
        rows: list.map((o) => [
          o.po,
          o.supplier,
          o.orderValue,
          o.supplierPaid,
          o.supplierPaidInr,
          o.paidInr,
          o.balance,
          o.depositRequired,
          o.depositPaid,
          { none: "None agreed", due: "Due", partly: "Partly paid", paid: "Paid" }[o.depositStatus],
          o.nextDue,
        ]),
      })),
      ...paymentTables(toSupplier, "Supplier Payments", "Supplier payments", false),
      // No sheet of nothing: the summary already says when no agent was paid.
      ...(toAgents.length ? paymentTables(toAgents, "Agent Payments", "Shipping-agent payments", true) : []),
    ],
  };
}
