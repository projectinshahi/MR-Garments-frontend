import { describe, expect, it } from "vitest";

import type { TransportForm, TripListRow } from "@/lib/api/stages-types";

import { ALL, filterTransports, isShort, kpiSubs, toTripBody, transportSteps, transportTotals, tripValues } from "./transport-logic";

const trip = (patch: Partial<TripListRow>): TripListRow => ({
  id: "t1",
  containerId: "c1",
  container: "CAIU 2298076",
  vehicleNumber: "KL 07 CD 4821",
  lrNumber: "LR-558214",
  company: { id: "kr", name: "Kerala Roadways" },
  orders: ["PO-2028"],
  bundlesLoaded: 50,
  loadedOn: "2026-10-01",
  unloadedOn: "2026-10-03",
  bundlesReceived: 50,
  status: "unloaded",
  costInr: 26500,
  ...patch,
});
const rows = [
  trip({}),
  trip({ id: "t2", container: "HLXU 9034471", vehicleNumber: "KL 11 BT 3308", lrNumber: "LR-MC-4471", company: { id: "mc", name: "Malabar Carriers" }, orders: ["PO-2032", "PO-2033"], costInr: 34000 }),
  trip({ id: "t3", vehicleNumber: "KL 07 CD 2210", unloadedOn: null, bundlesReceived: null, status: "on_road", costInr: 14000.5 }),
];
const all = { query: "", company: ALL, state: ALL } as const;

describe("transport list", () => {
  it("filters by chip, company id and vehicle, LR, container or PO", () => {
    const vehicles = (filters: Parameters<typeof filterTransports>[1]) => filterTransports(rows, filters).map((r) => r.vehicleNumber);
    expect(vehicles({ ...all, state: "on-the-way" })).toEqual(["KL 07 CD 2210"]);
    expect(vehicles({ ...all, state: "delivered" })).toEqual(["KL 07 CD 4821", "KL 11 BT 3308"]);
    expect(vehicles({ ...all, company: "mc" })).toEqual(["KL 11 BT 3308"]);
    expect(vehicles({ ...all, query: "kl 07" })).toEqual(["KL 07 CD 4821", "KL 07 CD 2210"]);
    expect(vehicles({ ...all, query: "lr-mc" })).toEqual(["KL 11 BT 3308"]);
    expect(vehicles({ ...all, query: "po-2033" })).toEqual(["KL 11 BT 3308"]);
    expect(vehicles({ ...all, query: "hlxu" })).toEqual(["KL 11 BT 3308"]);
  });

  it("totals the shown vehicles", () => {
    expect(transportTotals(rows)).toEqual({ label: "Total, 3 vehicles", cost: 74500.5 });
    expect(transportTotals(rows.slice(0, 1))).toEqual({ label: "Total, 1 vehicle", cost: 26500 });
    expect(transportTotals([])).toEqual({ label: "Total, 0 vehicles", cost: 0 });
  });

  it("words the KPI sub-lines as the reference when nothing is on the road or short", () => {
    const kpis = { onTheWay: 0, deliveredLast30Days: 4, bundlesDeliveredLast30Days: 316, shortLast30Days: 0, transportCostLast30DaysInr: 107500 };
    expect(kpiSubs(kpis)).toEqual({ onTheWay: "no vehicle on the road", bundles: "all counts matched" });
    expect(kpiSubs({ ...kpis, onTheWay: 2, shortLast30Days: 1 })).toEqual({ onTheWay: "vehicles on the road", bundles: "1 short delivery" });
  });
});

const form = (patch: Partial<TransportForm> = {}): TransportForm => ({
  container: { id: "c1", number: "CAIU 2298076", status: "arrived", terms: "CNF" },
  clearing: { status: "cleared", clearedOn: "2026-10-01", agent: { id: "a1", name: "Kochi Clearing Services" } },
  trip: null,
  goods: [
    { orderLineId: "l1", orderId: "o1", po: "PO-2028", item: "Denim jeans", unit: "pcs", bundles: 50, quantity: 2500 },
    { orderLineId: "l2", orderId: "o1", po: "PO-2028", item: "Cotton fabric", unit: "m", bundles: 4, quantity: 400 },
  ],
  suppliers: ["Guangzhou Textile Co."],
  companies: [{ id: "kr", name: "Kerala Roadways" }],
  warehouses: [{ id: "w1", name: "Main warehouse" }],
  ...patch,
});
const saved: NonNullable<TransportForm["trip"]> = {
  id: "t1",
  transportCompanyId: "kr",
  destinationId: "w1",
  lrNumber: "LR-558214",
  vehicleNumber: "KL 07 CD 4821",
  driverName: "Suresh P",
  driverPhone: "+91 94470 55123",
  bundlesLoaded: 50,
  loadedOn: "2026-10-01",
  loadedFrom: "Kochi port yard",
  loadedBy: "Ravi K",
  unloadedOn: null,
  bundlesReceived: null,
  receivedBy: "",
  shortRemark: "",
  freightInr: 22000,
  handlingInr: 4500,
  status: "on_road",
};
const steps = (f: TransportForm) => transportSteps(f).map(({ title, marker, number, detail }) => [title, marker, number, detail]);

describe("transport form", () => {
  it("starts a new trip with the first company and warehouse, every bundle of the container, loaded today", () => {
    expect(tripValues(form(), "2026-10-02")).toMatchObject({ transportCompanyId: "kr", destinationId: "w1", bundlesLoaded: "54", loadedOn: "2026-10-02", freightInr: "" });
  });

  it("round-trips the saved trip into the TRN-3 body: empty unloading fields null, empty charges 0", () => {
    const values = tripValues(form({ trip: saved }), "2026-10-02");
    expect(toTripBody(values)).toEqual(Object.fromEntries(Object.entries(saved).filter(([key]) => key !== "id" && key !== "status")));
    expect(toTripBody({ ...values, unloadedOn: "2026-10-03", bundlesReceived: "0", handlingInr: "" })).toMatchObject({ unloadedOn: "2026-10-03", bundlesReceived: 0, handlingInr: 0 });
  });

  it("needs a short remark only when fewer bundles are received than loaded", () => {
    expect(isShort({ bundlesLoaded: "50", bundlesReceived: "" })).toBe(false);
    expect(isShort({ bundlesLoaded: "50", bundlesReceived: "50" })).toBe(false);
    expect(isShort({ bundlesLoaded: "50", bundlesReceived: "48" })).toBe(true);
    expect(isShort({ bundlesLoaded: "50", bundlesReceived: "0" })).toBe(true);
  });

  it("reproduces the reference progress from the saved trip, on the way", () => {
    expect(steps(form({ trip: saved }))).toEqual([
      ["Cleared, handed to transport", "check", undefined, "1 Oct · from Kochi Clearing Services"],
      ["Loaded on vehicle", "check", undefined, "1 Oct · KL 07 CD 4821"],
      ["On the way to warehouse", "current", 3, "LR-558214"],
      ["Unloaded at our warehouse", "pending", 4, undefined],
    ]);
    expect(steps(form()).map(([, marker]) => marker)).toEqual(["check", "current", "pending", "pending"]);
    expect(steps(form({ clearing: null }))[0]).toEqual(["Cleared, handed to transport", "current", 1, "Waiting"]);
    const unloaded = { ...saved, unloadedOn: "2026-10-03", bundlesReceived: 48, status: "unloaded" as const };
    expect(steps(form({ trip: unloaded }))[3]).toEqual(["Unloaded at our warehouse", "check", undefined, "3 Oct · 48 of 50 bundles"]);
  });
});
