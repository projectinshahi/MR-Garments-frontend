import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import { stageLabel } from "@/features/orders/order-status";
import type { SupplierOrderRow, SupplierOrdersResponse } from "@/lib/api/reports-types";
import { formatDate, formatNumber, formatQty } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

import { DOLLAR_COST_NOTE, dollarCostTotalText } from "../dollar-cost";
import { OUTSTANDING_NOTE, paymentStatusLabel, rowStatus } from "../order-reports/order-reports-file";
import { orderReportsFilterLabel } from "../order-reports/params";
import { type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "../report-files";

// The CSV, Excel and PDF of Supplier order details (RPT-S1): per supplier, one table per order currency (each amount
// column names its currency and no total adds two), then every order line per currency, then the summary. The figures
// are the API's; the helpers here also write the page's cells.

type Line = SupplierOrderRow["lines"][number];
const sum = <T>(rows: T[], pick: (row: T) => number) => Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100;
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const date = (header: string): Column => ({ header, date: true });
const text = (header: string): Column => ({ header });

export const NOT_LISTED_NOTE = "A supplier with no order matching the filters is not listed.";

/** A quantity per unit over the lines, pieces and metres apart: "120 pcs · 30 m". */
export const perUnit = (lines: Line[], pick: (line: Line) => number) =>
  [...new Set(lines.map((line) => line.unit))].map((unit) => formatQty(sum(lines.filter((line) => line.unit === unit), pick), unit)).join(" · ") || "–";

/** "RPTU 1000001: On the sea, ETA 30 Nov 2026 (FOB, 120)". */
export const containerText = (container: SupplierOrderRow["containers"][number]) =>
  `${container.number}: ${CONTAINER_STATUS[container.status]?.label ?? container.status}${container.eta ? `, ETA ${formatDate(container.eta)}` : ""} (${[container.terms, formatNumber(container.quantity)].filter(Boolean).join(", ")})`;

/** "Final", or "Estimate (waiting for duty)". */
export const landedCostStatus = (cost: NonNullable<SupplierOrderRow["landedCost"]>) => (cost.final ? "Final" : cost.waitingFor ? `Estimate (waiting for ${cost.waitingFor})` : "Estimate");

/** Dollar Cost over orders the totals count: a figure only when every one is known (the API's rule). */
const dollarTotal = (values: (number | null)[]) => (values.every((value) => value !== null) ? sum(values, (value) => value ?? 0) : null);

function supplierTable(name: string, currency: Currency, rows: SupplierOrderRow[], today: string): Section {
  // A held account's orders (D4) are listed, but their money adds nothing to the totals.
  const counted = rows.filter((row) => !row.held);
  return {
    sheet: "Orders by supplier",
    title: `${name}: orders in ${currency}`,
    columns: [
      text("PO"),
      date("Order date"),
      text("Supplier"),
      text("Items"),
      text("Ordered"),
      text("Received"),
      text(`Rates (${currency})`),
      money("PO value", currency),
      money("Order value (received)", currency),
      text("Currency"),
      rate("Rate", currency),
      rate("USD rate", "USD"),
      money("Dollar cost", "USD"),
      money("Paid (settled)", currency),
      money("Outstanding", currency),
      text("Payment status"),
      text("Status"),
      text("Stage"),
      text("Containers"),
      money("Landed cost", "INR"),
      money("Goods", "INR"),
      money("Sea freight", "INR"),
      money("Clearing", "INR"),
      money("Transport", "INR"),
      money("Per piece", "INR"),
      text("Landed cost status"),
    ],
    rows: rows.map((row) => [
      row.po,
      row.orderDate,
      name,
      row.lines.map((line) => line.item).join("; "),
      perUnit(row.lines, (line) => line.ordered),
      perUnit(row.lines, (line) => line.received),
      row.lines.map((line) => line.rate.toFixed(2)).join("; "),
      row.poValueCny,
      row.orderValueCny,
      row.currency,
      row.exchangeRate,
      row.usdRate,
      row.dollarCost,
      row.settledCny,
      row.outstandingCny,
      paymentStatusLabel(row),
      rowStatus(row, today).label,
      stageLabel(row.stage),
      row.containers.map(containerText).join("; ") || null,
      row.landedCost?.totalInr ?? null,
      row.landedCost?.goodsInr ?? null,
      row.landedCost?.seaFreightInr ?? null,
      row.landedCost?.clearingInr ?? null,
      row.landedCost?.transportInr ?? null,
      row.landedCost?.perPieceInr ?? null,
      row.landedCost ? landedCostStatus(row.landedCost) : null,
    ]),
    total: [
      "Total",
      null,
      null,
      plural(rows.length, "order"),
      null,
      null,
      null,
      sum(counted, (row) => row.poValueCny),
      sum(counted, (row) => row.orderValueCny),
      null,
      null,
      null,
      dollarTotal(counted.map((row) => row.dollarCost)),
      sum(counted, (row) => row.settledCny ?? 0),
      sum(counted, (row) => row.outstandingCny ?? 0),
      null,
      null,
      null,
      null,
      sum(counted, (row) => row.landedCost?.totalInr ?? 0),
      sum(counted, (row) => row.landedCost?.goodsInr ?? 0),
      sum(counted, (row) => row.landedCost?.seaFreightInr ?? 0),
      sum(counted, (row) => row.landedCost?.clearingInr ?? 0),
      sum(counted, (row) => row.landedCost?.transportInr ?? 0),
      null,
      null,
    ],
  };
}

function linesTable(currency: Currency, rows: (SupplierOrderRow & { supplierName: string })[]): Section {
  const lines = rows.flatMap((row) => row.lines.map((line) => ({ row, line })));
  const counted = lines.filter(({ row }) => !row.held);
  return {
    sheet: "Order lines",
    title: `Order lines in ${currency}`,
    columns: [
      text("Supplier"),
      text("PO"),
      date("Order date"),
      text("Item"),
      text("Unit"),
      text("Ordered"),
      text("Received"),
      money("Rate", currency),
      money("PO value", currency),
      money("Order value (received)", currency),
      money("Dollar cost", "USD"),
    ],
    rows: lines.map(({ row, line }) => [row.supplierName, row.po, row.orderDate, line.item, line.unit, line.ordered, line.received, line.rate, line.poValueCny, line.orderValueCny, line.dollarCost]),
    total: lines.length
      ? [
          "Total",
          plural(rows.length, "order"),
          null,
          plural(lines.length, "line"),
          null,
          null,
          null,
          null,
          sum(counted, ({ line }) => line.poValueCny),
          sum(counted, ({ line }) => line.orderValueCny),
          dollarTotal(counted.map(({ line }) => line.dollarCost)),
        ]
      : undefined,
  };
}

/** The page's file, named `supplier-order-details-<today>`, with the filters as the header pill shows them. */
export function supplierOrdersFile(data: SupplierOrdersResponse, today: string): ReportFile {
  const { suppliers, summary, filter } = data;
  const orders = suppliers.flatMap((group) => group.rows.map((row) => ({ ...row, supplierName: group.supplier.name })));
  const tables = suppliers.flatMap((group) => perCurrency(group.rows).map(([currency, rows]) => supplierTable(group.supplier.name, currency, rows, today)));
  return {
    title: "Supplier order details",
    filename: `supplier-order-details-${today}`,
    filters: orderReportsFilterLabel(filter) ?? "All orders",
    sections: [
      summarySection([
        ["Suppliers", summary.suppliers],
        ["Orders", summary.orders],
        ...summary.byCurrency.flatMap((total): [string, number][] => [
          [`PO value (${total.currency})`, total.poValueCny],
          [`Order value (received) (${total.currency})`, total.orderValueCny],
          [`Paid (settled) (${total.currency})`, total.settledCny],
          [`Outstanding (${total.currency})`, total.outstandingCny],
        ]),
        ["Dollar cost (USD)", summary.dollarCost.usd ?? dollarCostTotalText(summary.dollarCost)],
        ["Paid (INR)", summary.paidInr],
        ["Landed cost (INR)", summary.landedCostInr],
      ]),
      ...(tables.length ? tables : [supplierTable("No supplier", "CNY", [], today)]).map((table) => (table.rows.length ? table : { ...table, total: undefined })),
      ...perCurrency(orders).map(([currency, rows]) => linesTable(currency, rows)),
    ],
    notes: [OUTSTANDING_NOTE, DOLLAR_COST_NOTE, NOT_LISTED_NOTE],
  };
}
