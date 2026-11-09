import { describe, expect, it } from "vitest";

import type { DepositsResponse, SupplierStatement } from "@/lib/api/deposits-types";

import {
  amountText,
  EMPTY_FILTERS,
  filterDeposits,
  inView,
  isFiltered,
  statementTotals,
  supplierSummaries,
  toRows,
  totals,
  trimNotes,
} from "./deposits-logic";

const api: DepositsResponse = {
  orderDeposits: [
    { id: "p2", orderId: "o2", po: "PO-3002", supplierId: "s2", supplier: "Hangzhou Knits", currency: "CNY", amountCny: 200, status: "due", paidOn: null, dueDate: "2026-11-30", rateInr: null, amountInr: null, mode: null, reference: "", notes: "" },
    { id: "p1", orderId: "o1", po: "PO-3001", supplierId: "s1", supplier: "Foshan Fabrics", currency: "CNY", amountCny: 300, status: "paid", paidOn: "2026-10-21", dueDate: null, rateInr: 12, amountInr: 3600, mode: "Bank transfer", reference: "UTR 9", notes: "Half\nsecond line" },
  ],
  supplierDeposits: [
    { id: "d3", supplierId: "s1", supplier: "Foshan Fabrics", direction: "receive", currency: "CNY", amount: 500, settled: 100, pending: 400, status: "partly settled", openedOn: "2026-10-10", reference: "Mould", notes: "", transactions: 1 },
    { id: "d2", supplierId: "s1", supplier: "Foshan Fabrics", direction: "give", currency: "USD", amount: 200, settled: 200, pending: 0, status: "settled", openedOn: "2026-10-05", reference: "", notes: "", transactions: 2 },
    { id: "d1", supplierId: "s2", supplier: "Hangzhou Knits", direction: "give", currency: "CNY", amount: 1000, settled: 0, pending: 1000, status: "open", openedOn: "2026-10-01", reference: "", notes: "", transactions: 0 },
  ],
  suppliers: [
    { id: "s1", name: "Foshan Fabrics" },
    { id: "s2", name: "Hangzhou Knits" },
  ],
};
const rows = toRows(api);
const ids = (list: { id: string }[]) => list.map((row) => row.id);

describe("toRows", () => {
  it("makes one table of both lists: order deposits first, each with its kind, figures, date and link", () => {
    expect(ids(rows)).toEqual(["p2", "p1", "d3", "d2", "d1"]);
    expect(rows[1]).toEqual({
      id: "p1",
      kind: "order",
      supplierId: "s1",
      supplier: "Foshan Fabrics",
      po: "PO-3001",
      currency: "CNY",
      amount: 300,
      paid: 300,
      pending: 0,
      date: "2026-10-21",
      mode: "Bank transfer",
      reference: "UTR 9",
      notes: "Half\nsecond line",
      status: "paid",
      href: "/orders/PO-3001",
    });
    // A due order deposit is pending in full; a supplier deposit's paid is what was settled.
    expect(rows[0]).toMatchObject({ kind: "order", paid: 0, pending: 200, date: "2026-11-30", mode: "", status: "due" });
    expect(rows[2]).toMatchObject({ kind: "receive", po: null, paid: 100, pending: 400, date: "2026-10-10", status: "partly settled", href: "/deposits/suppliers/s1" });
  });
});

describe("inView", () => {
  it("Pending: due order deposits and supplier deposits with something left; Paid: paid and settled ones; All: everything", () => {
    expect(ids(rows.filter((r) => inView(r, "pending")))).toEqual(["p2", "d3", "d1"]);
    expect(ids(rows.filter((r) => inView(r, "paid")))).toEqual(["p1", "d2"]);
    expect(rows.filter((r) => inView(r, "all"))).toHaveLength(5);
  });
});

