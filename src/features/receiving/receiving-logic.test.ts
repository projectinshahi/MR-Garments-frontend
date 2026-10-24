import { describe, expect, it } from "vitest";

import { getReceivingList, getRecordReceipt } from "./data/queries";
import { ALL, filterReceipts, lineShort, paymentEffect } from "./receiving-logic";

describe("short and balance", () => {
  it("reproduces the reference: 40 pcs short, balance ¥29,600", async () => {
    const { lines, payment } = await getRecordReceipt();
    expect(lines.map(lineShort)).toEqual([40, 0]);
    expect(paymentEffect(payment, lines)).toEqual({
      balanceBefore: 32000,
      deductions: [{ unit: "pcs", short: 40, unitPrice: 60, amount: 2400 }],
      balanceNow: 29600,
    });
  });

  it("updates when more is received and never goes below zero short", async () => {
    const { lines, payment } = await getRecordReceipt();
    const jackets = { ...lines[0], receivedNow: 480 };
    expect(lineShort(jackets)).toBe(20);
    expect(paymentEffect(payment, [jackets, lines[1]]).balanceNow).toBe(30800);
    expect(lineShort({ ...jackets, receivedNow: 600 })).toBe(0);
  });
});

describe("filterReceipts", () => {
  const all = { query: "", office: ALL, supplier: ALL, state: ALL } as const;

  it("filters by status chip, supplier and search", async () => {
    const { receipts } = await getReceivingList();
    expect(filterReceipts(receipts, all)).toHaveLength(9);
    expect(filterReceipts(receipts, { ...all, state: "short" }).map((r) => r.po)).toEqual(["PO-2035", "PO-2027"]);
    expect(filterReceipts(receipts, { ...all, state: "partly" })).toHaveLength(1);
    expect(filterReceipts(receipts, { ...all, supplier: "Hangzhou Knits" }).map((r) => r.po)).toEqual(["PO-2033", "PO-2030"]);
    expect(filterReceipts(receipts, { ...all, query: "foshan" }).map((r) => r.po)).toEqual(["PO-2027"]);
    expect(filterReceipts(receipts, { ...all, query: "po-2035" })).toHaveLength(2);
    expect(filterReceipts(receipts, { ...all, office: "India office" })).toHaveLength(0);
  });
});
