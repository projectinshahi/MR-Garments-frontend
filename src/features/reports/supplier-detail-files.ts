import { statementFile } from "@/features/deposits/deposit-files";
import { stageLabel } from "@/features/orders/order-status";
import type { SupplierStatement } from "@/lib/api/deposits-types";
import { formatDateTime } from "@/lib/formatters";

import type { SupplierPaymentDetail } from "./data/queries";
import { type Column, money, perCurrency, rate, type ReportFile, type Section } from "./report-files";

// One supplier's report download (RPT-5D with `all=1`, backend docs/report-downloads.md): the profile, the money
// summary per order currency, every order, order line (with its saved rate, never the item's price now) and supplier
// payment the page's period, payment-date and stage filters keep, then the supplier's account deposits and their
// transactions (SD-1) when the user may view payments. Account deposits are never payments of a PO.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const or = (value: string) => value.trim() || null;

export function supplierDetailFile(data: SupplierPaymentDetail, statement: SupplierStatement | null, filters: string, today: string): ReportFile {
  const { supplier, summary } = data;
  const deposits: Section[] = statement
    ? statementFile(statement, today).sections.map((section) => ({ ...section, sheet: section.sheet === "Summary" ? "Deposit Summary" : section.sheet }))
    : [];
  return {
    title: `Supplier report: ${supplier.name}`,
    filename: `supplier-${(supplier.code || supplier.name).replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-${today}`,
    filters,
    notes: [
      "Paid and balance count payments to the supplier; each payment keeps the exchange rate typed for it (INR per 1 unit).",
      "Supplier deposits belong to the supplier's account and are never counted as payments of a PO.",
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
        columns: [text("Orders"), money("Order value", currency), money("Paid", currency), money("Of which deposits", currency), money("Paid", "INR"), money("Balance", currency)],
        rows: list.map((t) => [t.orders, t.orderValueCny, t.paidCny, t.depositsCny, t.paidInr, t.balanceCny]),
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
          money("Paid", currency),
          money("Balance", currency),
        ],
        rows: list.map((o) => [o.po, o.orderDate, o.deliveryDate, stageLabel(o.stage), o.quantities.map((q) => `${q.quantity} ${q.unit}`).join(" · "), o.orderValueCny, o.paidCny, o.balanceCny]),
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
        rows: list.map((p) => [p.paidOn, p.dueDate, p.po, p.kind, p.mode, p.amountCny, p.rateInr, p.amountInr, p.status === "paid" ? "Paid" : "Due"]),
      })),
      ...deposits,
    ],
  };
}
