import { describe, expect, it } from "vitest";

import { lineAmount, orderTotal, parseNumber } from "./order-totals";

// The values drawn in 15_4_New_order.jpeg.
const lines = [
  { rate: 18.5, quantity: 2400 },
  { rate: 6.2, quantity: 2400 },
  { rate: 0.35, quantity: 10000 },
];

describe("order totals", () => {
  it("reproduces the reference: 62,780 total", () => {
    expect(lines.map(lineAmount)).toEqual([44400, 14880, 3500]);
    expect(orderTotal(lines)).toBe(62780);
  });

  it("recalculates when a rate or quantity changes and ignores empty lines", () => {
    const edited = [{ ...lines[0]!, quantity: 3000 }, lines[1]!, lines[2]!, { rate: 0, quantity: 0 }];
    expect(lineAmount(edited[0]!)).toBe(55500);
    expect(orderTotal(edited)).toBe(73880);
  });

  it("parses grouped and empty input", () => {
    expect(parseNumber("10,000")).toBe(10000);
    expect(parseNumber("18.50")).toBe(18.5);
    expect(parseNumber("")).toBe(0);
    expect(parseNumber("abc")).toBe(0);
  });
});
