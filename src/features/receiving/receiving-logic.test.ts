import { describe, expect, it } from "vitest";

import type { ReceiptListItem, ReceiptOptions } from "@/lib/api/types";

import type { ReceiptLine } from "./data/queries";
import { ALL, deliveryEvents, filterReceipts, lineShort, paymentEffect, receiptSchema, receivingKpis, toReceiptRow } from "./receiving-logic";

const rec = (r: Partial<ReceiptListItem> & Pick<ReceiptListItem, "id" | "orderId" | "po">): ReceiptListItem => ({
  receivedOn: "2026-10-20",
  supplier: "Shenzhen Apparel",
  item: "Men's jackets",
  office: "Guangzhou office",
  ordered: 1200,
  unit: "pcs",
  thisReceipt: 700,
  totalSoFar: 700,
  bundles: 14,
  receivedBy: "Wang Fang",
  ...r,
});

const items: ReceiptListItem[] = [
  rec({ id: "r3", orderId: "o35", po: "PO-2035", receivedOn: "2026-10-24", thisReceipt: 460, totalSoFar: 1160, bundles: 9, receivedBy: "Chen Yu" }),
  rec({ id: "r2", orderId: "o34", po: "PO-2034", receivedOn: "2026-10-02", supplier: "Hangzhou Knits", ordered: 1500, thisReceipt: 1500, totalSoFar: 1500 }),
  rec({ id: "r1", orderId: "o35", po: "PO-2035", receivedOn: "2026-09-18" }),
];

const options: ReceiptOptions = {
  offices: [{ id: "loc-gz", name: "Guangzhou office" }],
  orders: [
    {
      orderId: "o35",
      po: "PO-2035",
      supplier: "Shenzhen Apparel",
      orderValueCny: 72000,
      depositsPaidCny: 40000,
      lines: [{ orderLineId: "l1", item: "Men's jackets", unit: "pcs", ordered: 1200, receivedEarlier: 700, unitPriceCny: 60 }],
    },
    { orderId: "o40", po: "PO-2040", supplier: "Foshan Fabrics", orderValueCny: 1, depositsPaidCny: 0, lines: [{ orderLineId: "l9", item: "Cotton fabric", unit: "m", ordered: 10, receivedEarlier: 0, unitPriceCny: 1 }] },
  ],
};

describe("toReceiptRow", () => {
  it("is complete with 0 short once the total reaches the order", () => {
    expect(toReceiptRow(items[1]!)).toMatchObject({ state: "complete", statusLabel: "Complete", short: 0 });
    expect(toReceiptRow({ ...items[1]!, totalSoFar: 1600 })).toMatchObject({ state: "complete", short: 0 });
  });

  it("is partly received with Short not counted (–) below it, never short", () => {
    expect(toReceiptRow(items[0]!)).toMatchObject({ state: "partly", statusLabel: "Partly received", short: null, thisReceipt: 460, totalSoFar: 1160 });
  });
});

describe("receivingKpis", () => {
  it("counts this month's receipts and suppliers, partly received orders and orders waiting", () => {
    expect(receivingKpis(items, options, "2026-10-27")).toEqual({
      month: "October",
      receiptsThisMonth: 2,
      receiptsSupplierCount: 2,
      waitingToBeReceived: 1,
      partlyReceived: 1,
      partlyReceivedPos: ["PO-2035"],
    });
    expect(receivingKpis([], null, "2026-11-01")).toMatchObject({ month: "November", receiptsThisMonth: 0, waitingToBeReceived: null, partlyReceived: 0 });
  });
});

describe("filterReceipts", () => {
  const all = { query: "", office: ALL, supplier: ALL, state: ALL } as const;
  const rows = items.map(toReceiptRow);

  it("filters by status chip, supplier, office and search", () => {
    expect(filterReceipts(rows, all)).toHaveLength(3);
    expect(filterReceipts(rows, { ...all, state: "short" })).toHaveLength(0);
    expect(filterReceipts(rows, { ...all, state: "partly" }).map((r) => r.id)).toEqual(["r3", "r1"]);
    expect(filterReceipts(rows, { ...all, supplier: "Hangzhou Knits" }).map((r) => r.po)).toEqual(["PO-2034"]);
    expect(filterReceipts(rows, { ...all, query: "po-2035" })).toHaveLength(2);
    expect(filterReceipts(rows, { ...all, office: "India office" })).toHaveLength(0);
  });
});

describe("short and balance", () => {
  const jackets: ReceiptLine = { item: "Men's jackets", unit: "pcs", ordered: 1200, receivedEarlier: 700, receivedNow: 460, unitPrice: 60 };

  it("reproduces the reference: 40 pcs short, balance ¥29,600", () => {
    expect(lineShort(jackets)).toBe(40);
    expect(paymentEffect({ orderValue: 72000, depositsPaid: 40000 }, [jackets])).toEqual({
      balanceBefore: 32000,
      deductions: [{ unit: "pcs", short: 40, unitPrice: 60, amount: 2400 }],
      balanceNow: 29600,
    });
    expect(lineShort({ ...jackets, receivedNow: 600 })).toBe(0);
  });
});

describe("deliveryEvents", () => {
  it("lists the order's receipts oldest first and the total so far", () => {
    expect(deliveryEvents(items, "o35")).toEqual([
      { title: "18 Sep · Guangzhou office", lines: ["700 pcs Men's jackets in 14 bundles", "Received by Wang Fang"], marker: "ring" },
      { title: "24 Oct · Guangzhou office", lines: ["460 pcs Men's jackets in 9 bundles", "Received by Chen Yu"], marker: "ring" },
      { title: "Total so far", lines: ["1,160 of 1,200 pcs", "23 bundles"], marker: "ring" },
    ]);
    expect(deliveryEvents(items, "o40")).toEqual([]);
  });
});

describe("receiptSchema", () => {
  const schema = receiptSchema(options, "2026-10-27");
  const valid = {
    orderId: "o35",
    receivedOn: "2026-10-27",
    locationId: "loc-gz",
    bundles: "9",
    deliveryNote: "",
    shortRemark: "",
    lines: [{ orderLineId: "l1", quantity: "500" }],
  };
  const issues = (values: object) => schema.safeParse(values).error?.issues.map((i) => [i.path.join("."), i.message]);

  it("accepts a receipt up to what is left", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("blocks over-receipt, no quantity, decimals and a future date", () => {
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "501" }] })).toEqual([["lines.0.quantity", "Only 500 pcs left to receive."]]);
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "" }] })).toEqual([["lines", "Enter what was received for at least one item."]]);
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "1.5" }], bundles: "-1" })).toEqual([
      ["bundles", "Enter a whole number."],
      ["lines.0.quantity", "Enter a whole number."],
    ]);
    expect(issues({ ...valid, receivedOn: "2026-10-28" })).toEqual([["receivedOn", "The date can't be after today."]]);
  });
});
