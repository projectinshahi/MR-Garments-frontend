import { type Column, money, perCurrency, type ReportFile, type Section } from "@/features/reports/report-files";
import { formatDate } from "@/lib/formatters";

import type { OrderRow } from "./data/queries";
import { balanceCny, paymentStatus, pendingQty } from "./filter-orders";
import { stageLabel } from "./order-status";

// Phase 2 §5 and §6: Excel/PDF of the rows an orders tab shows after its filters, named <tab>-<today>, so the file
// matches the screen and the page's permission guards the export. Quantities stay numbers with the unit in its own
// column; amounts in order currencies go one table per currency, the header naming it (`money`), as the reports do.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });

/** The filters in force joined with " · " (false, null and "" parts left out); "No filters" when none. */
export const describeFilters = (parts: (string | null | false)[]) => parts.filter(Boolean).join(" · ") || "No filters";

/** "Order date: 1 Oct 2026 to 30 Oct 2026", "…: from 1 Oct 2026", "…: to 30 Oct 2026"; null when both ends are open. */
export function rangeLabel(label: string, from: string, to: string) {
  if (!from && !to) return null;
  const range = from && to ? `${formatDate(from)} to ${formatDate(to)}` : from ? `from ${formatDate(from)}` : `to ${formatDate(to)}`;
  return `${label}: ${range}`;
}

const file = (title: string, slug: string, today: string, filters: string, sections: Section[]): ReportFile => ({
  title,
  filename: `${slug}-${today}`,
  filters,
  sections,
});

/** All orders (05): the table's columns; Paid so far is INR on every row, so one table. */
export const ordersFile = (rows: OrderRow[], filters: string, today: string) =>
  file("Orders", "orders", today, filters, [
    {
      columns: [text("PO"), text("Item"), text("Supplier"), text("Quantity"), text("Unit"), date("Delivery date"), text("Stage"), text("Status"), money("Paid so far", "INR")],
      rows: rows.map((o) => [o.po, o.item, o.supplier, o.quantity, o.unit, o.deliveryDate, stageLabel(o.stage), o.status, o.paidInr]),
    },
  ]);

/** Pending orders: the Pending tab's columns, per currency. */
export const pendingOrdersFile = (rows: OrderRow[], filters: string, today: string) =>
  file(
    "Pending orders",
    "pending-orders",
    today,
    filters,
    perCurrency(rows).map(([currency, list]) => ({
      columns: [
        text("PO"),
        text("Supplier"),
        date("Order date"),
        date("Expected delivery"),
        text("Ordered qty"),
        text("Unit"),
        text("Pending qty"),
        money("Order value", currency),
        text("Payment status"),
        text("Current stage"),
      ],
      rows: list.map((o) => [o.po, o.supplier, o.orderDate, o.deliveryDate, o.quantity, o.unit, pendingQty(o), o.orderValueCny, paymentStatus(o).label, stageLabel(o.stage)]),
    })),
  );

/** Closed orders: the Closed tab's columns, per currency. */
export const closedOrdersFile = (rows: OrderRow[], filters: string, today: string) =>
  file(
    "Closed orders",
    "closed-orders",
    today,
    filters,
    perCurrency(rows).map(([currency, list]) => ({
      columns: [
        text("PO"),
        text("Supplier"),
        money("Order value", currency),
        text("Ordered qty"),
        text("Unit"),
        text("Warehouse received qty"),
        money("Paid to supplier", currency),
        money("Balance to supplier", currency),
        date("Closed date"),
      ],
      rows: list.map((o) => [o.po, o.supplier, o.orderValueCny, o.quantity, o.unit, o.stocked, o.supplierPaidCny, balanceCny(o), o.closedOn]),
    })),
  );
