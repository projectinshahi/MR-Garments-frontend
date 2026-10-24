import { describe, expect, it } from "vitest";

import { getNewOrder } from "./data/queries";
import { depositINR, lineAmount, orderTotals, parseNumber } from "./order-totals";

describe("order totals", () => {
  it("reproduces the reference: ¥ 62,780 total, ₹2,49,400 deposits, ¥ 41,280 to pay", async () => {
    const { lines, deposits } = await getNewOrder();
    expect(lines.map(lineAmount)).toEqual([44400, 14880, 3500]);
    expect(deposits.map(depositINR)).toEqual([232000, 17400]);
    expect(orderTotals(lines, deposits)).toEqual({ orderTotal: 62780, depositsPaid: 21500, depositsINR: 249400, balance: 41280 });
  });

  it("recalculates when a rate or quantity changes and ignores empty lines", async () => {
    const { lines, deposits } = await getNewOrder();
    const edited = [{ ...lines[0], quantity: 3000 }, lines[1], lines[2], { rate: 0, quantity: 0 }];
    expect(lineAmount(edited[0])).toBe(55500);
    expect(orderTotals(edited, deposits)).toMatchObject({ orderTotal: 73880, balance: 52380 });
  });

  it("parses grouped and empty input", () => {
    expect(parseNumber("10,000")).toBe(10000);
    expect(parseNumber("18.50")).toBe(18.5);
    expect(parseNumber("")).toBe(0);
    expect(parseNumber("abc")).toBe(0);
  });
});
