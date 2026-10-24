import { describe, expect, it } from "vitest";

import { getOrdersList } from "./data/queries";
import { filterOrders, isFiltered, type OrderFilters } from "./filter-orders";

const none: OrderFilters = { query: "", stage: null, supplier: null, chip: "all" };
const pos = async (filters: Partial<OrderFilters>) => {
  const { orders } = await getOrdersList();
  return filterOrders(orders, { ...none, ...filters }).map((o) => o.po);
};

describe("getOrdersList", () => {
  it("loads the 10 rows of page 1, marks only PO-2028 as having a detail view, and adds unknown suppliers", async () => {
    const { orders, supplierNames } = await getOrdersList();
    expect(orders).toHaveLength(10);
    expect(orders.filter((o) => o.hasDetail).map((o) => o.po)).toEqual(["PO-2028"]);
    expect(supplierNames).toContain("Hangzhou Silk House");
    expect(new Set(supplierNames).size).toBe(supplierNames.length);
  });
});

describe("filterOrders", () => {
  it("returns every row without filters", async () => {
    expect(await pos({})).toHaveLength(10);
    expect(isFiltered(none)).toBe(false);
  });

  it("searches PO, item and supplier case-insensitively", async () => {
    expect(await pos({ query: "po-2028" })).toEqual(["PO-2028"]);
    expect(await pos({ query: "Denim" })).toEqual(["PO-2049", "PO-2028"]);
    expect(await pos({ query: " yiwu " })).toEqual(["PO-2038"]);
  });

  it("filters by stage and supplier", async () => {
    expect(await pos({ stage: 2 })).toEqual(["PO-2044", "PO-2041", "PO-2038"]);
    expect(await pos({ supplier: "Shenzhen Apparel" })).toEqual(["PO-2044", "PO-2035", "PO-2019"]);
    expect(await pos({ stage: 3, supplier: "Foshan Fabrics" })).toEqual(["PO-2031"]);
  });

  it("filters by chip", async () => {
    expect(await pos({ chip: "late" })).toEqual(["PO-2044", "PO-2041", "PO-2038"]);
    expect(await pos({ chip: "dueSoon" })).toEqual(["PO-2049", "PO-2047"]);
    expect(await pos({ chip: "shortReceived" })).toEqual(["PO-2035"]);
    expect(await pos({ chip: "completed" })).toEqual(["PO-2019"]);
    expect(isFiltered({ ...none, chip: "late" })).toBe(true);
  });
});
