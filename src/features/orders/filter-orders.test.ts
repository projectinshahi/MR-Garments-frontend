import { describe, expect, it } from "vitest";

import type { OrderRow } from "./data/queries";
import { filterOrders, isFiltered, type OrderFilters } from "./filter-orders";

const row = (po: string, item: string, supplier: string, stage: OrderRow["stage"], chip: OrderRow["chip"]): OrderRow => ({
  id: po,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-10-30",
  stage,
  supplier,
  item,
  quantity: 100,
  unit: "pcs",
  received: 0,
  orderValueCny: 0,
  paidCny: 0,
  paidInr: 0,
  status: "",
  tone: "success",
  chip,
});
const orders = [
  row("PO-2053", "Cotton denim fabric", "Foshan Fabrics", 1, "dueSoon"),
  row("PO-2052", "Ladies kurtis", "Shenzhen Apparel", 2, "late"),
  row("PO-2051", "Mens jackets", "Shenzhen Apparel", 3, "shortReceived"),
  row("PO-2050", "Denim jeans", "Yiwu Trims Ltd.", 6, null),
];
const none: OrderFilters = { query: "", stage: null, supplier: null, chip: "all" };
const pos = (filters: Partial<OrderFilters>) => filterOrders(orders, { ...none, ...filters }).map((o) => o.po);

describe("filterOrders", () => {
  it("returns every row without filters", () => {
    expect(pos({})).toHaveLength(4);
    expect(isFiltered(none)).toBe(false);
  });

  it("searches PO, item and supplier case-insensitively", () => {
    expect(pos({ query: "po-2052" })).toEqual(["PO-2052"]);
    expect(pos({ query: "Denim" })).toEqual(["PO-2053", "PO-2050"]);
    expect(pos({ query: " yiwu " })).toEqual(["PO-2050"]);
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
    expect(pos({ chip: "completed" })).toEqual(["PO-2050"]);
    expect(isFiltered({ ...none, chip: "late" })).toBe(true);
  });
});
