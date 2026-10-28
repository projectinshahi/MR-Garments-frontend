import { describe, expect, it } from "vitest";

import type { ContainerListItem } from "@/lib/api/types";

import {
  ACTION_LABEL,
  actionFields,
  ALL,
  agentNames,
  CONTAINER_STATUS,
  containerActions,
  containerChips,
  containerDatesSchema,
  containerKpis,
  contents,
  DATE_MESSAGES,
  filterContainers,
  lineLoads,
  listFootnote,
  loadContainerSchema,
  parseCount,
  toContainerBody,
  toContainerRow,
  toLoadValues,
  toUpdateBody,
  type ContainerAction,
  type ContainerRow,
} from "./containers-logic";

const item = (patch: Partial<ContainerListItem>): ContainerListItem => ({
  id: "c1",
  number: "FCIU 5527310",
  agent: { id: "a1", name: "Sino Freight" },
  terms: "FOB",
  loadedOn: null,
  sailedOn: null,
  eta: "2026-10-24",
  etaEstimated: true,
  status: "loading",
  bundles: 23,
  orders: [{ po: "PO-2035", part: false }],
  ...patch,
});

const rows: ContainerRow[] = [
  item({}),
  item({ id: "c2", number: "MSKU 4471203", status: "sea", eta: "2026-10-02", orders: [{ po: "PO-2027", part: false }, { po: "PO-2037", part: true }] }),
  item({ id: "c3", number: "TGHU 8820156", status: "sea", terms: "CNF", eta: "2026-10-04", orders: [{ po: "PO-2037", part: true }] }),
  item({ id: "c4", number: "CAIU 3305871", status: "sea", eta: "2026-10-11", agent: { id: "a2", name: "Dragon Cargo" }, orders: [{ po: "PO-2040", part: false }] }),
  item({ id: "c5", number: "CAIU 2298076", status: "arrived", terms: "CNF", eta: "2026-09-28", orders: [{ po: "PO-2028", part: false }] }),
].map(toContainerRow);

describe("toContainerRow", () => {
  it("maps CON-1 and keeps which orders are split (part)", () => {
    expect(rows[1]).toEqual({
      id: "c2",
      number: "MSKU 4471203",
      agent: "Sino Freight",
      terms: "FOB",
      orders: [
        { po: "PO-2027", part: false },
        { po: "PO-2037", part: true },
      ],
      bundles: 23,
      loadedOn: null,
      sailedOn: null,
      etaIndia: "2026-10-02",
      etaEstimated: true,
      status: "sea",
    });
  });
});

describe("filterContainers", () => {
  const all = { query: "", agent: ALL, terms: ALL, chip: "active" } as const;
  const numbers = (list: ContainerRow[]) => list.map((r) => r.number);

  it("filters by status chip, agent, terms and search", () => {
    expect(filterContainers(rows, all)).toHaveLength(5);
    expect(filterContainers(rows, { ...all, chip: "sea" })).toHaveLength(3);
    expect(numbers(filterContainers(rows, { ...all, chip: "loading" }))).toEqual(["FCIU 5527310"]);
    expect(numbers(filterContainers(rows, { ...all, chip: "arrived" }))).toEqual(["CAIU 2298076"]);
    expect(numbers(filterContainers(rows, { ...all, agent: "Dragon Cargo" }))).toEqual(["CAIU 3305871"]);
    expect(filterContainers(rows, { ...all, terms: "CNF" })).toHaveLength(2);
    expect(numbers(filterContainers(rows, { ...all, query: "po-2037" }))).toEqual(["MSKU 4471203", "TGHU 8820156"]);
    expect(numbers(filterContainers(rows, { ...all, query: " caiu " }))).toEqual(["CAIU 3305871", "CAIU 2298076"]);
  });

  it("has one chip for all and one per real status, with counts, and lists the agents once", () => {
    expect(containerChips(rows)).toEqual([
      { value: "active", label: "Active (5)" },
      { value: "sea", label: "On the way (3)" },
      { value: "loading", label: "Loading (1)" },
      { value: "arrived", label: "Arrived (1)" },
    ]);
    // Every chip but "active" is a real CON-1 status, and every status has a chip and a pill.
    const statuses = containerChips(rows).flatMap((c) => (c.value === "active" ? [] : [c.value]));
    expect(statuses.sort()).toEqual(Object.keys(CONTAINER_STATUS).sort());
    expect(agentNames(rows)).toEqual(["Dragon Cargo", "Sino Freight"]);
  });
});

