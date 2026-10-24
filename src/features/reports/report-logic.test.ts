import { describe, expect, it } from "vitest";

import { MOCK_TODAY } from "@/lib/constants";

import {
  getContainersTimelineReport,
  getLandedCostByMonthReport,
  getOrderedVsReceivedReport,
  getPaymentsPerSupplierReport,
} from "./data/queries";
import { axisPercent, balance, barSpan, monthTotals, perPiece, shortQty, summarizeReceived, supplierTotals } from "./report-logic";

describe("timeline axis (13.4)", () => {
  const axis = { start: "2026-09-05", end: "2026-10-25" };

  it("maps dates linearly from start (0 %) to end (100 %)", () => {
    expect(axisPercent("2026-09-05", axis.start, axis.end)).toBe(0);
    expect(axisPercent("2026-10-25", axis.start, axis.end)).toBe(100);
    expect(axisPercent(MOCK_TODAY, axis.start, axis.end)).toBe(50);
    expect(axisPercent("2026-10-24", axis.start, axis.end)).toBe(98);
  });

  it("places each container bar where the reference draws it", async () => {
    const { containers, axis: refAxis } = await getContainersTimelineReport();
    expect(refAxis).toMatchObject(axis);
    const spans = containers.map((c) => barSpan(c.loaded, c.arrival, refAxis));
    expect(spans).toEqual([
      { left: 8, width: 38 },
      { left: 18, width: 36 },
      { left: 22, width: 36 },
      { left: 34, width: 38 },
      { left: 48, width: 38 },
      { left: 42, width: 56 },
    ]);
  });
});

describe("ordered vs received (13.3)", () => {
  it("derives the short column and the KPIs: 8 checked, 2 short, ¥2,940, 6 in full", async () => {
    const lines = await getOrderedVsReceivedReport();
    expect(lines.map(shortQty)).toEqual([40, 12, 0, 0, 0, 0, 0, 0]);
    expect(summarizeReceived(lines)).toEqual({ checked: 8, shortPos: ["PO-2035", "PO-2027"], shortValue: 2940, full: 6 });
  });

  it("never reports a negative shortage", () => {
    expect(shortQty({ ordered: 100, received: 120 })).toBe(0);
  });
});

describe("payments per supplier (13.5)", () => {
  it("reproduces the balances and the totals row", async () => {
    const { suppliers } = await getPaymentsPerSupplierReport();
    expect(suppliers.map(balance)).toEqual([90000, 94000, 80000, 56000]);
    expect(supplierTotals(suppliers)).toEqual({ orders: 5, orderValue: 491000, paid: 171000, paidInr: 2515000, balance: 320000 });
  });
});

describe("landed cost by month (13.6)", () => {
  it("stores per-piece values within a paisa of cost / pieces (the reference truncates September)", async () => {
    const { months } = await getLandedCostByMonthReport();
    for (const m of months) {
      const computed = perPiece(m.landedCost, m.pieces);
      if (m.perPiece === null || computed === null) expect([m.perPiece, computed]).toEqual([null, null]);
      else expect(Math.abs(m.perPiece - computed)).toBeLessThan(0.01);
    }
  });

  it("reproduces the totals row: 15,800 pcs, ₹42,21,560, ₹267.19", async () => {
    const { months } = await getLandedCostByMonthReport();
    const totals = monthTotals(months);
    expect(totals).toMatchObject({ pieces: 15800, landedCost: 4221560, biggest: 2844560 });
    expect(totals.perPiece).toBeCloseTo(267.19, 2);
  });
});
