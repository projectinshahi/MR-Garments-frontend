import { describe, expect, it } from "vitest";

import { formatINR } from "@/lib/formatters";

import { getReceiveGoods, getWarehouseList } from "./data/queries";
import { capTeamPieces, costSoFar, filterReceipts, splitSummary, summarizeReceipts, teamCost } from "./warehouse-logic";

describe("warehouse list", () => {
  it("reproduces the totals row: 6 items, 15,800 / 6,000 / 5,900 / 3,900 pcs and ₹267.19 per piece", async () => {
    const { receipts } = await getWarehouseList();
    const totals = summarizeReceipts(receipts);
    expect(totals).toMatchObject({ items: 6, received: 15800, retail: 6000, wholesale: 5900, online: 3900 });
    expect(formatINR(totals.costPerPiece, 2)).toBe("₹267.19");
  });

  it("searches by item or PO", async () => {
    const { receipts } = await getWarehouseList();
    expect(filterReceipts(receipts, "  ").length).toBe(6);
    expect(filterReceipts(receipts, "polo").map((r) => r.po)).toEqual(["PO-2033"]);
    expect(filterReceipts(receipts, "po-2030").map((r) => r.item)).toEqual(["Track pants"]);
    expect(summarizeReceipts(filterReceipts(receipts, "nothing"))).toMatchObject({ items: 0, received: 0, costPerPiece: 0 });
  });
});

describe("receive goods", () => {
  it("reproduces the reference split and costs", async () => {
    const data = await getReceiveGoods();
    const pieces = data.teams.map((t) => t.pieces);
    expect(data.teams.map((t) => t.name)).toEqual(["Retail team", "Wholesale team", "Online team"]);
    expect(splitSummary(data.received, pieces)).toEqual({ assigned: 2500, left: 0 });
    const { total, perPiece } = costSoFar(data.cost, data.received);
    expect(total).toBe(1377000);
    expect(formatINR(perPiece, 2)).toBe("₹550.80");
    expect(pieces.map((p) => formatINR(teamCost(p, perPiece)))).toEqual(["₹5,50,800", "₹5,50,800", "₹2,75,400"]);
  });

  it("updates as a team quantity changes and never assigns more than received", async () => {
    const data = await getReceiveGoods();
    const pieces = data.teams.map((t) => t.pieces);
    const edited = [capTeamPieces(data.received, pieces, 0, 800), pieces[1], pieces[2]];
    expect(splitSummary(data.received, edited)).toEqual({ assigned: 2300, left: 200 });
    expect(formatINR(teamCost(edited[0], costSoFar(data.cost, data.received).perPiece))).toBe("₹4,40,640");
    expect(capTeamPieces(data.received, pieces, 2, 900)).toBe(500);
    expect(capTeamPieces(data.received, edited, 2, 900)).toBe(700);
  });
});
