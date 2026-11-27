import { describe, expect, it } from "vitest";

import type { ReceiptListItem, ReceiptOptions } from "@/lib/api/types";

import type { ReceiptLine } from "./data/queries";
import {
  ALL,
  deliveryEvents,
  filterReceipts,
  fullyReceived,
  lineStatus,
  paymentEffect,
  receiptSchema,
  receivingKpis,
  remarkRequired,
  SHORT_REMARK,
  toReceiptRow,
} from "./receiving-logic";

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
      currency: "CNY",
      orderValueCny: 72000, poValueCny: 72000,
      outstandingCny: 32000,
      lines: [{ orderLineId: "l1", item: "Men's jackets", unit: "pcs", ordered: 1200, receivedEarlier: 700, unitPriceCny: 60 }],
    },
    { orderId: "o40", po: "PO-2040", supplier: "Foshan Fabrics", currency: "CNY", orderValueCny: 1, poValueCny: 1, outstandingCny: 1, lines: [{ orderLineId: "l9", item: "Cotton fabric", unit: "m", ordered: 10, receivedEarlier: 0, unitPriceCny: 1 }] },
  ],
};

describe("toReceiptRow", () => {
  it("is complete with 0 short once the total reaches the order, over-received above it", () => {
    expect(toReceiptRow(items[1]!)).toMatchObject({ state: "complete", statusLabel: "Complete", short: 0 });
    expect(toReceiptRow({ ...items[1]!, totalSoFar: 1600 })).toMatchObject({ state: "complete", statusLabel: "Over-received 100 pcs", short: 0 });
  });

  it("is partly received below it, short by what is still to receive", () => {
    expect(toReceiptRow(items[0]!)).toMatchObject({ state: "partly", statusLabel: "Partly received", short: 40, thisReceipt: 460, totalSoFar: 1160 });
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
    expect(filterReceipts(rows, { ...all, state: "partly" }).map((r) => r.id)).toEqual(["r3", "r1"]);
    expect(filterReceipts(rows, { ...all, supplier: "Hangzhou Knits" }).map((r) => r.po)).toEqual(["PO-2034"]);
    expect(filterReceipts(rows, { ...all, query: "po-2035" })).toHaveLength(2);
    expect(filterReceipts(rows, { ...all, office: "India office" })).toHaveLength(0);
  });
});

// Owner rule of 2026-11-23: an order is worth its received quantity x rate, so a receipt adds what it receives.
describe("short and the value received", () => {
  const jackets: ReceiptLine = { item: "Men's jackets", unit: "pcs", ordered: 1200, receivedEarlier: 700, receivedNow: 460, unitPrice: 60 };

  it("values what this receipt receives (460 x 60 on 42,000 so far); the 40 short add nothing", () => {
    expect(lineStatus(jackets)).toEqual({ tone: "danger", label: "Short 40 pcs" });
    expect(paymentEffect({ value: 42000 }, [jackets])).toEqual({
      valueBefore: 42000,
      additions: [{ unit: "pcs", quantity: 460, unitPrice: 60, amount: 27600 }],
      added: 27600,
      valueAfter: 69600,
    });
    expect(lineStatus({ ...jackets, receivedNow: 500 })).toEqual({ tone: "success", label: "Complete" });
  });

  it("values an over-receipt in full, is never negative short, and skips unpriced or empty lines", () => {
    const fabric: ReceiptLine = { item: "Cotton fabric", unit: "m", ordered: 360, receivedEarlier: 0, receivedNow: 0, unitPrice: 3 };
    expect([360, 300, 400, 949].map((receivedNow) => lineStatus({ ...fabric, receivedNow }).label)).toEqual(["Complete", "Short 60 m", "Over by 40 m", "Over by 589 m"]);
    // Earlier receipts count: 300 + 100 of 360; a fully received line takes 80 more.
    expect(lineStatus({ ...fabric, receivedEarlier: 300, receivedNow: 100 })).toEqual({ tone: "info", label: "Over by 40 m" });
    expect(lineStatus({ ...fabric, receivedEarlier: 360, receivedNow: 80 }).label).toBe("Over by 80 m");
    expect(lineStatus({ ...fabric, receivedEarlier: 360 }).label).toBe("Complete");
    expect(paymentEffect({ value: 0 }, [{ ...fabric, receivedNow: 949 }, fabric, { ...fabric, unitPrice: undefined, receivedNow: 5 }])).toEqual({
      valueBefore: 0,
      additions: [{ unit: "m", quantity: 949, unitPrice: 3, amount: 2847 }],
      added: 2847,
      valueAfter: 2847,
    });
    // Cents: 3 x 0.335 = 1.005 rounds to 1.01 (the API rounds the same way).
    expect(paymentEffect({ value: 10.1 }, [{ ...fabric, receivedNow: 3, unitPrice: 0.335 }]).valueAfter).toBe(11.11);
  });
});