describe("containerKpis and listFootnote", () => {
  it("counts against the given today: at sea arriving within 6 days", () => {
    expect(containerKpis(rows, "2026-09-30")).toEqual({
      active: 5,
      arrivingThisWeek: ["MSKU 4471203", "TGHU 8820156"],
      loadingNow: ["FCIU 5527310"],
      arrivedInClearing: ["CAIU 2298076"],
    });
    expect(containerKpis(rows, "2026-10-05").arrivingThisWeek).toEqual(["MSKU 4471203", "TGHU 8820156", "CAIU 3305871"]);
    expect(containerKpis([], "2026-09-30")).toEqual({ active: 0, arrivingThisWeek: [], loadingNow: [], arrivedInClearing: [] });
  });

  it("names a split order only when one is listed", () => {
    expect(listFootnote(rows)).toBe("An order can be split across containers (PO-2037 above), and one container can hold many orders.");
    expect(listFootnote([rows[0]])).toBe("An order can be split across containers, and one container can hold many orders.");
  });
});

describe("load container form", () => {
  const loadable = [
    { orderLineId: "l1", orderId: "o1", po: "PO-2035", item: "Men's jackets", unit: "pcs" as const, received: 1160, loaded: 0 },
    { orderLineId: "l2", orderId: "o2", po: "PO-2031", item: "Kids t-shirts", unit: "pcs" as const, received: 6000, loaded: 2000 },
  ];
  const filled = () => {
    const values = toLoadValues(loadable, "2026-09-27");
    values.number = " FCIU 5527310 ";
    values.shippingAgentId = "a1";
    values.eta = "2026-10-24";
    values.lines[1].bundles = "40";
    values.lines[1].quantity = "4,000 pcs";
    return values;
  };

  it("starts empty with today as the loading date", () => {
    expect(toLoadValues(loadable, "2026-09-27")).toMatchObject({ loadedOn: "2026-09-27", sailedOn: "", eta: "", terms: "FOB", number: "" });
  });

  it("checks quantity against received minus loaded, ETA after loading, and one line at least", () => {
    expect(loadContainerSchema.safeParse(filled()).success).toBe(true);

    const over = filled();
    over.lines[1].quantity = "4001";
    over.eta = "2026-09-26";
    const issues = loadContainerSchema.safeParse(over).error?.issues.map((i) => [i.path.join("."), i.message]);
    expect(issues).toEqual([
      ["eta", "The ETA can't be before the loading date."],
      ["lines.1.quantity", "Only 4,000 pcs left to load."],
    ]);

    const none = filled();
    none.lines[1].quantity = "";
    expect(loadContainerSchema.safeParse(none).error?.issues.map((i) => i.path.join("."))).toEqual(["lines"]);
  });

  it("builds the CON-3 body with only the loaded lines", () => {
    expect(toContainerBody(filled())).toEqual({
      number: "FCIU 5527310",
      shippingAgentId: "a1",
      terms: "FOB",
      portOfLoading: "",
      portOfArrival: "",
      loadedOn: "2026-09-27",
      sailedOn: null,
      eta: "2026-10-24",
      lines: [{ orderLineId: "l2", bundles: 40, quantity: 4000 }],
    });
  });

  it("sums the glance and the per-line loads from the entered quantities", () => {
    const lines = loadable.map((l, i) => ({ ...l, bundles: [23, 40][i], quantity: [1160, 3000][i] }));
    expect(contents(lines)).toEqual({ orders: 2, lines: 2, bundles: 63 });
    expect(contents([{ ...lines[0], quantity: 0 }])).toEqual({ orders: 0, lines: 0, bundles: 0 });
    expect(lineLoads(lines).map(({ title, loaded, received, rest }) => [title, loaded, received, rest])).toEqual([
      ["PO-2035 · Men's jackets", 1160, 1160, 0],
      ["PO-2031 · Kids t-shirts", 5000, 6000, 1000],
    ]);
    expect(parseCount("1,160 pcs")).toBe(1160);
    expect(parseCount("")).toBe(0);
  });
});

