import { describe, expect, it } from "vitest";

import { filterOrders, filterPayments } from "./filter-orders";
import { paymentOrder, paymentRow } from "./test-fixtures";

const rows = [paymentOrder("PO-2049", { supplier: "Foshan Fabrics" }), paymentOrder("PO-2047", { supplier: "Guangzhou Textile Co." }), paymentOrder("PO-2041", { supplier: "Guangzhou Textile Co." })];

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

describe("filterPayments", () => {
  const payments = [paymentRow("p1", { reference: "UTR 77" }), paymentRow("p2", { po: "PO-2049", payeeRole: "agent", payee: "Sino Freight" }), paymentRow("p3", { supplier: "Foshan Fabrics" })];
  it("matches an orderless payment by supplier or reference, and an order's by PO or payee", () => {
    expect(filterPayments(payments, "")).toBe(payments);
    expect(filterPayments(payments, "utr 77").map((p) => p.id)).toEqual(["p1"]);
    expect(filterPayments(payments, "po-2049").map((p) => p.id)).toEqual(["p2"]);
    expect(filterPayments(payments, "sino").map((p) => p.id)).toEqual(["p2"]);
    expect(filterPayments(payments, "foshan").map((p) => p.id)).toEqual(["p3"]);
  });
});
