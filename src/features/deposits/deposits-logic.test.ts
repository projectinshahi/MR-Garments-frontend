import { describe, expect, it } from "vitest";

import type { DepositsResponse, OrderDeposit, OrderDepositObligation, SupplierStatement } from "@/lib/api/deposits-types";

import {
  amountList,
  amountText,
  EMPTY_FILTERS,
  filterDeposits,
  inView,
  isFiltered,
  statementTotals,
  supplierSummaries,
  toRows,
  totals,
  VIEW_STATUSES,
} from "./deposits-logic";

const api: DepositsResponse = {
  orderDeposits: [
    { id: "p2", orderId: "o2", po: "PO-3002", supplierId: "s2", supplier: "Hangzhou Knits", payee: "Hangzhou Knits", payeeRole: "supplier", currency: "CNY", amountCny: 200, status: "due", paidOn: null, dueDate: "2026-11-30", rateInr: null, amountInr: null, mode: null, reference: "", notes: "" },
    { id: "p1", orderId: "o1", po: "PO-3001", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Sino Freight", payeeRole: "agent", currency: "CNY", amountCny: 300, status: "paid", paidOn: "2026-10-21", dueDate: null, rateInr: 12, amountInr: 3600, mode: "Bank transfer", reference: "UTR 9", notes: "Half\nsecond line" },
  ],
  orderObligations: [],
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
  it("makes one table of both lists: order deposits first, each with its kind, payee, figures, date and link", () => {
    expect(ids(rows)).toEqual(["p2", "p1", "d3", "d2", "d1"]);
    expect(rows[1]).toEqual({
      id: "p1",
      kind: "order",
      supplierId: "s1",
      supplier: "Foshan Fabrics",
      payee: "Sino Freight",
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
      payeeRole: "agent",
    });
    // A due order deposit is pending in full; a supplier deposit's paid is what was settled; a deposit to give is paid to the supplier.
    expect(rows[0]).toMatchObject({ kind: "order", payee: "Hangzhou Knits", paid: 0, pending: 200, date: "2026-11-30", mode: "", status: "due" });
    expect(rows[2]).toMatchObject({ kind: "receive", payee: "", po: null, paid: 100, pending: 400, date: "2026-10-10", status: "partly settled", href: "/deposits/suppliers/s1" });
    expect(rows[4]).toMatchObject({ kind: "give", payee: "Hangzhou Knits" });
  });

  it("gives order rows no link when the user can't open orders; statement links stay", () => {
    const plain = toRows(api, false);
    expect(plain.slice(0, 2).map((row) => row.href)).toEqual([null, null]);
    expect(plain[2]!.href).toBe("/deposits/suppliers/s1");
  });
});

// PO-3003 asked for ¥1,000 and has one ¥300 deposit payment (p3): one obligation row stands for it.
const obligation: OrderDepositObligation = { orderId: "o3", po: "PO-3003", supplierId: "s1", supplier: "Foshan Fabrics", currency: "CNY", requiredCny: 1000, paidCny: 300, pendingCny: 700, status: "partly", lastPaidOn: "2026-11-02", payments: 1 };
const p3: OrderDeposit = { ...api.orderDeposits[1]!, id: "p3", orderId: "o3", po: "PO-3003", payee: "Foshan Fabrics", payeeRole: "supplier", paidOn: "2026-11-02" };
const withObligation = (changes: Partial<OrderDepositObligation> = {}, linkPo = true) =>
  toRows({ ...api, orderDeposits: [p3, ...api.orderDeposits], orderObligations: [{ ...obligation, ...changes }] }, linkPo);

describe("order obligations", () => {
  it("lists an order with a requirement once, as its obligation (required / paid / pending), never as its payments too", () => {
    const rows = withObligation();
    expect(ids(rows)).toEqual(["o3", "p2", "p1", "d3", "d2", "d1"]);
    expect(rows[0]).toEqual({
      id: "o3",
      kind: "order",
      supplierId: "s1",
      supplier: "Foshan Fabrics",
      payee: "Foshan Fabrics",
      po: "PO-3003",
      currency: "CNY",
      amount: 1000,
      paid: 300,
      pending: 700,
      date: "2026-11-02",
      mode: "",
      reference: "",
      notes: "",
      status: "partly paid",
      href: "/orders/PO-3003/payments",
      payments: 1,
    });
    // Nothing paid yet: due, with no date. Everything paid: paid. Without Orders access, no link.
    expect(withObligation({ paidCny: 0, pendingCny: 1000, status: "due", lastPaidOn: null, payments: 0 })[0]).toMatchObject({ status: "due", date: "", paid: 0, pending: 1000, payments: 0 });
    expect(withObligation({ paidCny: 1000, pendingCny: 0, status: "paid", payments: 2 })[0]).toMatchObject({ status: "paid", paid: 1000, pending: 0, payments: 2 });
    expect(withObligation({}, false)[0]!.href).toBeNull();
  });

  it("is pending while something is left and paid once settled; the cards count it once, not its payments again", () => {
    const partly = withObligation();
    expect(ids(partly.filter((r) => inView(r, "pending")))).toEqual(["o3", "p2", "d3", "d1"]);
    expect(ids(partly.filter((r) => inView(r, "paid")))).toEqual(["p1", "d2"]);
    const paid = withObligation({ paidCny: 1000, pendingCny: 0, status: "paid", payments: 2 });
    expect(ids(paid.filter((r) => inView(r, "pending")))).toEqual(["p2", "d3", "d1"]);
    expect(ids(paid.filter((r) => inView(r, "paid")))).toEqual(["o3", "p1", "d2"]);
    // ¥1,000 asked (¥300 paid, ¥700 pending) on top of the base rows' ¥1,500 / ¥300 / ¥1,200; p3's ¥300 is not added again.
    expect(totals(partly).pay).toEqual({
      amount: [
        { currency: "CNY", amount: 2500 },
        { currency: "USD", amount: 200 },
      ],
      paid: [
        { currency: "CNY", amount: 600 },
        { currency: "USD", amount: 200 },
      ],
      pending: [
        { currency: "CNY", amount: 1900 },
        { currency: "USD", amount: 0 },
      ],
      count: 5,
    });
  });
});

