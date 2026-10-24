import { describe, expect, it } from "vitest";

import { ALL, containerChips, contents, filterContainers, orderLoaded, parseCount } from "./containers-logic";
import { getContainersList, getLoadContainer } from "./data/queries";

describe("filterContainers", () => {
  const all = { query: "", agent: ALL, terms: ALL, chip: "active" } as const;
  const numbers = (rows: { number: string }[]) => rows.map((r) => r.number);

  it("shows every row for Active and none for Finished", async () => {
    const { containers } = await getContainersList();
    expect(filterContainers(containers, all)).toHaveLength(6);
    expect(filterContainers(containers, { ...all, chip: "finished" })).toEqual([]);
  });

  it("filters by status chip, agent, terms and search", async () => {
    const { containers } = await getContainersList();
    expect(filterContainers(containers, { ...all, chip: "sea" })).toHaveLength(4);
    expect(numbers(filterContainers(containers, { ...all, chip: "loading" }))).toEqual(["FCIU 5527310"]);
    expect(numbers(filterContainers(containers, { ...all, agent: "Dragon Cargo" }))).toEqual(["CAIU 3305871", "OOLU 6094412"]);
    expect(filterContainers(containers, { ...all, terms: "CNF" })).toHaveLength(3);
    expect(numbers(filterContainers(containers, { ...all, query: "po-2037" }))).toEqual(["MSKU 4471203", "TGHU 8820156"]);
    expect(numbers(filterContainers(containers, { ...all, query: " caiu " }))).toEqual(["CAIU 3305871", "CAIU 2298076"]);
  });

  it("labels the chips with the counts shown", async () => {
    const { containers } = await getContainersList();
    expect(containerChips(containers).map((c) => c.label)).toEqual([
      "Active (6)",
      "On the way (4)",
      "Loading (1)",
      "Arrived (1)",
      "Finished",
    ]);
  });
});

describe("loaded totals", () => {
  it("reproduces the reference: 2 orders, 3 lines, 71 bundles, 1,160 and 4,000 loaded", async () => {
    const { lines, orderLoads } = await getLoadContainer();
    expect(contents(lines)).toEqual({ orders: 2, lines: 3, bundles: 71 });
    expect(orderLoads.map((load) => orderLoaded(load, lines))).toEqual([1160, 4000]);
  });

  it("follows edits to bundles and quantities", async () => {
    const { lines, orderLoads } = await getLoadContainer();
    const edited = lines.map((l) => (l.id === "2031-tshirts" ? { ...l, bundles: parseCount("45"), quantity: parseCount("4,500 pcs") } : l));
    expect(contents(edited).bundles).toBe(76);
    expect(orderLoaded(orderLoads[1], edited)).toBe(4500);
    expect(parseCount("")).toBe(0);
  });
});
