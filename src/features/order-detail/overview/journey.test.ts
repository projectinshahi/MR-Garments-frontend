import { describe, expect, it } from "vitest";

import { journeySteps } from "./journey";

type Order = Parameters<typeof journeySteps>[0];
const receipt = { id: "r", receivedOn: "2026-08-26", office: "Guangzhou office", bundles: 50, deliveryNote: "", shortRemark: "", receivedBy: "Wang Fang", lines: [] };
const container = {
  id: "c",
  number: "CAIU 2298076",
  status: "loading" as const,
  terms: "CNF" as const,
  agent: { id: "a", name: "Sino Freight" },
  loadedOn: "2026-09-09",
  sailedOn: null,
  eta: "2026-09-28",
  lines: [],
};
const order: Order = { stage: 3, orderDate: "2026-08-05", receipts: [receipt], containers: [container] };

describe("journeySteps", () => {
  it("dates the stages ORD-4 records and marks the stages reached", () => {
    const steps = journeySteps(order);
    expect(steps.map((s) => s.lines)).toEqual([["5 Aug"], ["26 Aug", "Guangzhou office"], ["9 Sep", "CAIU 2298076 · Sino Freight"], [], [], []]);
    expect(steps.map((s) => s.marker)).toEqual(["dot", "dot", "dot", "ring", "ring", "ring"]);
    expect(steps[0]!.title).toBe("1. Order and deposit");
  });

  it("shows nothing it can't know: hidden sections and a new order", () => {
    const steps = journeySteps({ stage: 1, orderDate: "2026-10-20", receipts: null, containers: null });
    expect(steps.map((s) => s.lines)).toEqual([["20 Oct"], [], [], [], [], []]);
    expect(steps.map((s) => s.marker)).toEqual(["dot", "ring", "ring", "ring", "ring", "ring"]);
  });

  it("checks every step once the order is received in the warehouse", () => {
    expect(journeySteps({ ...order, stage: 6 }).every((s) => s.marker === "check")).toBe(true);
  });
});
