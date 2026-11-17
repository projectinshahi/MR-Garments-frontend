import { describe, expect, it } from "vitest";

import type { OrderReportRow, OrderReportsResponse } from "@/lib/api/reports-types";

import { toCsv } from "../csv";
import { toPdf } from "../pdf";
import { csvRows } from "../report-files";
import { toXlsx } from "../xlsx";
import { orderReportsFile, OUTSTANDING_NOTE, outstanding, outstandingTotal } from "./order-reports-file";

const TODAY = "2026-11-09";
const row = (over: Partial<OrderReportRow>): OrderReportRow => ({
  id: "o1",
  exchangeRate: null,
  orderValueInr: null,
  po: "PO-2050",
  orderDate: "2026-10-10",
  deliveryDate: "2026-11-19",
  stage: 6,
  supplier: { id: "s1", name: "Guangzhou Textile Co.", code: "SUP-001" },
  currency: "CNY",
  item: "Denim jeans",
  quantity: 100,
  unit: "pcs",
  received: 120,
  stocked: 100,
  lineCount: 2,
  quantities: [
    { unit: "pcs", quantity: 100 },
    { unit: "m", quantity: 50 },
  ],
  closed: true,
  closedOn: "2026-11-05",
  orderValueCny: 1400,
  paidCny: 800,
  paidInr: 9850,
  balanceCny: 600,
  paymentStatus: "partly",
  landedCostInr: 49550,
  perPieceInr: 330.33,
  ...over,
});
const data: OrderReportsResponse = {
  rows: [
    row({}),
    row({ id: "o2", po: "PO-2051", stage: 1, closed: false, closedOn: null, currency: "USD", orderValueCny: 200, paidCny: 0, paidInr: 0, balanceCny: 200, paymentStatus: "unpaid", landedCostInr: null, perPieceInr: null, received: 0, stocked: 0 }),
  ],
  summary: {
    orders: 2,
    byCurrency: [
      { currency: "CNY", orderValueCny: 1400, paidCny: 800, balanceCny: 600 },
      { currency: "USD", orderValueCny: 200, paidCny: 0, balanceCny: 200 },
    ],
    paidInr: 9850,
    landedCostInr: 49550,
  },
  filter: { po: null, supplierName: null, supplier: "Guangzhou Textile Co.", from: null, to: null, status: null, stage: null, currency: null, warehouse: null, paymentStatus: null },
  options: { suppliers: [], warehouses: [] },
};