describe("fullyReceived", () => {
  it("is true once every line has its ordered quantity, also above it", () => {
    const order = options.orders[0]!;
    const line = order.lines[0]!;
    expect(fullyReceived(order)).toBe(false);
    expect(fullyReceived({ ...order, lines: [{ ...line, receivedEarlier: 1200 }] })).toBe(true);
    expect(fullyReceived({ ...order, lines: [{ ...line, receivedEarlier: 1280 }, { ...line, receivedEarlier: 0 }] })).toBe(false);
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

  it("accepts more than was ordered, in one receipt or on top of earlier ones", () => {
    expect(schema.safeParse({ ...valid, lines: [{ orderLineId: "l1", quantity: "501" }] }).success).toBe(true);
    expect(schema.safeParse({ ...valid, lines: [{ orderLineId: "l1", quantity: "949" }] }).success).toBe(true);
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "949" }] })).toBeUndefined();
  });

  it("blocks no quantity, decimals, negatives, text and a future date", () => {
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "-1" }], shortRemark: "x" })).toEqual([["lines.0.quantity", "Enter a whole number."]]);
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "12a" }], shortRemark: "x" })).toContainEqual(["lines.0.quantity", "Enter a whole number."]);
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "" }], shortRemark: "x" })).toEqual([["lines", "Enter what was received for at least one item."]]);
    expect(issues({ ...valid, lines: [{ orderLineId: "l1", quantity: "1.5" }], bundles: "-1", shortRemark: "x" })).toEqual([
      ["bundles", "Enter a whole number."],
      ["lines.0.quantity", "Enter a whole number."],
    ]);
    expect(issues({ ...valid, receivedOn: "2026-10-28" })).toEqual([["receivedOn", "The date can't be after today."]]);
  });

  it("needs a short remark exactly when a line is still short after this receipt", () => {
    const short = { ...valid, lines: [{ orderLineId: "l1", quantity: "460" }] };
    expect(issues(short)).toEqual([["shortRemark", SHORT_REMARK]]);
    expect(issues({ ...short, shortRemark: "   " })).toEqual([["shortRemark", SHORT_REMARK]]);
    expect(schema.safeParse({ ...short, shortRemark: "40 jackets to follow." }).success).toBe(true);
    expect(schema.safeParse({ ...valid, shortRemark: "" }).success).toBe(true);
  });
});

describe("remarkRequired", () => {
  const order: ReceiptOptions["orders"][number] = {
    ...options.orders[0]!,
    lines: [
      { orderLineId: "l1", item: "Men's jackets", unit: "pcs", ordered: 1200, receivedEarlier: 700, unitPriceCny: 60 },
      { orderLineId: "l2", item: "Care labels", unit: "pcs", ordered: 1200, receivedEarlier: 1100, unitPriceCny: 0 },
    ],
  };

  it("counts earlier receipts and this one against the order, over every line", () => {
    expect(remarkRequired(order, [{ orderLineId: "l1", quantity: "500" }, { orderLineId: "l2", quantity: "100" }])).toBe(false);
    expect(remarkRequired(order, [{ orderLineId: "l1", quantity: "500" }, { orderLineId: "l2", quantity: "99" }])).toBe(true);
    expect(remarkRequired(order, [{ orderLineId: "l1", quantity: "500" }, { orderLineId: "l2", quantity: "" }])).toBe(true);
    expect(remarkRequired(order, [{ orderLineId: "l1", quantity: "500" }])).toBe(true);
    expect(remarkRequired(undefined, [])).toBe(false);
  });
});
