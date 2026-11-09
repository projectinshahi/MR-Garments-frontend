import { describe, expect, it } from "vitest";

import type { OrderRow } from "./data/queries";
import {
  balanceCny,
  closedOrders,
  filterOrders,
  filterTabOrders,
  isFiltered,
  type OrderFilters,
  paymentStatus,
  pendingOrders,
  pendingQty,
  type TabFilters,
} from "./filter-orders";

const row = (po: string, item: string, supplier: string, stage: OrderRow["stage"], chip: OrderRow["chip"], patch: Partial<OrderRow> = {}): OrderRow => ({
  id: po,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-10-30",
  stage,
  supplier,
  currency: "CNY",
  item,
  quantity: 100,
  unit: "pcs",
  received: 0,
  stocked: 0,
  closed: false,
  closedOn: null,
  orderValueCny: 0,
  paidCny: 0,
  supplierPaidCny: 0,
  supplierPaidInr: 0,
  paidInr: 0,
  depositRequiredCny: null,
  depositPaidCny: 0,
  depositPendingCny: null,
  depositStatus: "none",
  status: "",
  tone: "success",
  chip,
  ...patch,
});
const orders = [
  row("PO-2053", "Cotton denim fabric", "Foshan Fabrics", 1, "dueSoon", { orderDate: "2026-10-05" }),
  row("PO-2052", "Ladies kurtis", "Shenzhen Apparel", 2, "late"),
  row("PO-2051", "Mens jackets", "Shenzhen Apparel", 3, "shortReceived"),
  row("PO-2050", "Denim jeans", "Yiwu Trims Ltd.", 6, null, { received: 100, stocked: 100, closed: true, closedOn: "2026-10-20" }),
  row("PO-2049", "Denim jeans", "Yiwu Trims Ltd.", 1, null, { orderDate: "2026-09-20" }),
];
const none: OrderFilters = { query: "", stage: null, supplier: null, chip: "all" };
const pos = (filters: Partial<OrderFilters>) => filterOrders(orders, { ...none, ...filters }).map((o) => o.po);

describe("filterOrders", () => {
  it("returns every row without filters", () => {
    expect(pos({})).toHaveLength(5);
    expect(isFiltered(none)).toBe(false);
  });

  it("searches PO, item and supplier case-insensitively", () => {
    expect(pos({ query: "po-2052" })).toEqual(["PO-2052"]);
    expect(pos({ query: "Denim" })).toEqual(["PO-2053", "PO-2050", "PO-2049"]);
    expect(pos({ query: " yiwu " })).toEqual(["PO-2050", "PO-2049"]);
  });

  it("filters by stage and supplier", () => {
    expect(pos({ stage: 2 })).toEqual(["PO-2052"]);
    expect(pos({ supplier: "Shenzhen Apparel" })).toEqual(["PO-2052", "PO-2051"]);
    expect(pos({ stage: 3, supplier: "Shenzhen Apparel" })).toEqual(["PO-2051"]);
  });

  it("filters by chip", () => {
    expect(pos({ chip: "late" })).toEqual(["PO-2052"]);
    expect(pos({ chip: "dueSoon" })).toEqual(["PO-2053"]);
    expect(pos({ chip: "shortReceived" })).toEqual(["PO-2051"]);
    expect(pos({ chip: "closed" })).toEqual(["PO-2050"]);
    // Closed is the closure flag, not stage 6 alone.
    expect(filterOrders([row("PO-1", "x", "y", 6, null)], { ...none, chip: "closed" })).toEqual([]);
    expect(isFiltered({ ...none, chip: "late" })).toBe(true);
  });
});

describe("Pending and Closed tabs (phase 2 §1, §5)", () => {
  it("Pending is stage 1 and Closed is the closed flag, never stage 6 alone", () => {
    expect(pendingOrders(orders).map((o) => o.po)).toEqual(["PO-2053", "PO-2049"]);
    expect(closedOrders(orders).map((o) => o.po)).toEqual(["PO-2050"]);
    expect(closedOrders([row("PO-1", "x", "y", 6, null)])).toEqual([]);
  });

  it("pending quantity never goes below 0; the balance is rounded to the cent", () => {
    expect(pendingQty({ quantity: 100, received: 0 })).toBe(100);
    expect(pendingQty({ quantity: 100, received: 60 })).toBe(40);
    expect(pendingQty({ quantity: 100, received: 130 })).toBe(0);
    expect(balanceCny({ orderValueCny: 44400, supplierPaidCny: 20000.1 })).toBe(24399.9);
    expect(balanceCny({ orderValueCny: 0.3, supplierPaidCny: 0.1 })).toBe(0.2);
  });

  it("payment status: Unpaid at zero, Paid at or over the order value, else Partly paid", () => {
    expect(paymentStatus({ supplierPaidCny: 0, orderValueCny: 1000 })).toEqual({ label: "Unpaid", tone: "neutral" });
    expect(paymentStatus({ supplierPaidCny: 500, orderValueCny: 1000 })).toEqual({ label: "Partly paid", tone: "warning" });
    expect(paymentStatus({ supplierPaidCny: 1000, orderValueCny: 1000 })).toEqual({ label: "Paid", tone: "success" });
    expect(paymentStatus({ supplierPaidCny: 1200, orderValueCny: 1000 })).toMatchObject({ label: "Paid" });
  });

  const open: TabFilters = { query: "", supplier: null, from: "", to: "" };
  const pending = pendingOrders(orders);
  const tab = (filters: Partial<TabFilters>, rows = pending) => filterTabOrders(rows, { ...open, ...filters }, (o) => o.orderDate).map((o) => o.po);

  it("searches and filters by supplier as the All tab does", () => {
    expect(tab({})).toEqual(["PO-2053", "PO-2049"]);
    expect(tab({ query: "COTTON" })).toEqual(["PO-2053"]);
    expect(tab({ supplier: "Yiwu Trims Ltd." })).toEqual(["PO-2049"]);
  });

  it("keeps rows whose date is inside the inclusive range; either end may be open", () => {
    expect(tab({ from: "2026-10-05" })).toEqual(["PO-2053"]);
    expect(tab({ to: "2026-10-04" })).toEqual(["PO-2049"]);
    expect(tab({ from: "2026-09-20", to: "2026-09-20" })).toEqual(["PO-2049"]);
    expect(tab({ from: "2026-10-06", to: "2026-10-31" })).toEqual([]);
  });

  it("a missing date (closedOn of an open order) is outside any bound but passes an open range", () => {
    const byClosed = (filters: Partial<TabFilters>) => filterTabOrders(orders, { ...open, ...filters }, (o) => o.closedOn).map((o) => o.po);
    expect(byClosed({ from: "2026-01-01" })).toEqual(["PO-2050"]);
    expect(byClosed({})).toHaveLength(5);
  });
});