describe("order reports file", () => {
  const file = orderReportsFile(data, TODAY);

  it("is named by today, spells out the filters and holds one table per currency plus the summary", () => {
    expect(file).toMatchObject({ title: "Order reports", filename: "order-reports-2026-11-09", filters: "Guangzhou Textile Co." });
    expect(file.sections.map((section) => [section.sheet, section.title])).toEqual([
      ["Orders", "Orders in CNY"],
      ["Orders", "Orders in USD"],
      ["Summary", "Summary"],
    ]);
  });

  it("writes each row with its status label, payment status and INR figures, and totals the currency's table", () => {
    const [cny, usd] = file.sections;
    expect(cny!.columns.map((column) => column.header)).toContain("Order value (CNY)");
    expect(cny!.rows).toEqual([
      ["PO-2050", "Guangzhou Textile Co.", "SUP-001", "2026-10-10", "6. India warehouse", "Closed", 2, "100 pcs · 50 m", "Denim jeans", 100, "pcs", 120, 100, 1400, null, null, 800, 600, "Partly paid", 9850, 49550, 330.33, "2026-11-05"],
    ]);
    expect(cny!.total).toEqual(["Total", "1 order", null, null, null, null, 2, null, null, null, null, null, null, 1400, null, null, 800, 600, null, 9850, 49550, null, null]);
    // A pending order due in 10 days reads as the orders list labels it (on track beyond 7 days); no cost yet is an empty cell.
    expect(usd!.rows[0]).toEqual(["PO-2051", "Guangzhou Textile Co.", "SUP-001", "2026-10-10", "1. Order and deposit", "On track", 2, "100 pcs · 50 m", "Denim jeans", 100, "pcs", 0, 0, 200, null, null, 0, 200, "Unpaid", 0, null, null, null]);
    expect(usd!.columns.map((column) => column.header)).toContain("Balance (USD)");
  });

  // docs/supplier-currency.md: the rate saved on the order and the PO value at it; an INR total only when every order has a rate.
  it("carries the rate saved on the order and the PO value at it, totalling INR only when every order has a rate", () => {
    const withRate = orderReportsFile({ ...data, rows: [row({ currency: "USD", exchangeRate: 88, orderValueCny: 200, orderValueInr: 17600 })] }, TODAY);
    const table = withRate.sections.find((section) => section.title === "Orders in USD")!;
    expect(table.columns.map((column) => column.header).slice(13, 16)).toEqual(["Order value (USD)", "Rate (INR per 1)", "Order value (INR)"]);
    expect(table.rows[0]!.slice(13, 16)).toEqual([200, 88, 17600]);
    expect(table.total!.slice(13, 16)).toEqual([200, null, 17600]);
    expect(file.sections[0]!.total!.slice(13, 16)).toEqual([1400, null, null]);
  });

  it("summarises per currency with the INR totals", () => {
    expect(file.sections[2]!.rows).toEqual([
      ["Orders", 2],
      ["Order value (CNY)", 1400],
      ["Paid (CNY)", 800],
      ["Balance (CNY)", 600],
      ["Order value (USD)", 200],
      ["Paid (USD)", 0],
      ["Balance (USD)", 200],
      ["Paid (INR)", 9850],
      ["Landed cost (INR)", 49550],
    ]);
  });

  it("keeps one empty CNY table with no total when nothing matches, and says All orders when unfiltered", () => {
    const empty = orderReportsFile({ ...data, rows: [], summary: { orders: 0, byCurrency: [], paidInr: 0, landedCostInr: 0 }, filter: { ...data.filter, supplier: null } }, TODAY);
    expect(empty.filters).toBe("All orders");
    expect(empty.sections[0]).toMatchObject({ title: "Orders in CNY", rows: [], total: undefined });
    expect(empty.sections).toHaveLength(2);
  });

  it("adds Advance applied next to Paid when the API reports the supplier advance (value - paid - advance = balance)", () => {
    const withAdvance = orderReportsFile(
      {
        ...data,
        rows: [row({ advanceCny: 300, balanceCny: 300 })],
        summary: { orders: 1, byCurrency: [{ currency: "CNY", orderValueCny: 1400, paidCny: 800, advanceCny: 300, balanceCny: 300 }], paidInr: 9850, landedCostInr: 49550 },
      },
      TODAY,
    );
    const [table, summary] = withAdvance.sections;
    const headers = table!.columns.map((column) => column.header);
    const at = headers.indexOf("Advance applied (CNY)");
    expect(headers.slice(at - 1, at + 2)).toEqual(["Paid (CNY)", "Advance applied (CNY)", "Balance (CNY)"]);
    expect(table!.rows[0]!.slice(at - 1, at + 2)).toEqual([800, 300, 300]);
    expect(table!.total!.slice(at - 1, at + 2)).toEqual([800, 300, 300]);
    expect(summary!.rows).toContainEqual(["Advance applied (CNY)", 300]);
  });
});

