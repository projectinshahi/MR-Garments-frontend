import { describe, expect, it } from "vitest";

import type { OrderReportRow, OrderReportsResponse } from "@/lib/api/reports-types";

import { toCsv } from "../csv";
import { toPdf } from "../pdf";
import { csvRows } from "../report-files";
import { toXlsx } from "../xlsx";
import { DOLLAR_COST_NOTE } from "../dollar-cost";
import { orderReportsFile, OUTSTANDING_NOTE } from "./order-reports-file";

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
  orderValueCny: 1400, poValueCny: 1400,
  usdRate: null,
  dollarCost: null,
  held: false,
  settledCny: 800,
  outstandingCny: 600,
  paymentStatus: "partly",
  settledInr: 9850,
  agentPaidInr: 0,
  paidInr: 9850,
  depositRequiredCny: null,
  depositSettledCny: 800,
  depositPendingCny: null,
  depositStatus: "none",
  landedCostInr: 49550,
  perPieceInr: 330.33,
  ...over,
});
const data: OrderReportsResponse = {
  rows: [
    row({}),
    row({
      id: "o2",
      po: "PO-2051",
      stage: 1,
      closed: false,
      closedOn: null,
      currency: "USD",
      orderValueCny: 200, poValueCny: 200,
      dollarCost: 200,
      settledCny: 0,
      outstandingCny: 200,
      settledInr: 0,
      paidInr: 0,
      paymentStatus: "unpaid",
      landedCostInr: null,
      perPieceInr: null,
      received: 0,
      stocked: 0,
    }),
  ],
  summary: {
    orders: 2,
    byCurrency: [
      { currency: "CNY", orderValueCny: 1400, poValueCny: 1400, settledCny: 800, outstandingCny: 600 },
      { currency: "USD", orderValueCny: 200, poValueCny: 200, settledCny: 0, outstandingCny: 200 },
    ],
    dollarCost: { usd: null, missing: 1 },
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

  it("writes each row with its status label, the ledger's settled, outstanding and payment status, and totals the currency's table", () => {
    const [cny, usd] = file.sections;
    const headers = cny!.columns.map((column) => column.header);
    expect(headers.slice(12, 15)).toEqual(["PO value (CNY)", "Order value (received) (CNY)", "Rate (INR per 1)"]);
    expect(headers).not.toContain("Supplier code");
    expect(headers[16]).toBe("Dollar cost (USD)");
    expect(headers.slice(18, 21)).toEqual(["Settled (CNY)", "Outstanding (CNY)", "Payment status"]);
    expect(headers[17]).toBe("USD rate (INR per 1 USD)");
    expect(cny!.rows).toEqual([
      ["PO-2050", "Guangzhou Textile Co.", "2026-10-10", "6. India warehouse", "Closed", 2, "100 pcs · 50 m", "Denim jeans", 100, "pcs", 120, 100, 1400, 1400, null, null, null, null, 800, 600, "Partly paid", 9850, 49550, 330.33, "2026-11-05"],
    ]);
    // No Dollar Cost total while an order has no USD rate saved (as the INR total without a rate).
    expect(cny!.total).toEqual(["Total", "1 order", null, null, null, 2, null, null, null, null, null, null, 1400, 1400, null, null, null, null, 800, 600, null, 9850, 49550, null, null]);
    // A pending order due in 10 days reads as the orders list labels it (on track beyond 7 days); no cost yet is an empty cell.
    expect(usd!.rows[0]).toEqual(["PO-2051", "Guangzhou Textile Co.", "2026-10-10", "1. Order and deposit", "On track", 2, "100 pcs · 50 m", "Denim jeans", 100, "pcs", 0, 0, 200, 200, null, null, 200, null, 0, 200, "Unpaid", 0, null, null, null]);
    expect(usd!.columns.map((column) => column.header)).toContain("Outstanding (USD)");
    expect(usd!.total![16]).toBe(200); // every USD order has its Dollar Cost
  });

  // docs/supplier-currency.md: the rate saved on the order and the PO value at it; an INR total only when every order has a rate.
  it("carries the rate saved on the order and the PO value at it, totalling INR only when every order has a rate", () => {
    const withRate = orderReportsFile({ ...data, rows: [row({ currency: "USD", exchangeRate: 88, orderValueCny: 200, poValueCny: 200, orderValueInr: 17600 })] }, TODAY);
    const table = withRate.sections.find((section) => section.title === "Orders in USD")!;
    expect(table.columns.map((column) => column.header).slice(13, 16)).toEqual(["Order value (received) (USD)", "Rate (INR per 1)", "Order value (received) (INR)"]);
    expect(table.rows[0]!.slice(13, 16)).toEqual([200, 88, 17600]);
    expect(table.total!.slice(13, 16)).toEqual([200, null, 17600]);
    expect(file.sections[0]!.total!.slice(13, 16)).toEqual([1400, null, null]);
  });

  it("summarises per currency from the API's summary, with the INR totals", () => {
    expect(file.sections[2]!.rows).toEqual([
      ["Orders", 2],
      ["Order value (CNY)", 1400],
      ["Settled (CNY)", 800],
      ["Outstanding (CNY)", 600],
      ["Order value (USD)", 200],
      ["Settled (USD)", 0],
      ["Outstanding (USD)", 200],
      ["Dollar cost (USD)", "No USD rate saved for 1 order"],
      ["Paid (INR)", 9850],
      ["Landed cost (INR)", 49550],
    ]);
    expect(file.notes).toEqual([OUTSTANDING_NOTE, DOLLAR_COST_NOTE]);
    const known = orderReportsFile({ ...data, summary: { ...data.summary, dollarCost: { usd: 200, missing: 0 } } }, TODAY);
    expect(known.sections.at(-1)!.rows).toContainEqual(["Dollar cost (USD)", 200]);
  });

  it("keeps one empty CNY table with no total when nothing matches, and says All orders when unfiltered", () => {
    const empty = orderReportsFile({ ...data, rows: [], summary: { orders: 0, byCurrency: [], dollarCost: { usd: 0, missing: 0 }, paidInr: 0, landedCostInr: 0 }, filter: { ...data.filter, supplier: null } }, TODAY);
    expect(empty.filters).toBe("All orders");
    expect(empty.sections[0]).toMatchObject({ title: "Orders in CNY", rows: [], total: undefined });
    expect(empty.sections).toHaveLength(2);
  });
});

