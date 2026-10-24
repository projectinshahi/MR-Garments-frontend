import { describe, expect, it } from "vitest";

import { formatINR, formatRate } from "@/lib/formatters";

import { convertPayments, isFinal, landedCost, shareOfTotal, summarizeOrders } from "./cost-math";
import { getLandedCost } from "./data/queries";

describe("landed cost math (31_12_Landed_Cost.jpeg)", () => {
  it("reproduces each order's landed cost, per piece and status", async () => {
    const { orders } = await getLandedCost();
    expect(orders.map((row) => [formatINR(landedCost(row)), formatINR(landedCost(row) / row.qty, 2), isFinal(row)])).toEqual([
      ["₹13,77,000", "₹550.80", true],
      ["₹7,09,000", "₹236.33", true],
      ["₹8,30,000", "₹922.22", false],
    ]);
  });

  it("sums only the finished orders for the KPIs", async () => {
    const { orders } = await getLandedCost();
    expect(summarizeOrders(orders)).toEqual({
      finishedTotal: 2086000,
      finishedPieces: 5500,
      finishedPOs: ["PO-2028", "PO-2019"],
      estimatePOs: ["PO-2024"],
    });
  });

  it("splits PO-2028's total into the shown one-decimal percentages", async () => {
    const { breakdown } = await getLandedCost();
    expect(shareOfTotal(breakdown.parts.map((part) => part.value))).toEqual({ total: 1377000, percents: [71.2, 26.9, 1.9] });
    expect(shareOfTotal([0, 0]).percents).toEqual([0, 0]);
  });

  it("converts each payment at its own rate and averages the rate over the total", async () => {
    const { goodsPayments } = await getLandedCost();
    const result = convertPayments(goodsPayments);
    expect(result.rows.map((row) => formatINR(row.amountInr))).toEqual(["₹8,40,000", "₹1,40,000"]);
    expect([result.totalCny, formatINR(result.totalInr), formatRate(result.averageRate)]).toEqual([80000, "₹9,80,000", "12.25"]);
  });
});
