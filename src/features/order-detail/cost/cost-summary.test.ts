import { describe, expect, it } from "vitest";

import { summarizeCost } from "./cost-summary";
import { getOrderCost } from "./data/queries";

describe("summarizeCost", () => {
  it("reproduces the PO-2028 cost tab figures", async () => {
    const cost = await getOrderCost("PO-2028");
    if (!cost) throw new Error("PO-2028 fixture missing");
    const summary = summarizeCost(cost);

    expect(summary.total).toBe(1_377_000);
    expect(summary.perPiece).toBeCloseTo(550.8);
    expect(summary.groups.map((g) => g.value)).toEqual([980_000, 370_500, 26_500]);
    expect(summary.groups.map((g) => g.percent)).toEqual([71, 27, 2]);
    expect(summary.groups.map((g) => g.perPiece)).toEqual([392, 148.2, 10.6]);
  });
});
