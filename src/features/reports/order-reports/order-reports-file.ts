import { orderStatus, stageLabel } from "@/features/orders/order-status";
import type { OrderReportRow, OrderReportsResponse } from "@/lib/api/reports-types";
import { orderedCurrencies } from "@/lib/currencies";
import type { Currency } from "@/types/domain";

import { type Column, money, type ReportFile, type Section } from "../report-files";
import { orderReportsFilterLabel } from "./params";

// The Excel and PDF of the Order reports page (RPT-O2, backend docs/phase2-contracts.md 4.2): the rows the page shows
// after its filters, one table per order currency (so each amount column names its currency and no total adds two
// currencies), then a Summary sheet. The multiple-order report.

const date = (header: string): Column => ({ header, date: true });
const columns = (...list: (string | Column)[]) => list.map((column) => (typeof column === "string" ? { header: column } : column));
const sum = <T>(rows: T[], pick: (row: T) => number) => Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100;
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * The Balance this report shows (page, PDF, Excel, CSV): what is still owed to the supplier, never below 0, so an
 * overpaid order reads 0 and adds nothing to a total. Display only: RPT-O2's `balanceCny`, the order's own balance and
 * every other report keep the true signed figure.
 */
export const outstanding = (row: Pick<OrderReportRow, "balanceCny">) => Math.max(0, row.balanceCny);
/** The report's Balance total in one order currency: the rows' floored balances added up, to the cent. */
export const outstandingTotal = (rows: OrderReportRow[], currency: Currency) => sum(rows.filter((row) => row.currency === currency), outstanding);
export const OUTSTANDING_NOTE = "Balance is what is still owed to the supplier: an overpaid order shows 0 and adds nothing to the totals.";

export const PAYMENT_STATE_LABEL: Record<OrderReportRow["paymentStatus"], string> = { unpaid: "Unpaid", partly: "Partly paid", paid: "Paid" };
/** The row's status as the lists show it (a closed order reads "Closed", section 1.1). */
export const rowStatus = (row: OrderReportRow, today: string) => orderStatus(row, today);

// A backend that reports the supplier advance (backend docs/supplier-advance.md) adds an "Advance applied" column next
// to Paid, so value - paid - advance = balance can be read on every row; an older one keeps the columns as they were.
function rowsTable(currency: Currency, rows: OrderReportRow[], today: string, withAdvance: boolean): Section {
  const advance = <T>(value: T): T[] => (withAdvance ? [value] : []);
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
      money("Paid", currency),
      ...advance(money("Advance applied", currency)),
      money("Balance", currency),
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
      row.paidCny,
      ...advance(row.advanceCny ?? 0),
      outstanding(row),
      PAYMENT_STATE_LABEL[row.paymentStatus],
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
          sum(rows, (row) => row.paidCny),
          ...advance(sum(rows, (row) => row.advanceCny ?? 0)),
          sum(rows, outstanding),
          null,
          sum(rows, (row) => row.paidInr),
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
  const withAdvance = rows.some((row) => row.advanceCny !== undefined);
  const tables = (currencies.length ? currencies : ["CNY" as const]).map((currency) =>
    rowsTable(
      currency,
      rows.filter((row) => row.currency === currency),
      today,
      withAdvance,
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
        [`Paid (${total.currency})`, total.paidCny],
        ...(total.advanceCny === undefined ? [] : [[`Advance applied (${total.currency})`, total.advanceCny]]),
        [`Balance (${total.currency})`, outstandingTotal(rows, total.currency)],
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
