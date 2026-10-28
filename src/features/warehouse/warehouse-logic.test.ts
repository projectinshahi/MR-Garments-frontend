import { describe, expect, it } from "vitest";

import type { ReceiveGoodsForm, WarehouseListRow } from "@/lib/api/stages-types";
import { formatINR } from "@/lib/formatters";

import {
  ALL,
  capTeamPieces,
  costSoFar,
  filterReceipts,
  receiptValues,
  splitSummary,
  summarizeReceipts,
  teamCost,
  teamLabel,
  teamPieces,
  toReceiptBody,
  unitOf,
} from "./warehouse-logic";

const row = (patch: Partial<WarehouseListRow>): WarehouseListRow => ({
  id: "r1:o1",
  receiptId: "r1",
  transportId: "t1",
  receivedOn: "2026-10-03",
  receivedBy: "Joseph M",
  container: "CAIU 2298076",
  orderId: "o1",
  po: "PO-2028",
  item: "Denim jeans",
  supplier: "Guangzhou Textile Co.",
  location: { id: "w1", name: "Main warehouse" },
  received: 2500,
  teams: { retail: 1000, wholesale: 1000, online: 500 },
  costPerPieceInr: 550.8,
  ...patch,
});
const rows = [
  row({}),
  row({ id: "r2:o2", po: "PO-2034", item: "Men's shorts", received: 1500, teams: { retail: 500, wholesale: 500, online: 500 }, costPerPieceInr: 176.4 }),
  row({ id: "r3:o3", po: "PO-2030", item: "Track pants", location: { id: "w2", name: "Second warehouse" }, received: 3000, teams: { online: 3000 }, costPerPieceInr: null }),
];
const all = { query: "", warehouse: ALL, team: ALL };

describe("warehouse list", () => {
  it("filters by item or PO, warehouse and team", () => {
    expect(filterReceipts(rows, { ...all, query: " shorts" }).map((r) => r.po)).toEqual(["PO-2034"]);
    expect(filterReceipts(rows, { ...all, query: "po-2030" }).map((r) => r.item)).toEqual(["Track pants"]);
    expect(filterReceipts(rows, { ...all, warehouse: "w1" })).toHaveLength(2);
    expect(filterReceipts(rows, { ...all, team: "retail" }).map((r) => r.po)).toEqual(["PO-2028", "PO-2034"]);
  });

  it("totals pieces per team and weights the cost per piece by the rows that have one", () => {
    const totals = summarizeReceipts(rows);
    expect(totals).toMatchObject({ items: 3, received: 7000, teams: { retail: 1500, wholesale: 1500, online: 4000 } });
    expect(formatINR(totals.costPerPiece!, 2)).toBe(formatINR((2500 * 550.8 + 1500 * 176.4) / 4000, 2));
    expect(summarizeReceipts([rows[2]!]).costPerPiece).toBeNull();
    expect(summarizeReceipts([])).toEqual({ items: 0, received: 0, teams: {}, costPerPiece: null });
    expect(["Retail team", "Online", "Wholesale Team"].map(teamLabel)).toEqual(["Retail", "Online", "Wholesale"]);
  });
});

const form = (patch: Partial<ReceiveGoodsForm> = {}): ReceiveGoodsForm => ({
  trip: {
    id: "t1",
    containerId: "c1",
    container: "CAIU 2298076",
    terms: "CNF",
    vehicleNumber: "KL 07 CD 4821",
    lrNumber: "LR-558214",
    bundlesLoaded: 50,
    bundlesReceived: 50,
    unloadedOn: "2026-10-03",
    destinationId: "w1",
    status: "unloaded",
  },
  receipt: null,
  lines: [{ orderLineId: "l1", orderId: "o1", po: "PO-2028", item: "Denim jeans", unit: "pcs", quantity: 2500 }],
  teams: [
    { id: "retail", name: "Retail team" },
    { id: "wholesale", name: "Wholesale team" },
    { id: "online", name: "Online team" },
  ],
  warehouses: [{ id: "w1", name: "Main warehouse" }],
  cost: { goodsInr: 980000, seaFreightInr: 0, clearingInr: 370500, transportInr: 26500, totalInr: 1377000, orderedPieces: 2500, final: false },
  ...patch,
});
const line = form().lines[0]!;

describe("receive goods", () => {
  it("starts from the trip: its warehouse, its unloading day and bundles, the signed-in user, nothing split", () => {
    expect(receiptValues(form(), "2026-10-05", "Joseph M")).toEqual({ locationId: "w1", receivedOn: "2026-10-03", receivedBy: "Joseph M", bundlesReceived: "50", split: {} });
    const inactive = form({ trip: { ...form().trip, destinationId: "w9" } });
    expect(receiptValues(inactive, "2026-10-05", "Joseph M").locationId).toBe("w1");
  });

  it("round-trips a saved receipt's split into the WH-3 body, leaving out zeros", () => {
    const lines = [
      { orderLineId: "l1", teamId: "retail", quantity: 1000 },
      { orderLineId: "l1", teamId: "online", quantity: 500 },
    ];
    const saved = form({ receipt: { id: "r1", locationId: "w1", receivedOn: "2026-10-04", receivedBy: "Joseph M", bundlesReceived: 48, status: "draft", lines } });
    const values = receiptValues(saved, "2026-10-05", "Someone else");
    expect(values).toMatchObject({ receivedOn: "2026-10-04", receivedBy: "Joseph M", bundlesReceived: "48", split: { l1: { retail: 1000, online: 500 } } });
    expect(toReceiptBody({ ...values, split: { l1: { ...values.split.l1, wholesale: 0 } } })).toEqual({
      locationId: "w1",
      receivedOn: "2026-10-04",
      receivedBy: "Joseph M",
      bundlesReceived: 48,
      lines,
    });
    // Empty bundles are sent as null, which WH-3 refuses (0 is a real count).
    expect(toReceiptBody({ ...values, bundlesReceived: "" }).bundlesReceived).toBeNull();
  });

  it("reproduces the reference split and costs", () => {
    const split = { l1: { retail: 1000, wholesale: 1000, online: 500 } };
    expect(splitSummary(form().lines, split)).toEqual({ total: 2500, assigned: 2500, left: 0 });
    const { total, perPiece } = costSoFar(form().cost!);
    expect(total).toBe(1377000);
    expect(formatINR(perPiece, 2)).toBe("₹550.80");
    expect(["retail", "wholesale", "online"].map((team) => formatINR(teamCost(teamPieces(split, team), perPiece)))).toEqual(["₹5,50,800", "₹5,50,800", "₹2,75,400"]);
  });

  it("never gives the teams more than a line's quantity", () => {
    const split = { l1: { retail: 1000, wholesale: 1000, online: 500 } };
    expect(capTeamPieces(line, split, "retail", 800)).toBe(800);
    expect(capTeamPieces(line, split, "online", 900)).toBe(500);
    expect(capTeamPieces(line, { l1: { retail: 800, wholesale: 1000, online: 500 } }, "online", 900)).toBe(700);
    expect(capTeamPieces(line, {}, "online", 3000)).toBe(2500);
    expect(splitSummary(form().lines, { l1: { retail: 800, wholesale: 1000, online: 500 } })).toEqual({ total: 2500, assigned: 2300, left: 200 });
  });

  it("names the unit the lines share, or units when they differ", () => {
    expect(unitOf(form().lines)).toBe("pcs");
    expect(unitOf([...form().lines, { ...line, orderLineId: "l2", unit: "m" }])).toBe("units");
    expect(unitOf([])).toBe("pcs");
  });
});
