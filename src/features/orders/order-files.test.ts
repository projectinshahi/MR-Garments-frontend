import { describe, expect, it } from "vitest";

import type { OrderLineItem } from "@/lib/api/types";

import type { OrderRow } from "./data/queries";
import { closedOrdersFile, describeFilters, ordersFile, pendingOrdersFile, rangeLabel } from "./order-files";

const TODAY = "2026-11-09";
const row = (po: string, patch: Partial<OrderRow> = {}): OrderRow => ({
  id: po,
  exchangeRate: null,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-10-30",
  stage: 1,
  supplier: "Foshan Fabrics",
  currency: "CNY",
  item: "Denim jeans",
  quantity: 100,
  unit: "pcs",
  received: 0,
  stocked: 0,
  closed: false,
  closedOn: null,
  orderValueCny: 1000,
  paidCny: 0,
  supplierPaidCny: 0,
  supplierPaidInr: 0,
  paidInr: 0,
  depositRequiredCny: null,
  depositPaidCny: 0,
  depositPendingCny: null,
  depositStatus: "none",
  status: "On track",
  tone: "success",
  chip: null,
  ...patch,
});
const headers = (file: { sections: { columns: { header: string }[] }[] }, index = 0) => file.sections[index]!.columns.map((c) => c.header);

const line = (orderId: string, po: string, patch: Partial<OrderLineItem> = {}): OrderLineItem => ({
  orderId,
  po,
  currency: "CNY",
  position: 0,
  item: "Denim jeans",
  unit: "pcs",
  quantity: 100,
  rateCny: 10,
  valueCny: 1000,
  received: 0,
  stocked: 0,
  ...patch,
});

