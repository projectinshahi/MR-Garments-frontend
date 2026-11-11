import { describe, expect, it } from "vitest";

import type { OrderReportRow, OrderReportsResponse } from "@/lib/api/reports-types";

import { orderReportsFile } from "./order-reports-file";

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
});
