import { orderStatus, stageLabel } from "@/features/orders/order-status";
import { PAYMENT_STATUS } from "@/features/payments/money";
import type { OrderReportRow, OrderReportsResponse } from "@/lib/api/reports-types";
import { orderedCurrencies } from "@/lib/currencies";
import type { Currency } from "@/types/domain";

import { type Column, money, type ReportFile, type Section } from "../report-files";
import { orderReportsFilterLabel } from "./params";

// The Excel and PDF of the Order reports page (RPT-O2, backend docs/phase2-contracts.md 4.2; money per
// docs/unified-ledger.md): the rows the page shows after its filters, one table per order currency (so each amount
// column names its currency and no total adds two currencies), then a Summary sheet. The multiple-order report.

const date = (header: string): Column => ({ header, date: true });
const columns = (...list: (string | Column)[]) => list.map((column) => (typeof column === "string" ? { header: column } : column));
const sum = <T>(rows: T[], pick: (row: T) => number) => Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100;
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const OUTSTANDING_NOTE =
  "Settled and outstanding are the supplier ledger's: the supplier's payments settle its orders oldest first, so outstanding is never below 0. An order of a held account (pending review) has no figures and adds nothing to the totals.";

/** The row's payment status as the page and files write it: the API's FIFO status, "Pending review" while held. */
export const paymentStatusLabel = (row: Pick<OrderReportRow, "held" | "paymentStatus">) => (row.held ? "Pending review" : row.paymentStatus ? PAYMENT_STATUS[row.paymentStatus].label : null);
/** The row's status as the lists show it (a closed order reads "Closed", section 1.1). */
export const rowStatus = (row: OrderReportRow, today: string) => orderStatus(row, today);

function rowsTable(currency: Currency, rows: OrderReportRow[], today: string): Section {
  return {
    sheet: "Orders",
    title: `Orders in ${currency}`,
    columns: columns(
      "PO",
      "Supplier",
      "Supplier code",
      date("Order date"),
      "Stage",
      "Status",
      "Items",
      "Total quantity",
      "Item",
      "Ordered",
      "Unit",
      "Received",
      "Stocked",
      money("Order value", currency),
      "Rate (INR per 1)",
      money("Order value", "INR"),
      money("Settled", currency),
      money("Outstanding", currency),
      "Payment status",
      money("Paid", "INR"),
      money("Landed cost", "INR"),
      money("Per piece", "INR"),
      date("Closed on"),
    ),
    rows: rows.map((row) => [
      row.po,
      row.supplier.name,
      row.supplier.code,
      row.orderDate,
      stageLabel(row.stage),
      rowStatus(row, today).label,
      row.lineCount,
      row.quantities.map((total) => `${total.quantity} ${total.unit}`).join(" · "),
      row.item,
      row.quantity,
      row.unit,
      row.received,
      row.stocked,
      row.orderValueCny,
      row.exchangeRate,
      row.orderValueInr,
      row.settledCny,
      row.outstandingCny,
      paymentStatusLabel(row),
      row.paidInr,
      row.landedCostInr,
      row.perPieceInr,
      row.closedOn,
    ]),
    total: rows.length
      ? [
          "Total",
          plural(rows.length, "order"),
          null,
          null,
          null,
          null,
          sum(rows, (row) => row.lineCount),
          null,
          null,
          null,
          null,
          null,
          null,
          sum(rows, (row) => row.orderValueCny),
          null,
          // Only when every order has a saved rate: a part total would read as the whole.
          rows.every((row) => row.orderValueInr !== null) ? sum(rows, (row) => row.orderValueInr ?? 0) : null,
          sum(rows, (row) => row.settledCny ?? 0),
          sum(rows, (row) => row.outstandingCny ?? 0),
          null,
          sum(rows, (row) => row.paidInr ?? 0),
          sum(rows, (row) => row.landedCostInr ?? 0),
          null,
          null,
        ]
      : undefined,
  };
}

/** The page's file, named `order-reports-<today>`, with the filters spelled out as the header pill shows them. */
export function orderReportsFile(data: OrderReportsResponse, today: string): ReportFile {
  const { rows, summary, filter } = data;
  const currencies = orderedCurrencies(rows.map((row) => row.currency));
  const tables = (currencies.length ? currencies : ["CNY" as const]).map((currency) =>
    rowsTable(
      currency,
      rows.filter((row) => row.currency === currency),
      today,
    ),
  );
  const summaryTable: Section = {
    sheet: "Summary",
    title: "Summary",
    columns: columns("Field", "Value"),
    rows: [
      ["Orders", summary.orders],
      ...summary.byCurrency.flatMap((total) => [
        [`Order value (${total.currency})`, total.orderValueCny],
        [`Settled (${total.currency})`, total.settledCny],
        [`Outstanding (${total.currency})`, total.outstandingCny],
      ]),
      ["Paid (INR)", summary.paidInr],
      ["Landed cost (INR)", summary.landedCostInr],
    ],
  };
  return {
    title: "Order reports",
    filename: `order-reports-${today}`,
    filters: orderReportsFilterLabel(filter) ?? "All orders",
    sections: [...tables, summaryTable],
    notes: [OUTSTANDING_NOTE],
  };
}