describe("orders report files (phase 2 §5, §6; docs/report-downloads.md)", () => {
  it("All orders: a summary, then per currency the saved rate, PO total, supplier payments, balance and INR paid, with totals", () => {
    const rows = [
      row("PO-2053", { stage: 2, exchangeRate: 12.0412, paidCny: 400, supplierPaidCny: 300, paidInr: 4812.36 }),
      row("PO-2052", { currency: "USD", supplier: "Shenzhen Apparel", orderValueCny: 2250, exchangeRate: 83.1, supplierPaidCny: 2250, paidInr: 186975 }),
    ];
    const file = ordersFile(rows, "No filters", TODAY);
    expect(file).toMatchObject({ title: "Orders", filename: "orders-2026-11-09", filters: "No filters" });
    const [summary, cny, usd] = file.sections;
    expect(summary).toMatchObject({ sheet: "Summary", csv: false });
    expect(summary!.rows).toEqual([
      ["Orders", 2],
      ["PO value", "CNY 1,000.00 · USD 2,250.00"],
      ["Paid to supplier", "CNY 300.00 · USD 2,250.00"],
      ["Balance to supplier", "CNY 700.00 · USD 0.00"],
      ["Paid, all payees (INR)", 191787.36],
    ]);
    expect(headers(file, 1)).toEqual([
      "PO", "Order date", "Supplier", "Currency", "Exchange rate (INR per 1 CNY)", "Main item", "Ordered qty", "Unit", "Delivery date", "Stage", "Status",
      "PO total (CNY)", "Paid to supplier (CNY)", "Balance (CNY)", "Paid, all payees (INR)",
    ]);
    expect(cny!.columns[4]).toEqual({ header: "Exchange rate (INR per 1 CNY)", rate: true });
    // The rate saved on the order (never the supplier's rate now); the balance counts supplier payments only.
    expect(cny!.rows).toEqual([["PO-2053", "2026-10-01", "Foshan Fabrics", "CNY", 12.0412, "Denim jeans", 100, "pcs", "2026-10-30", "2. Receiving in China", "On track", 1000, 300, 700, 4812.36]]);
    expect(cny!.total).toEqual(["Total", null, null, null, null, null, null, null, null, null, null, 1000, 300, 700, 4812.36]);
    expect(headers(file, 2)[11]).toBe("PO total (USD)");
    expect(usd!.rows[0]!.slice(0, 5)).toEqual(["PO-2052", "2026-10-01", "Shenzhen Apparel", "USD", 83.1]);
    // Without ORD-7 the file says the items sheet is missing instead of leaving it out silently.
    expect(file.notes!.at(-1)).toMatch(/order items could not be loaded/);
  });

  it("adds the Order Items sheet: every line of the exported orders only, with its saved rate, per currency", () => {
    const rows = [row("PO-2053"), row("PO-2052", { id: "o-usd", po: "PO-2052", currency: "USD" })];
    const lines = [
      line("PO-2053", "PO-2053", { rateCny: 12.5, valueCny: 1250, received: 60 }),
      line("PO-2053", "PO-2053", { position: 1, item: "Cotton fabric", unit: "m", quantity: 40, rateCny: 5, valueCny: 200, received: 50, stocked: 30 }),
      line("o-usd", "PO-2052", { currency: "USD", rateCny: 3, valueCny: 300 }),
      line("not-exported", "PO-9999"),
    ];
    const file = ordersFile(rows, "No filters", TODAY, lines);
    const items = file.sections.filter((s) => s.sheet === "Order Items");
    expect(items.map((s) => s.title)).toEqual(["Order items (CNY)", "Order items (USD)"]);
    expect(items[0]!.columns.map((c) => c.header)).toEqual([
      "PO", "Supplier", "Line", "Item", "Unit", "Ordered qty", "Saved rate (CNY)", "Amount (CNY)", "Received in China", "Pending in China", "Stocked in India",
    ]);
    expect(items[0]!.rows).toEqual([
      ["PO-2053", "Foshan Fabrics", 1, "Denim jeans", "pcs", 100, 12.5, 1250, 60, 40, 0],
      // Excess received never shows a negative pending.
      ["PO-2053", "Foshan Fabrics", 2, "Cotton fabric", "m", 40, 5, 200, 50, 0, 30],
    ]);
    expect(items[1]!.rows).toEqual([["PO-2052", "Foshan Fabrics", 1, "Denim jeans", "pcs", 100, 3, 300, 0, 100, 0]]);
    expect(file.notes!.join(" ")).not.toMatch(/could not be loaded/);
  });

  it("Pending: ordered, received and pending quantities, value, supplier payments, balance and payment status per currency", () => {
    const rows = [
      row("PO-2053", { received: 60, paidCny: 500, supplierPaidCny: 500 }),
      row("PO-2052", { currency: "USD", supplier: "Shenzhen Apparel", quantity: 75, orderValueCny: 2250, paidCny: 2250, supplierPaidCny: 2250 }),
    ];
    const file = pendingOrdersFile(rows, "Supplier: All suppliers", TODAY);
    expect(file).toMatchObject({ title: "Pending orders", filename: "pending-orders-2026-11-09" });
    expect(file.sections.map((s) => s.title)).toEqual(["Summary", "Pending orders (CNY)", "Pending orders (USD)"]);
    expect(headers(file, 1)).toEqual([
      "PO", "Supplier", "Order date", "Expected delivery", "Main item", "Ordered qty", "Received qty", "Pending qty", "Unit",
      "Order value (CNY)", "Paid to supplier (CNY)", "Balance (CNY)", "Payment status", "Current stage",
    ]);
    expect(file.sections[1]!.rows).toEqual([["PO-2053", "Foshan Fabrics", "2026-10-01", "2026-10-30", "Denim jeans", 100, 60, 40, "pcs", 1000, 500, 500, "Partly paid", "1. Order and deposit"]]);
    expect(file.sections[2]!.rows).toEqual([["PO-2052", "Shenzhen Apparel", "2026-10-01", "2026-10-30", "Denim jeans", 75, 0, 75, "pcs", 2250, 2250, 0, "Paid", "1. Order and deposit"]]);
  });

  it("Closed: closing date, item count, stocked quantity, payments and the final balance to the cent; no rows gives one empty CNY table", () => {
    const closed = row("PO-2050", { stage: 6, received: 100, stocked: 100, closed: true, closedOn: "2026-10-20", paidCny: 600.5, supplierPaidCny: 600.5, paidInr: 7206, status: "Closed" });
    const file = closedOrdersFile([closed], "Closed date: from 1 Oct 2026", TODAY, [line("PO-2050", "PO-2050"), line("PO-2050", "PO-2050", { position: 1 })]);
    expect(file).toMatchObject({ title: "Closed orders", filename: "closed-orders-2026-11-09", filters: "Closed date: from 1 Oct 2026" });
    expect(headers(file, 1)).toEqual([
      "PO", "Supplier", "Order date", "Closed date", "Items", "Main item", "Ordered qty", "Warehouse received qty", "Unit",
      "Order value (CNY)", "Paid to supplier (CNY)", "Balance to supplier (CNY)", "Paid, all payees (INR)", "Final status",
    ]);
    expect(file.sections[1]!.rows).toEqual([["PO-2050", "Foshan Fabrics", "2026-10-01", "2026-10-20", 2, "Denim jeans", 100, 100, "pcs", 1000, 600.5, 399.5, 7206, "Closed"]]);

    const empty = closedOrdersFile([], "No filters", TODAY);
    expect(empty.sections.filter((s) => s.sheet === "Closed Orders")).toHaveLength(1);
    expect(empty.sections[1]).toMatchObject({ rows: [], total: undefined });
    expect(headers(empty, 1)[9]).toBe("Order value (CNY)");
  });

  it("spells out the filters in force", () => {
    expect(describeFilters([])).toBe("No filters");
    expect(describeFilters(["", null, false, "Supplier: Foshan Fabrics"])).toBe("Supplier: Foshan Fabrics");
    expect(describeFilters(['Search: "denim"', "Stage: 1. Order and deposit"])).toBe('Search: "denim" · Stage: 1. Order and deposit');
    expect(rangeLabel("Order date", "", "")).toBeNull();
    expect(rangeLabel("Order date", "2026-10-01", "")).toBe("Order date: from 1 Oct 2026");
    expect(rangeLabel("Order date", "", "2026-10-31")).toBe("Order date: to 31 Oct 2026");
    expect(rangeLabel("Closed date", "2026-10-01", "2026-10-31")).toBe("Closed date: 1 Oct 2026 to 31 Oct 2026");
  });
});
