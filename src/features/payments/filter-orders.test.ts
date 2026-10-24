import { describe, expect, it } from "vitest";

import type { OrderPaymentRow } from "./data/queries";
import { filterOrders } from "./filter-orders";

const row = (po: string, supplier: string): OrderPaymentRow => ({
  po,
  supplier,
  orderValue: 0,
  paid: 0,
  paidInr: 0,
  balance: 0,
  nextDue: null,
});

const rows = [row("PO-2049", "Foshan Fabrics"), row("PO-2047", "Guangzhou Textile Co."), row("PO-2041", "Guangzhou Textile Co.")];

describe("filterOrders", () => {
  it("returns every row for an empty or blank query", () => {
    expect(filterOrders(rows, "")).toBe(rows);
    expect(filterOrders(rows, "   ")).toBe(rows);
  });

  it("matches the PO number or the supplier, ignoring case", () => {
    expect(filterOrders(rows, "po-2041").map((r) => r.po)).toEqual(["PO-2041"]);
    expect(filterOrders(rows, " guangzhou ").map((r) => r.po)).toEqual(["PO-2047", "PO-2041"]);
    expect(filterOrders(rows, "trims")).toEqual([]);
  });
});
