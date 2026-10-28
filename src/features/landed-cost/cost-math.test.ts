import { describe, expect, it } from "vitest";

import { breakdownParts, convertPayments, costByTeam, listPos, shareOfTotal } from "./cost-math";
import type { LandedCostRow } from "./data/queries";

const row = (partial: Partial<LandedCostRow>): LandedCostRow => ({
  orderId: "o1",
  po: "PO-2028",
  supplier: { id: "s1", name: "Guangzhou Textile Co." },
  item: "Denim jeans",
  quantity: 2500,
  unit: "pcs",
  terms: "CNF",
  goodsInr: 980000,
  seaFreightInr: 0,
  clearingInr: 370500,
  transportInr: 26500,
  totalInr: 1377000,
  stockedPieces: 2500,
  perPieceInr: 550.8,
  final: true,
  waitingFor: null,
  teams: [],
  goodsPayments: [],
  ...partial,
});

describe("landed cost math (31_12_Landed_Cost.jpeg)", () => {
  it("splits a CNF order into goods, duty and transport with one-decimal shares", () => {
    const parts = breakdownParts(row({}));
    expect(parts.map((part) => part.key)).toEqual(["goods", "duty", "transport"]);
    expect(shareOfTotal(parts.map((part) => part.value))).toEqual({ total: 1377000, percents: [71.2, 26.9, 1.9] });
    expect(shareOfTotal([0, 0]).percents).toEqual([0, 0]);
  });

  it("adds sea freight as a part when it was paid (FOB), and counts waiting parts as 0", () => {
    const parts = breakdownParts(row({ terms: "FOB", seaFreightInr: 38000, clearingInr: null, transportInr: null }));
    expect(parts.map((part) => [part.key, part.value])).toEqual([
      ["goods", 980000],
      ["seaFreight", 38000],
      ["duty", 0],
      ["transport", 0],
    ]);
  });

  it("totals the goods payments and averages the rate over the total", () => {
    const payments = [
      { id: "p1", orderId: "o1", kind: "Deposit" as const, paidOn: "2026-08-05", amountCny: 70000, rateInr: 12, amountInr: 840000 },
      { id: "p2", orderId: "o1", kind: "Balance" as const, paidOn: "2026-08-26", amountCny: 10000, rateInr: 14, amountInr: 140000 },
    ];
    expect(convertPayments(payments)).toEqual({ totalCny: 80000, totalInr: 980000, averageRate: 12.25 });
    expect(convertPayments([]).averageRate).toBe(0);
  });

  it("adds each team's pieces and cost over the orders, in team order, leaving out teams with no stock", () => {
    const teams = [
      { id: "t1", name: "Retail team" },
      { id: "t2", name: "Wholesale team" },
      { id: "t3", name: "Online team" },
    ];
    const rows = [
      row({ teams: [{ teamId: "t3", team: "Online team", pieces: 40, costInr: 16180 }] }),
      row({ teams: [{ teamId: "t1", team: "Retail team", pieces: 60, costInr: 24270 }, { teamId: "t3", team: "Online team", pieces: 10, costInr: 1325 }] }),
    ];
    expect(costByTeam(rows, teams)).toEqual([
      { teamId: "t1", team: "Retail team", pieces: 60, costInr: 24270, perPieceInr: 404.5 },
      { teamId: "t3", team: "Online team", pieces: 50, costInr: 17505, perPieceInr: 350.1 },
    ]);
  });

  it("lists POs as the KPI sub-lines show them", () => {
    expect(listPos([])).toBe("");
    expect(listPos(["PO-2028"])).toBe("PO-2028");
    expect(listPos(["PO-2028", "PO-2019"])).toBe("PO-2028 and PO-2019");
    expect(listPos(["PO-1", "PO-2", "PO-3"])).toBe("PO-1, PO-2 and PO-3");
    expect(listPos(["PO-1", "PO-2", "PO-3", "PO-4", "PO-5"])).toBe("PO-1, PO-2 and 3 more");
  });
});