// The report's Balance (outstanding) never goes below 0: an overpaid order shows 0 and adds nothing to a total. The
// API's balanceCny keeps the true signed figure; only this report's page and files floor it.
describe("order reports outstanding balance (zero floor)", () => {
  it("shows a positive outstanding as it is, and 0 for zero or negative", () => {
    expect(outstanding({ balanceCny: 1000 })).toBe(1000);
    expect(outstanding({ balanceCny: 0 })).toBe(0);
    expect(outstanding({ balanceCny: -500 })).toBe(0);
    expect(outstanding({ balanceCny: 0.01 })).toBe(0.01);
  });

  const owing = row({ id: "a", po: "PO-3001", orderValueCny: 2000, paidCny: 1000, paidInr: 12000, balanceCny: 1000 });
  const settled = row({ id: "b", po: "PO-3002", orderValueCny: 800, paidCny: 800, paidInr: 9600, balanceCny: 0, paymentStatus: "paid" });
  const overpaid = row({ id: "c", po: "PO-3003", orderValueCny: 1000, paidCny: 1500, paidInr: 18000, balanceCny: -500, paymentStatus: "paid" });
  const usdOwing = row({ id: "d", po: "PO-3004", currency: "USD", exchangeRate: 88, orderValueCny: 300, orderValueInr: 26400, paidCny: 0, paidInr: 0, balanceCny: 300, paymentStatus: "unpaid" });
  const usdOverpaid = row({ id: "e", po: "PO-3005", currency: "USD", exchangeRate: 88, orderValueCny: 100, orderValueInr: 8800, paidCny: 150.5, paidInr: 13244, balanceCny: -50.5, paymentStatus: "paid" });
  const mixed: OrderReportsResponse = {
    ...data,
    rows: [owing, settled, overpaid, usdOwing, usdOverpaid],
    summary: {
      orders: 5,
      // As the API sends it: signed sums (1000 + 0 - 500, 300 - 50.5). The report must not show these.
      byCurrency: [
        { currency: "CNY", orderValueCny: 3800, paidCny: 3300, balanceCny: 500 },
        { currency: "USD", orderValueCny: 400, paidCny: 150.5, balanceCny: 249.5 },
      ],
      paidInr: 52844,
      landedCostInr: 0,
    },
  };
  const file = orderReportsFile(mixed, TODAY);
  const [cny, usd, summary] = file.sections;
  const balanceAt = cny!.columns.findIndex((column) => column.header === "Balance (CNY)");

  it("floors each row and totals only what is owed, per currency (negatives add 0)", () => {
    expect(cny!.rows.map((cells) => [cells[0], cells[balanceAt]])).toEqual([
      ["PO-3001", 1000],
      ["PO-3002", 0],
      ["PO-3003", 0],
    ]);
    expect(cny!.total![balanceAt]).toBe(1000);
    expect(usd!.rows.map((cells) => cells[balanceAt])).toEqual([300, 0]);
    expect(usd!.total![balanceAt]).toBe(300);
    expect(outstandingTotal(mixed.rows, "CNY")).toBe(1000);
    expect(outstandingTotal(mixed.rows, "USD")).toBe(300);
  });

  it("keeps every other figure, the currencies and the rates exactly as the API sent them", () => {
    const paidAt = cny!.columns.findIndex((column) => column.header === "Paid (CNY)");
    expect(cny!.rows[2]!.slice(13, 17)).toEqual([1000, null, null, 1500]);
    expect(cny!.total![paidAt]).toBe(3300);
    expect(usd!.rows[1]!.slice(13, 17)).toEqual([100, 88, 8800, 150.5]);
    expect(usd!.total!.slice(13, 17)).toEqual([400, null, 35200, 150.5]);
    expect(mixed.rows[2]!.balanceCny).toBe(-500);
  });

  it("puts the floored totals in the Summary sheet and says why in a note", () => {
    expect(summary!.rows).toEqual([
      ["Orders", 5],
      ["Order value (CNY)", 3800],
      ["Paid (CNY)", 3300],
      ["Balance (CNY)", 1000],
      ["Order value (USD)", 400],
      ["Paid (USD)", 150.5],
      ["Balance (USD)", 300],
      ["Paid (INR)", 52844],
      ["Landed cost (INR)", 0],
    ]);
    expect(file.notes).toEqual([OUTSTANDING_NOTE]);
  });

  it("writes the floored balances into the CSV, Excel and PDF files, with no negative balance anywhere", () => {
    const lines = toCsv(csvRows(file)).split("\r\n");
    const cellsOf = (start: string) => lines.find((line) => line.startsWith(start))!.split(",");
    expect(cellsOf("PO-3001")[balanceAt]).toBe("1000");
    expect(cellsOf("PO-3002")[balanceAt]).toBe("0");
    expect(cellsOf("PO-3003")[balanceAt]).toBe("0");
    expect(cellsOf("Total,3 orders")[balanceAt]).toBe("1000");
    expect(cellsOf("PO-3005")[balanceAt]).toBe("0");
    expect(cellsOf("Total,2 orders")[balanceAt]).toBe("300");

    // The workbook is a stored (uncompressed) zip, so its sheet XML reads as text.
    const xlsx = new TextDecoder().decode(toXlsx(file, "Generated"));
    expect(xlsx).toContain(OUTSTANDING_NOTE);
    for (const signed of ["-500", "-50.5", "500", "249.5"]) expect(xlsx).not.toContain(`<v>${signed}</v>`);
    expect(xlsx).toContain("<v>1000</v>");

    // The PDF's text runs in drawing order (a narrow amount cell wraps, "1,000." then "00"); the Summary's whole
    // numbers read in one run, right after their label.
    const pdf = Array.from(toPdf(file, "Generated"), (byte) => String.fromCharCode(byte)).join("");
    const runs = [...pdf.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((match) => match[1]!);
    expect(runs[runs.lastIndexOf("Balance \\(CNY\\)") + 1]).toBe("1,000");
    expect(runs[runs.lastIndexOf("Balance \\(USD\\)") + 1]).toBe("300");
    expect(runs.filter((run) => /^-\d/.test(run))).toEqual([]);
    expect(runs).not.toContain("249.50");
  });
});
