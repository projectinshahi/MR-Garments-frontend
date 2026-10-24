import { describe, expect, it } from "vitest";

import { getTransportForm, getTransportList, listTransportFormSlugs } from "./data/queries";
import { ALL, containerSlug, filterTransports, transportKpis, transportTotals } from "./transport-logic";

const all = { query: "", company: ALL, state: ALL } as const;

describe("filterTransports", () => {
  it("filters by status chip, company and vehicle, LR or PO search", async () => {
    const { rows } = await getTransportList();
    const vehicles = (filters: Parameters<typeof filterTransports>[1]) => filterTransports(rows, filters).map((r) => r.vehicle);
    expect(vehicles(all)).toHaveLength(4);
    expect(vehicles({ ...all, state: "on-the-way" })).toEqual([]);
    expect(vehicles({ ...all, state: "delivered" })).toHaveLength(4);
    expect(vehicles({ ...all, company: "Malabar Carriers" })).toEqual(["KL 11 BT 3308"]);
    expect(vehicles({ ...all, query: "kl 07" })).toEqual(["KL 07 CD 4821", "KL 07 CD 2210"]);
    expect(vehicles({ ...all, query: "lr-mc" })).toEqual(["KL 11 BT 3308"]);
    expect(vehicles({ ...all, query: "po-2030" })).toEqual(["KL 01 AB 1102"]);
    expect(vehicles({ ...all, query: "po-2030", company: "Malabar Carriers" })).toEqual([]);
  });
});

describe("totals and KPIs", () => {
  it("reproduces the reference: Total, 4 vehicles, ₹1,07,500; 0 on the way, 316 bundles", async () => {
    const { rows } = await getTransportList();
    expect(transportTotals(rows)).toEqual({ label: "Total, 4 vehicles", cost: 107500 });
    expect(transportKpis(rows)).toEqual({ onTheWay: 0, delivered: 4, bundlesDelivered: 316, cost: 107500 });
  });

  it("follows the filtered rows", async () => {
    const { rows } = await getTransportList();
    expect(transportTotals(filterTransports(rows, { ...all, company: "Malabar Carriers" }))).toEqual({ label: "Total, 1 vehicle", cost: 34000 });
    expect(transportTotals([])).toEqual({ label: "Total, 0 vehicles", cost: 0 });
  });
});

describe("transport form routes", () => {
  it("only CAIU 2298076 has a designed form, linked from its list row", async () => {
    expect(containerSlug("CAIU 2298076")).toBe("CAIU-2298076");
    expect(await listTransportFormSlugs()).toEqual(["CAIU-2298076"]);
    const { rows, recordHref } = await getTransportList();
    expect(recordHref).toBe("/transport/CAIU-2298076");
    expect(rows.filter((r) => r.formHref).map((r) => r.vehicle)).toEqual(["KL 07 CD 4821"]);
    expect((await getTransportForm("CAIU-2298076"))?.charges.reduce((sum, c) => sum + c.amount, 0)).toBe(26500);
    expect(await getTransportForm("MEDU-4470912")).toBeUndefined();
  });
});
