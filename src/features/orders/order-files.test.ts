import { describe, expect, it } from "vitest";

import type { OrderRow } from "./data/queries";
import { closedOrdersFile, describeFilters, ordersFile, pendingOrdersFile, rangeLabel } from "./order-files";

const TODAY = "2026-11-09";
const row = (po: string, patch: Partial<OrderRow> = {}): OrderRow => ({
  id: po,
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
  paidInr: 0,
  status: "On track",
  tone: "success",
  chip: null,
  ...patch,
});
const headers = (file: { sections: { columns: { header: string }[] }[] }, index = 0) => file.sections[index]!.columns.map((c) => c.header);

describe("orders export files (phase 2 §5, §6)", () => {
  it("All orders: one table, Paid so far in INR, the stage named as the filter does", () => {
    const file = ordersFile([row("PO-2053", { stage: 2, paidInr: 12000 })], "No filters", TODAY);
    expect(file).toMatchObject({ title: "Orders", filename: "orders-2026-11-09", filters: "No filters" });
    expect(headers(file)).toEqual(["PO", "Item", "Supplier", "Quantity", "Unit", "Delivery date", "Stage", "Status", "Paid so far (INR)"]);
    expect(file.sections[0]!.columns[5]).toEqual({ header: "Delivery date", date: true });
    expect(file.sections[0]!.rows).toEqual([["PO-2053", "Denim jeans", "Foshan Fabrics", 100, "pcs", "2026-10-30", "2. Receiving in China", "On track", 12000]]);
  });

  it("Pending: one table per currency with the pending quantity and payment status derived", () => {
    const rows = [
      row("PO-2053", { received: 60, paidCny: 500, supplierPaidCny: 500 }),
      row("PO-2052", { currency: "USD", supplier: "Shenzhen Apparel", quantity: 75, orderValueCny: 2250, paidCny: 2250, supplierPaidCny: 2250 }),
    ];
    const file = pendingOrdersFile(rows, "Supplier: All suppliers", TODAY);
    expect(file).toMatchObject({ title: "Pending orders", filename: "pending-orders-2026-11-09" });
    expect(file.sections).toHaveLength(2);
    expect(headers(file)).toEqual(["PO", "Supplier", "Order date", "Expected delivery", "Ordered qty", "Unit", "Pending qty", "Order value (CNY)", "Payment status", "Current stage"]);
    expect(headers(file, 1)[7]).toBe("Order value (USD)");
    expect(file.sections[0]!.columns[7]).toEqual({ header: "Order value (CNY)", currency: "CNY" });
    expect(file.sections[0]!.rows).toEqual([["PO-2053", "Foshan Fabrics", "2026-10-01", "2026-10-30", 100, "pcs", 40, 1000, "Partly paid", "1. Order and deposit"]]);
    expect(file.sections[1]!.rows).toEqual([["PO-2052", "Shenzhen Apparel", "2026-10-01", "2026-10-30", 75, "pcs", 75, 2250, "Paid", "1. Order and deposit"]]);
  });

  it("Closed: stocked quantity, payments and the balance to the cent; no rows gives one empty CNY table", () => {
    const closed = row("PO-2050", { stage: 6, received: 100, stocked: 100, closed: true, closedOn: "2026-10-20", paidCny: 600.5, supplierPaidCny: 600.5 });
    const file = closedOrdersFile([closed], "Closed date: from 1 Oct 2026", TODAY);
    expect(file).toMatchObject({ title: "Closed orders", filename: "closed-orders-2026-11-09", filters: "Closed date: from 1 Oct 2026" });
    expect(headers(file)).toEqual(["PO", "Supplier", "Order value (CNY)", "Ordered qty", "Unit", "Warehouse received qty", "Paid to supplier (CNY)", "Balance to supplier (CNY)", "Closed date"]);
    expect(file.sections[0]!.rows).toEqual([["PO-2050", "Foshan Fabrics", 1000, 100, "pcs", 100, 600.5, 399.5, "2026-10-20"]]);

    const empty = closedOrdersFile([], "No filters", TODAY);
    expect(empty.sections).toHaveLength(1);
    expect(empty.sections[0]).toMatchObject({ rows: [] });
    expect(headers(empty)[2]).toBe("Order value (CNY)");
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
