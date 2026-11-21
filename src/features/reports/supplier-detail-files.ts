import { statementFile } from "@/features/deposits/deposit-files";
import { HELD_BALANCE, PAYMENT_STATUS, paymentType } from "@/features/payments/money";
import { LEDGER_NOTES, ledgerSections } from "@/features/supplier-ledger/ledger-files";
import { stageLabel } from "@/features/orders/order-status";
import type { SupplierStatement } from "@/lib/api/deposits-types";
import { formatDateTime } from "@/lib/formatters";

import type { SupplierPaymentDetail } from "./data/queries";
import { type Column, money, perCurrency, rate, type ReportFile, type Section } from "./report-files";

// One supplier's report download (RPT-5D with `all=1`, backend docs/report-downloads.md): the profile, the money
// summary per currency, every order (with its FIFO settlement), order line (with its saved rate, never the item's price
// now) and supplier payment the page's period, payment-date and stage filters keep, the supplier's ledger (accounts and
// statement, whole), then the supplier-deposit archive and its transactions (SD-1) when the user may view payments.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const or = (value: string) => value.trim() || null;

export function supplierDetailFile(data: SupplierPaymentDetail, statement: SupplierStatement | null, filters: string, today: string): ReportFile {
  const { supplier, summary } = data;
  const deposits: Section[] = statement
    ? statementFile(statement, today).sections.map((section) => ({ ...section, sheet: section.sheet === "Summary" ? "Deposit Summary" : section.sheet }))
    : [];
  // The ledger's own Summary sheet is the accounts table: named apart from the deposit archive's.
  const ledger = ledgerSections(data.ledger.accounts, data.ledger.entries).map((section) => ({ ...section, sheet: section.sheet === "Summary" ? "Ledger Accounts" : section.sheet }));
  return {
    title: `Supplier report: ${supplier.name}`,
    filename: `supplier-${(supplier.code || supplier.name).replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-${today}`,
    filters,
    notes: [
      ...LEDGER_NOTES,
      "Settled and outstanding count payments to the supplier only (shipping-agent payments are sea freight); each payment keeps the exchange rate typed for it (INR per 1 unit). Voided payments are listed and count in no total.",
      "Supplier deposits are a read-only archive of the supplier's account and are never counted as payments of a PO.",
      ...(statement ? [] : ["Supplier deposits are left out: they need Payments access."]),
    ],
    sections: [
      {
        sheet: "Supplier Overview",
        title: "Supplier overview",
        csv: false,
        columns: [text("Field"), text("Value")],
        rows: [
          ["Supplier code", or(supplier.code)],
          ["Supplier name", supplier.name],
          ["Status", supplier.status],
          ["Country", or(supplier.country)],
          ["City", or(supplier.city)],
          ["State / Province", or(supplier.state)],
          ["Postal code", or(supplier.postalCode)],
          ["Address", or(supplier.address)],
          ["Contact person", or(supplier.contactPerson)],
          ["Phone", or(supplier.phone)],
          ["Email", or(supplier.email)],
          ["Payment terms", or(supplier.paymentTerms)],
          ["Tax / registration number", or(supplier.taxNumber)],
          ["Preferred currency", supplier.currency],
          ["Current exchange rate (INR per 1)", supplier.exchangeRate === null ? "Not set" : supplier.exchangeRate.toFixed(4)],
          ["Rate last updated", supplier.rateUpdatedAt ? formatDateTime(supplier.rateUpdatedAt) : null],
          ["Notes", or(supplier.notes)],
        ],
      },
      ...perCurrency(summary.byCurrency).map(([currency, list]) => ({
        sheet: "Supplier Overview",
        title: `Money summary (${currency})`,
        csv: false as const,
        columns: [
          text("Orders"),
          money("Order value", currency),
          money("Settled", currency),
          money("Outstanding", currency),
          money("Payments", currency),
          money("Paid", "INR"),
          money("Supplier balance (+ available, - payable)", currency),
        ],
        rows: list.map((t) =>
          t.held ? [t.orders, t.orderValueCny, HELD_BALANCE, null, null, null, null] : [t.orders, t.orderValueCny, t.settledCny, t.outstandingCny, t.creditsCny, t.paidInr, t.balanceCny],
        ),
      })),
      ...perCurrency(data.orders.rows).map(([currency, list]) => ({
        sheet: "Purchase Orders",
        title: `Purchase orders (${currency})`,
        columns: [
          text("PO"),
          date("Order date"),
          date("Delivery date"),
          text("Stage"),
          text("Quantity"),
          money("Order value", currency),
          money("Settled", currency),
          money("Outstanding", currency),
          text("Payment status"),
        ],
        rows: list.map((o) => [
          o.po,
          o.orderDate,
          o.deliveryDate,
          stageLabel(o.stage),
          o.quantities.map((q) => `${q.quantity} ${q.unit}`).join(" · "),
          o.orderValueCny,
          o.settledCny,
          o.outstandingCny,
          o.held ? "Pending review" : o.paymentStatus ? PAYMENT_STATUS[o.paymentStatus].label : null,
        ]),
      })),
      ...perCurrency(data.lines.rows).map(([currency, list]) => ({
        sheet: "Order Lines",
        title: `Order lines (${currency})`,
        columns: [text("PO"), text("Item"), text("Unit"), text("Quantity"), money("Saved rate", currency), money("Amount", currency)],
        rows: list.map((l) => [l.po, l.item, l.unit, l.quantity, l.rateCny, l.amountCny]),
      })),
      ...perCurrency(data.payments.rows).map(([currency, list]) => ({
        sheet: "Payments",
        title: `Supplier payments (${currency})`,
        columns: [
          date("Paid on"),
          date("Due date"),
          text("PO"),
          text("Payment type"),
          text("Method"),
          money("Amount", currency),
          rate("Exchange rate", currency),
          money("INR equivalent", "INR"),
          text("Status"),
        ],
        rows: list.map((p) => [p.paidOn, p.dueDate, p.po, paymentType(p), p.mode, p.amountCny, p.rateInr, p.amountInr, p.voided ? `Voided: ${p.voidReason}` : p.held ? "Pending review" : p.status === "paid" ? "Paid" : "Due"]),
      })),
      ...ledger,
      ...deposits,
    ],
  };
}
