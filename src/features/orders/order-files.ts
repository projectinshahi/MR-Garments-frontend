import { amountsText, type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import { apiClient } from "@/lib/api/client";
import type { OrderLineItem } from "@/lib/api/types";
import { formatDate, sumByCurrency } from "@/lib/formatters";

import type { OrderRow } from "./data/queries";
import { balanceCny, paymentStatus, pendingQty } from "./filter-orders";
import { stageLabel } from "./order-status";

// Phase 2 §5 and §6, and the page report downloads (backend docs/report-downloads.md): the files of the rows an orders
// tab shows after its filters (every matching order, not only the table's page), named <tab>-<today>. Amounts in order
// currencies go one table per currency, the header naming it (`money`); the rate is the one saved on each order (null
// for orders placed before rates were kept), never the supplier's rate now. Balances and payment status count supplier
// payments only; agent payments (sea freight) are in the INR column alone. The "Order items" sheet lists every line of
// those orders with its saved rate (ORD-7), never the item's master price.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });

export { describeFilters } from "@/features/reports/report-files";

/** "Order date: 1 Oct 2026 to 30 Oct 2026", "…: from 1 Oct 2026", "…: to 30 Oct 2026"; null when both ends are open. */
export function rangeLabel(label: string, from: string, to: string) {
  if (!from && !to) return null;
  const range = from && to ? `${formatDate(from)} to ${formatDate(to)}` : from ? `from ${formatDate(from)}` : `to ${formatDate(to)}`;
  return `${label}: ${range}`;
}

/** ORD-7, read when a download is chosen; null when it can't be read (the file then says so instead of the sheet). */
export const fetchOrderLines = () => apiClient.get<OrderLineItem[]>("/order-lines").catch((): null => null);

/** Lines of `rows`, per order in the rows' order, then position. */
function linesOf(rows: OrderRow[], lines: OrderLineItem[]) {
  const byOrder = new Map<string, OrderLineItem[]>();
  for (const line of lines) byOrder.set(line.orderId, [...(byOrder.get(line.orderId) ?? []), line]);
  return rows.flatMap((order) => (byOrder.get(order.id) ?? []).map((line) => ({ ...line, supplier: order.supplier })));
}

/** "Order items": every line of the exported orders, per currency, with the saved rate and what arrived. */
function itemSheet(rows: OrderRow[], lines: OrderLineItem[]): Section[] {
  return perCurrency(linesOf(rows, lines)).map(([currency, list]) => ({
    sheet: "Order Items",
    title: `Order items (${currency})`,
    columns: [
      text("PO"),
      text("Supplier"),
      text("Line"),
      text("Item"),
      text("Unit"),
      text("Ordered qty"),
      money("Saved rate", currency),
      money("Amount", currency),
      text("Received in China"),
      text("Pending in China"),
      text("Stocked in India"),
    ],
    rows: list.map((l) => [l.po, l.supplier, l.position + 1, l.item, l.unit, l.quantity, l.rateCny, l.valueCny, l.received, Math.max(0, l.quantity - l.received), l.stocked]),
  }));
}

/** The KPIs of the exported rows: how many orders and, per currency, their value, supplier payments and balance. */
const orderSummary = (rows: OrderRow[]) =>
  summarySection([
    ["Orders", rows.length],
    ["PO value", amountsText(sumByCurrency(rows, (o) => o.currency, (o) => o.orderValueCny))],
    ["Paid to supplier", amountsText(sumByCurrency(rows, (o) => o.currency, (o) => o.supplierPaidCny))],
    ["Balance to supplier", amountsText(sumByCurrency(rows, (o) => o.currency, balanceCny))],
    ["Paid, all payees (INR)", rows.reduce((sum, o) => Math.round((sum + o.paidInr) * 100) / 100, 0)],
  ]);

function file(title: string, slug: string, today: string, filters: string, sections: Section[], lines: OrderLineItem[] | null, rows: OrderRow[]): ReportFile {
  return {
    title,
    filename: `${slug}-${today}`,
    filters,
    sections: [orderSummary(rows), ...sections, ...(lines ? itemSheet(rows, lines) : [])],
    notes: [
      "Amounts are in each order's currency; the exchange rate is the one saved on the order when it was placed (INR per 1 unit).",
      "Paid and balance count payments to the supplier; shipping-agent payments (sea freight) count only in the INR column.",
      ...(lines ? [] : ["The order items could not be loaded, so the Order Items sheet is left out. Please try again."]),
    ],
  };
}

const totalOf = (list: OrderRow[], pick: (o: OrderRow) => number) => Math.round(list.reduce((sum, o) => sum + pick(o), 0) * 100) / 100;

/** All orders (05): every order matching the filters, per currency, with its saved rate, value, payments and balance. */
export const ordersFile = (rows: OrderRow[], filters: string, today: string, lines: OrderLineItem[] | null = null) =>
  file(
    "Orders",
    "orders",
    today,
    filters,
    perCurrency(rows).map(([currency, list]) => ({
      sheet: "Orders",
      title: `Orders (${currency})`,
      columns: [
        text("PO"),
        date("Order date"),
        text("Supplier"),
        text("Currency"),
        rate("Exchange rate", currency),
        text("Main item"),
        text("Ordered qty"),
        text("Unit"),
        date("Delivery date"),
        text("Stage"),
        text("Status"),
        money("PO total", currency),
        money("Paid to supplier", currency),
        money("Balance", currency),
        money("Paid, all payees", "INR"),
      ],
      rows: list.map((o) => [
        o.po,
        o.orderDate,
        o.supplier,
        o.currency,
        o.exchangeRate,
        o.item,
        o.quantity,
        o.unit,
        o.deliveryDate,
        stageLabel(o.stage),
        o.status,
        o.orderValueCny,
        o.supplierPaidCny,
        balanceCny(o),
        o.paidInr,
      ]),
      total: list.length
        ? ["Total", null, null, null, null, null, null, null, null, null, null, totalOf(list, (o) => o.orderValueCny), totalOf(list, (o) => o.supplierPaidCny), totalOf(list, balanceCny), totalOf(list, (o) => o.paidInr)]
        : undefined,
    })),
    lines,
    rows,
  );

/** Pending orders (stage 1): what is still to come from China, its value, payments and balance. */
export const pendingOrdersFile = (rows: OrderRow[], filters: string, today: string, lines: OrderLineItem[] | null = null) =>
  file(
    "Pending orders",
    "pending-orders",
    today,
    filters,
    perCurrency(rows).map(([currency, list]) => ({
      sheet: "Pending Orders",
      title: `Pending orders (${currency})`,
      columns: [
        text("PO"),
        text("Supplier"),
        date("Order date"),
        date("Expected delivery"),
        text("Main item"),
        text("Ordered qty"),
        text("Received qty"),
        text("Pending qty"),
        text("Unit"),
        money("Order value", currency),
        money("Paid to supplier", currency),
        money("Balance", currency),
        text("Payment status"),
        text("Current stage"),
      ],
      rows: list.map((o) => [
        o.po,
        o.supplier,
        o.orderDate,
        o.deliveryDate,
        o.item,
        o.quantity,
        o.received,
        pendingQty(o),
        o.unit,
        o.orderValueCny,
        o.supplierPaidCny,
        balanceCny(o),
        paymentStatus(o).label,
        stageLabel(o.stage),
      ]),
      total: list.length
        ? ["Total", null, null, null, null, null, null, null, null, totalOf(list, (o) => o.orderValueCny), totalOf(list, (o) => o.supplierPaidCny), totalOf(list, balanceCny), null, null]
        : undefined,
    })),
    lines,
    rows,
  );

/** Closed orders: every carrier stocked in India; the closing date, quantities, value, payments and final balance. */
export const closedOrdersFile = (rows: OrderRow[], filters: string, today: string, lines: OrderLineItem[] | null = null) =>
  file(
    "Closed orders",
    "closed-orders",
    today,
    filters,
    perCurrency(rows).map(([currency, list]) => ({
      sheet: "Closed Orders",
      title: `Closed orders (${currency})`,
      columns: [
        text("PO"),
        text("Supplier"),
        date("Order date"),
        date("Closed date"),
        text("Items"),
        text("Main item"),
        text("Ordered qty"),
        text("Warehouse received qty"),
        text("Unit"),
        money("Order value", currency),
        money("Paid to supplier", currency),
        money("Balance to supplier", currency),
        money("Paid, all payees", "INR"),
        text("Final status"),
      ],
      rows: list.map((o) => [
        o.po,
        o.supplier,
        o.orderDate,
        o.closedOn,
        lines ? lines.filter((l) => l.orderId === o.id).length : null,
        o.item,
        o.quantity,
        o.stocked,
        o.unit,
        o.orderValueCny,
        o.supplierPaidCny,
        balanceCny(o),
        o.paidInr,
        o.status,
      ]),
      total: list.length
        ? ["Total", null, null, null, null, null, null, null, null, totalOf(list, (o) => o.orderValueCny), totalOf(list, (o) => o.supplierPaidCny), totalOf(list, balanceCny), totalOf(list, (o) => o.paidInr), null]
        : undefined,
    })),
    lines,
    rows,
  );