// The ledger's FIFO projection: an overpaid order is simply settled (outstanding 0); its extra money is the supplier's
// balance, never a negative outstanding. A held (pending review) or unposted order has no figures and adds nothing.
describe("order reports settlement figures", () => {
  const paid = row({ id: "b", po: "PO-3002", orderValueCny: 800, poValueCny: 800, settledCny: 800, outstandingCny: 0, paymentStatus: "paid", paidInr: 9600 });
  const held = row({ id: "c", po: "PO-3003", orderValueCny: 1000, poValueCny: 1000, held: true, settledCny: null, outstandingCny: null, paymentStatus: null, settledInr: null, paidInr: null, depositStatus: null });
  const file = orderReportsFile({ ...data, rows: [row({ id: "a", po: "PO-3001" }), paid, held] }, TODAY);
  const [cny] = file.sections;
  const at = cny!.columns.findIndex((column) => column.header === "Settled (CNY)");

  it("writes a held order's figures empty with Pending review, and totals only the figures there are", () => {
    expect(cny!.rows.map((cells) => [cells[0], cells[at], cells[at + 1], cells[at + 2], cells[at + 3]])).toEqual([
      ["PO-3001", 800, 600, "Partly paid", 9850],
      ["PO-3002", 800, 0, "Paid", 9600],
      ["PO-3003", null, null, "Pending review", null],
    ]);
    expect(cny!.total!.slice(at, at + 4)).toEqual([1600, 600, null, 19450]);
    // Its PO value is listed but not totalled either, as on the Summary sheet (pre-release audit M3): 1,400 + 800.
    const value = cny!.columns.findIndex((column) => column.header === "Order value (received) (CNY)");
    expect(cny!.rows.map((cells) => cells[value])).toEqual([1400, 800, 1000]);
    expect(cny!.total![value]).toBe(2200);
  });

  it("writes the same figures into the CSV, Excel and PDF files, with no negative outstanding anywhere", () => {
    const lines = toCsv(csvRows(file)).split("\r\n");
    const cellsOf = (start: string) => lines.find((line) => line.startsWith(start))!.split(",");
    expect(cellsOf("PO-3002")[at + 1]).toBe("0");
    expect(cellsOf("Total,3 orders")[at + 1]).toBe("600");
    const xlsx = new TextDecoder().decode(toXlsx(file, "Generated"));
    expect(xlsx).toContain(OUTSTANDING_NOTE);
    const pdf = Array.from(toPdf(file, "Generated"), (byte) => String.fromCharCode(byte)).join("");
    const runs = [...pdf.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((match) => match[1]!);
    expect(runs.filter((run) => /^-\d/.test(run))).toEqual([]);
  });
});