describe("inView", () => {
  it("Pending: due order deposits and supplier deposits with something left; Paid: paid and settled ones; All: everything", () => {
    expect(ids(rows.filter((r) => inView(r, "pending")))).toEqual(["p2", "d3", "d1"]);
    expect(ids(rows.filter((r) => inView(r, "paid")))).toEqual(["p1", "d2"]);
    expect(rows.filter((r) => inView(r, "all"))).toHaveLength(5);
    // The Status filter offers each tab only the statuses its rows can have.
    expect(VIEW_STATUSES.pending).toEqual(["due", "partly paid", "open", "partly settled"]);
    expect(VIEW_STATUSES.paid).toEqual(["paid", "settled"]);
    expect(VIEW_STATUSES.all).toEqual(["due", "partly paid", "paid", "open", "partly settled", "settled"]);
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
  it("keeps payables (order deposits and deposits to give) apart from receivables, each figure per currency", () => {
    expect(totals(rows)).toEqual({
      pay: {
        // ¥200 due + ¥300 paid + ¥1,000 to give; $200 to give.
        amount: [
          { currency: "CNY", amount: 1500 },
          { currency: "USD", amount: 200 },
        ],
        paid: [
          { currency: "CNY", amount: 300 },
          { currency: "USD", amount: 200 },
        ],
        pending: [
          { currency: "CNY", amount: 1200 },
          { currency: "USD", amount: 0 },
        ],
        count: 4,
      },
      receive: { amount: [{ currency: "CNY", amount: 500 }], paid: [{ currency: "CNY", amount: 100 }], pending: [{ currency: "CNY", amount: 400 }], count: 1 },
    });
    expect(totals([])).toEqual({ pay: { amount: [], paid: [], pending: [], count: 0 }, receive: { amount: [], paid: [], pending: [], count: 0 } });
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

describe("money text", () => {
  it("shows paise only when there are some, on single amounts and on per-currency lists", () => {
    expect(amountText(1234.5, "CNY")).toBe("¥1,234.50");
    expect(amountText(1000, "USD")).toBe("$1,000");
    expect(amountText(0.01, "INR")).toBe("₹0.01");
    expect(
      amountList([
        { currency: "CNY", amount: 1234.5 },
        { currency: "USD", amount: 0 },
        { currency: "INR", amount: 20 },
      ]),
    ).toBe("¥1,234.50 · ₹20");
    expect(amountList([{ currency: "USD", amount: 0 }])).toBe("$0");
    expect(amountList([])).toBe("¥0");
    expect(amountList([], "INR")).toBe("₹0");
  });
});

describe("agent deposits and older APIs (phase 2 final fixes, 1 and 4)", () => {
  it("keeps a shipping agent's deposit on an order with a requirement as its own row, marked as the agent's, outside the obligation", () => {
    // PO-3003's ¥300 supplier deposit is inside its obligation; a ¥120 agent deposit (sea freight) on the same order stays listed.
    const freight: OrderDeposit = { ...p3, id: "p4", payee: "Sino Freight", payeeRole: "agent", amountCny: 120, amountInr: 1440, paidOn: "2026-11-03" };
    const rows = toRows({ ...api, orderDeposits: [freight, p3, ...api.orderDeposits], orderObligations: [obligation] });
    expect(ids(rows)).toEqual(["o3", "p4", "p2", "p1", "d3", "d2", "d1"]);
    expect(rows[0]).toMatchObject({ amount: 1000, paid: 300, pending: 700, payments: 1 });
    expect(rows[0]!.payeeRole).toBeUndefined();
    expect(rows[1]).toMatchObject({ kind: "order", po: "PO-3003", payee: "Sino Freight", payeeRole: "agent", amount: 120, paid: 120, pending: 0, status: "paid", href: "/orders/PO-3003" });
    expect(rows.find((r) => r.id === "p3")).toBeUndefined();
    expect(rows.find((r) => r.id === "p2")!.payeeRole).toBe("supplier");
    // The cards: the agent's ¥120 is paid once, and the obligation's ¥300 paid / ¥700 pending are not changed by it.
    expect(totals(rows).pay.paid).toContainEqual({ currency: "CNY", amount: 720 });
    expect(totals(rows).pay.pending).toContainEqual({ currency: "CNY", amount: 1900 });
  });

  it("lists every deposit payment as before when an older API sends no orderObligations", () => {
    const rows = toRows({ ...api, orderDeposits: [p3, ...api.orderDeposits], orderObligations: undefined } as unknown as DepositsResponse);
    expect(ids(rows)).toEqual(["p3", "p2", "p1", "d3", "d2", "d1"]);
  });
});