describe("filterDeposits", () => {
  it("filters by supplier, PO (contains, any case), date range, status, currency and kind together", () => {
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, supplierId: "s1" }))).toEqual(["p1", "d3", "d2"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, po: "po-300" }))).toEqual(["p2", "p1"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, po: "3002" }))).toEqual(["p2"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, from: "2026-10-05", to: "2026-10-21" }))).toEqual(["p1", "d3", "d2"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, to: "2026-10-01" }))).toEqual(["d1"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, status: "open" }))).toEqual(["d1"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, currency: "USD" }))).toEqual(["d2"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, kind: "give" }))).toEqual(["d2", "d1"]);
    expect(ids(filterDeposits(rows, { ...EMPTY_FILTERS, kind: "order", supplierId: "s2" }))).toEqual(["p2"]);
    expect(filterDeposits(rows, EMPTY_FILTERS)).toHaveLength(5);
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, po: "x" })).toBe(true);
  });
});

describe("totals", () => {
  it("adds each figure per currency, never across currencies, from the rows given", () => {
    expect(totals(rows)).toEqual({
      amount: [
        { currency: "CNY", amount: 2000 },
        { currency: "USD", amount: 200 },
      ],
      paid: [
        { currency: "CNY", amount: 400 },
        { currency: "USD", amount: 200 },
      ],
      pending: [
        { currency: "CNY", amount: 1600 },
        { currency: "USD", amount: 0 },
      ],
      count: 5,
    });
    expect(totals([])).toEqual({ amount: [], paid: [], pending: [], count: 0 });
  });
});

describe("supplierSummaries", () => {
  it("has one line per supplier with supplier deposits, give and receive apart, by name; order deposits don't count", () => {
    const summaries = supplierSummaries(rows);
    expect(summaries.map((s) => s.supplier)).toEqual(["Foshan Fabrics", "Hangzhou Knits"]);
    expect(summaries[0]).toEqual({
      supplierId: "s1",
      supplier: "Foshan Fabrics",
      give: { amount: [{ currency: "USD", amount: 200 }], paid: [{ currency: "USD", amount: 200 }], pending: [{ currency: "USD", amount: 0 }], count: 1 },
      receive: { amount: [{ currency: "CNY", amount: 500 }], paid: [{ currency: "CNY", amount: 100 }], pending: [{ currency: "CNY", amount: 400 }], count: 1 },
      href: "/deposits/suppliers/s1",
    });
    expect(summaries[1]!.receive).toEqual({ amount: [], paid: [], pending: [], count: 0 });
    expect(supplierSummaries(rows.filter((r) => r.kind === "order"))).toEqual([]);
  });
});

describe("statementTotals", () => {
  it("turns SD-1's summary lines into one direction's three figures per currency, CNY first", () => {
    const summary: SupplierStatement["summary"] = [
      { currency: "USD", direction: "give", amount: 200, settled: 0, pending: 200 },
      { currency: "CNY", direction: "give", amount: 1000, settled: 300, pending: 700 },
      { currency: "CNY", direction: "receive", amount: 500, settled: 100, pending: 400 },
    ];
    expect(statementTotals(summary, "give")).toEqual({
      amount: [
        { currency: "CNY", amount: 1000 },
        { currency: "USD", amount: 200 },
      ],
      paid: [
        { currency: "CNY", amount: 300 },
        { currency: "USD", amount: 0 },
      ],
      pending: [
        { currency: "CNY", amount: 700 },
        { currency: "USD", amount: 200 },
      ],
    });
    expect(statementTotals(summary, "receive").amount).toEqual([{ currency: "CNY", amount: 500 }]);
    expect(statementTotals([], "receive")).toEqual({ amount: [], paid: [], pending: [] });
  });
});

describe("text helpers", () => {
  it("shows paise only when there are some, and trims notes to one short line", () => {
    expect(amountText(1234.5, "CNY")).toBe("¥1,234.50");
    expect(amountText(1000, "USD")).toBe("$1,000");
    expect(amountText(0.01, "INR")).toBe("₹0.01");
    expect(trimNotes("Half\nsecond line")).toBe("Half");
    expect(trimNotes("x".repeat(50), 10)).toBe("xxxxxxxxx…");
    expect(trimNotes("  short  ")).toBe("short");
  });
});
