import { describe, expect, it } from "vitest";

import type { OrderReportRow, OrderReportsResponse } from "@/lib/api/reports-types";

import { orderReportsFile } from "./order-reports-file";

const TODAY = "2026-11-09";
const row = (over: Partial<OrderReportRow>): OrderReportRow => ({
  id: "o1",
  po: "PO-2050",
  orderDate: "2026-10-10",
  deliveryDate: "2026-11-19",
  stage: 6,
  supplier: { id: "s1", name: "Guangzhou Textile Co." },
  currency: "CNY",
  item: "Denim jeans",
  quantity: 100,
  unit: "pcs",
  received: 120,
  stocked: 100,
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
  filter: { po: null, supplier: "Guangzhou Textile Co.", from: null, to: null, status: null, warehouse: null, paymentStatus: null },
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
    expect(cny!.rows).toEqual([["PO-2050", "Guangzhou Textile Co.", "2026-10-10", "Closed", "Denim jeans", 100, "pcs", 120, 100, 1400, 800, 600, "Partly paid", 9850, 49550, 330.33, "2026-11-05"]]);
    expect(cny!.total).toEqual(["Total", "1 order", null, null, null, null, null, null, null, 1400, 800, 600, null, 9850, 49550, null, null]);
    // A pending order due in 10 days reads as the orders list labels it (on track beyond 7 days); no cost yet is an empty cell.
    expect(usd!.rows[0]).toEqual(["PO-2051", "Guangzhou Textile Co.", "2026-10-10", "On track", "Denim jeans", 100, "pcs", 0, 0, 200, 0, 200, "Unpaid", 0, null, null, null]);
    expect(usd!.columns.map((column) => column.header)).toContain("Balance (USD)");
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
