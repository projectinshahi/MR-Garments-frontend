import { describe, expect, it } from "vitest";

import { ALL, clearingTotal, filterClearings } from "./clearing-logic";
import { getClearingForm, getClearingList, listClearingFormSlugs } from "./data/queries";

describe("clearingTotal", () => {
  it("reproduces the reference: ₹3,70,500 without the goods value", async () => {
    const form = await getClearingForm("CAIU-2298076");
    expect(form?.goodsValue).toBe(980000);
    expect(clearingTotal(form?.charges ?? [])).toBe(370500);
  });

  it("follows an edited charge", async () => {
    const form = await getClearingForm("CAIU-2298076");
    const charges = (form?.charges ?? []).map((c) => (c.id === "port-charges" ? { ...c, amount: 20000 } : c));
    expect(clearingTotal(charges)).toBe(376000);
  });
});

describe("clearing routes", () => {
  it("knows only the designed container", async () => {
    expect(await listClearingFormSlugs()).toEqual(["CAIU-2298076"]);
    expect(await getClearingForm("MEDU-4470912")).toBeNull();
  });
});

describe("filterClearings", () => {
  const all = { query: "", agent: ALL, state: ALL } as const;

  it("filters by status chip, agent and search", async () => {
    const { rows, agents } = await getClearingList();
    expect(agents).toEqual(["Kochi Clearing Services", "Southern Port Agents"]);
    expect(filterClearings(rows, all)).toHaveLength(4);
    expect(rows.reduce((sum, r) => sum + r.clearingCost, 0)).toBe(956060);
    expect(filterClearings(rows, { ...all, state: "cleared" })).toHaveLength(4);
    expect(filterClearings(rows, { ...all, state: "waiting" })).toHaveLength(0);
    expect(filterClearings(rows, { ...all, state: "duty" })).toHaveLength(0);
    expect(filterClearings(rows, { ...all, agent: "Southern Port Agents" }).map((r) => r.container)).toEqual(["MEDU 4470912", "HLXU 9034471"]);
    expect(filterClearings(rows, { ...all, query: "po-2030" }).map((r) => r.container)).toEqual(["TCLU 6620148"]);
    expect(filterClearings(rows, { ...all, query: "caiu" })).toHaveLength(1);
  });
});