describe("container status actions", () => {
  const container = { loadedOn: "2026-10-20", sailedOn: null, eta: "2026-11-10" };
  const today = "2026-10-27";
  const issues = (action: ContainerAction, values: { sailedOn: string; eta: string }, saved: { sailedOn: string | null } = container) =>
    containerDatesSchema(action, { ...container, ...saved }, today)
      .safeParse(values)
      .error?.issues.map((i) => [i.path.join("."), i.message]) ?? [];

  it("offers only the forward moves and date corrections valid for each status", () => {
    const labels = (status: "loading" | "sea" | "arrived") => containerActions(status).map((a) => ACTION_LABEL[a]);
    expect(labels("loading")).toEqual(["Mark as sailed", "Change ETA"]);
    expect(labels("sea")).toEqual(["Mark as arrived", "Change dates"]);
    expect(labels("arrived")).toEqual([]);
    expect([actionFields("sail"), actionFields("arrive"), actionFields("eta"), actionFields("dates")]).toEqual([
      ["sailedOn", "eta"],
      [],
      ["eta"],
      ["sailedOn", "eta"],
    ]);
  });

  it("checks the sailing date: given, not before loading, not after today", () => {
    expect(issues("sail", { sailedOn: "2026-10-27", eta: "2026-11-10" })).toEqual([]);
    expect(issues("sail", { sailedOn: "", eta: "2026-11-10" })).toEqual([["sailedOn", DATE_MESSAGES.sailedOnNeeded]]);
    expect(issues("sail", { sailedOn: "2026-10-19", eta: "2026-11-10" })).toEqual([["sailedOn", DATE_MESSAGES.sailedBeforeLoading]]);
    expect(issues("dates", { sailedOn: "2026-10-28", eta: "2026-11-10" })).toEqual([["sailedOn", DATE_MESSAGES.sailedFuture]]);
  });

  it("checks the ETA against loading and the new or saved sailing date", () => {
    expect(issues("eta", { sailedOn: "", eta: "" })).toEqual([["eta", DATE_MESSAGES.etaNeeded]]);
    expect(issues("eta", { sailedOn: "", eta: "2026-10-19" })).toEqual([["eta", DATE_MESSAGES.etaBeforeLoading]]);
    expect(issues("sail", { sailedOn: "2026-10-25", eta: "2026-10-24" })).toEqual([["eta", DATE_MESSAGES.etaBeforeSailing]]);
    // "Change ETA" doesn't show the sailing date, so the saved one (a planned departure) still counts.
    expect(issues("eta", { sailedOn: "", eta: "2026-10-30" }, { sailedOn: "2026-11-01" })).toEqual([["eta", DATE_MESSAGES.etaBeforeSailing]]);
    expect(issues("arrive", { sailedOn: "", eta: "" })).toEqual([]);
  });

  it("builds the CON-5 body: the status change and only the changed dates", () => {
    const saved = { sailedOn: "2026-10-26", eta: "2026-11-10" };
    expect(toUpdateBody("sail", saved, saved)).toEqual({ status: "sea", sailedOn: "2026-10-26" });
    expect(toUpdateBody("sail", { ...saved, eta: "2026-11-12" }, saved)).toEqual({ status: "sea", sailedOn: "2026-10-26", eta: "2026-11-12" });
    expect(toUpdateBody("arrive", { sailedOn: "x", eta: "y" }, saved)).toEqual({ status: "arrived" });
    expect(toUpdateBody("eta", { sailedOn: "2026-10-01", eta: "2026-11-12" }, saved)).toEqual({ eta: "2026-11-12" });
    expect(toUpdateBody("dates", { ...saved, sailedOn: "2026-10-25" }, saved)).toEqual({ sailedOn: "2026-10-25" });
    expect(toUpdateBody("dates", saved, saved)).toEqual({});
  });
});
