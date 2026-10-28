import { describe, expect, it } from "vitest";

import type { ClearingForm, ClearingListRow } from "@/lib/api/stages-types";

import { ALL, clearingState, clearingStatusLabel, clearingSteps, clearingTotal, clearingValues, filterClearings, timeAtPort, toClearingBody } from "./clearing-logic";
import { cleanAmount, formatExactINR, progressSteps, showAmount } from "./stage-form";

const row = (patch: Partial<ClearingListRow>): ClearingListRow => ({
  containerId: "c1",
  number: "CAIU 2298076",
  terms: "CNF",
  eta: "2026-09-27",
  agent: { id: "a1", name: "Kochi Clearing Services" },
  arrivedOn: "2026-09-28",
  handedOn: "2026-09-29",
  billOfEntry: "BE-7710482",
  dutyPaidOn: "2026-09-30",
  clearedOn: "2026-10-01",
  orders: ["PO-2028"],
  status: "cleared",
  clearingCostInr: 370500,
  ...patch,
});
const waiting = row({ containerId: "c2", number: "MEDU 4470912", agent: null, arrivedOn: null, handedOn: null, billOfEntry: "", dutyPaidOn: null, clearedOn: null, status: "waiting", clearingCostInr: 0, orders: ["PO-2034"] });
const notHanded = row({ containerId: "c3", handedOn: null, dutyPaidOn: null, clearedOn: null, status: "in_clearing" });
const duty = row({ containerId: "c4", number: "HLXU 9034471", agent: { id: "a2", name: "Southern Port Agents" }, dutyPaidOn: null, clearedOn: null, status: "in_clearing", orders: ["PO-2032", "PO-2033"] });
const dutyPaid = row({ containerId: "c5", clearedOn: null, status: "in_clearing" });

describe("clearing status", () => {
  it("waits for the agent until handed over, then for the duty, then is cleared", () => {
    expect([waiting, notHanded, duty, dutyPaid, row({})].map(clearingState)).toEqual(["waiting", "waiting", "duty", "duty", "cleared"]);
    expect([waiting, notHanded, duty, dutyPaid, row({})].map(clearingStatusLabel)).toEqual([
      "Waiting for agent",
      "Waiting for agent",
      "Duty to pay",
      "Duty paid 30 Sep",
      "Cleared 1 Oct",
    ]);
  });

  it("counts the time at port to the clearing, or to today while still there", () => {
    expect(timeAtPort(row({}), "2026-10-20")).toBe("3 days");
    expect(timeAtPort(row({ clearedOn: null }), "2026-09-29")).toBe("1 day");
    expect(timeAtPort(waiting, "2026-10-20")).toBe("–");
  });

  it("filters by chip, agent id and container or PO", () => {
    const rows = [row({}), waiting, duty];
    const all = { query: "", agent: ALL, state: ALL } as const;
    expect(filterClearings(rows, { ...all, state: "waiting" })).toEqual([waiting]);
    expect(filterClearings(rows, { ...all, state: "duty" })).toEqual([duty]);
    expect(filterClearings(rows, { ...all, agent: "a2" })).toEqual([duty]);
    expect(filterClearings(rows, { ...all, query: " po-2033" })).toEqual([duty]);
    expect(filterClearings(rows, { ...all, query: "medu" })).toEqual([waiting]);
  });
});

const form = (clearing: ClearingForm["clearing"], status: ClearingForm["container"]["status"] = "arrived"): ClearingForm => ({
  container: { id: "c1", number: "CAIU 2298076", status, terms: "CNF", loadedOn: "2026-09-01", eta: "2026-09-27" },
  clearing,
  goods: [],
  suppliers: ["Guangzhou Textile Co."],
  agents: [
    { id: "a1", name: "Kochi Clearing Services", contactPerson: "Mr. Anil Kumar", phone: "+91 98470 12345" },
    { id: "a2", name: "Southern Port Agents", contactPerson: "Mr. Rajesh Nair", phone: "+91 98950 44210" },
  ],
});
const saved: NonNullable<ClearingForm["clearing"]> = {
  id: "k1",
  clearingAgentId: "a1",
  arrivedOn: "2026-09-28",
  handedOn: "2026-09-29",
  billOfEntry: "BE-7710482",
  dutyPaidOn: null,
  clearedOn: null,
  goodsValueInr: 980000,
  customsDutyInr: 196000,
  otherDutiesInr: 142000,
  agentChargesInr: 18000,
  portChargesInr: 14500,
  status: "in_clearing",
};
const steps = (f: ClearingForm) => clearingSteps(f).map(({ title, marker, number, detail }) => [title, marker, number, detail]);

describe("clearing progress", () => {
  it("reproduces the reference from the saved draft: duty calculated, duty paid waiting", () => {
    expect(steps(form(saved))).toEqual([
      ["Arrived at port", "check", undefined, "28 Sep"],
      ["Handed to clearing agent", "check", undefined, "29 Sep · Kochi Clearing Services"],
      ["Duty calculated", "check", undefined, "₹3,70,500"],
      ["Duty paid", "current", 4, "Waiting"],
      ["Cleared from port", "pending", 5, undefined],
      ["Handed over to transport", "pending", 6, undefined],
    ]);
  });

  it("starts at the agent for an arrived container with nothing saved, and ends all done once cleared", () => {
    expect(steps(form(null)).map(([, marker]) => marker)).toEqual(["check", "current", "pending", "pending", "pending", "pending"]);
    expect(steps(form(null, "sea"))[0]).toEqual(["Arrived at port", "current", 1, "Waiting"]);
    const cleared = { ...saved, dutyPaidOn: "2026-09-30", clearedOn: "2026-10-01", status: "cleared" as const };
    expect(steps(form(cleared)).map(([, marker]) => marker)).toEqual(Array(6).fill("check"));
    expect(steps(form(cleared))[5]).toEqual(["Handed over to transport", "check", undefined, "1 Oct"]);
  });
});

describe("clearing form values", () => {
  it("starts a new clearing with the first agent, arriving on the ETA or today if that is earlier", () => {
    expect(clearingValues(form(null), "2026-10-05")).toMatchObject({ clearingAgentId: "a1", arrivedOn: "2026-09-27", customsDutyInr: "", goodsValueInr: "" });
    expect(clearingValues(form(null), "2026-09-20").arrivedOn).toBe("2026-09-20");
  });

  it("round-trips the saved clearing into the CLR-3 body: empty dates null, empty amounts 0, no goods value null", () => {
    const values = clearingValues(form(saved), "2026-10-05");
    expect(values).toMatchObject({ handedOn: "2026-09-29", dutyPaidOn: "", customsDutyInr: "196000", goodsValueInr: "980000" });
    expect(toClearingBody(values)).toEqual(Object.fromEntries(Object.entries(saved).filter(([key]) => key !== "id" && key !== "status")));
    expect(toClearingBody({ ...values, customsDutyInr: "", portChargesInr: "1450.5", goodsValueInr: "" })).toMatchObject({
      customsDutyInr: 0,
      portChargesInr: 1450.5,
      goodsValueInr: null,
    });
    expect(clearingTotal([{ amount: 196000 }, { amount: 142000 }, { amount: 18000 }, { amount: 14500 }])).toBe(370500);
  });
});

describe("stage form helpers", () => {
  it("keeps digits, one dot and 2 decimals in INR fields, shown with Indian grouping", () => {
    expect(["980000", "9,80,000", "1450.555", "12.3.4", "₹ 20,000.5", "abc", "."].map(cleanAmount)).toEqual(["980000", "980000", "1450.55", "12.34", "20000.5", "", "."]);
    expect(["980000", "1450.5", "1450.", "", "."].map(showAmount)).toEqual(["9,80,000", "1,450.5", "1,450.", "", "0."]);
    expect([370500, 1450.5, 0.1 + 0.2].map(formatExactINR)).toEqual(["₹3,70,500", "₹1,450.50", "₹0.30"]);
  });

  it("numbers open steps by position and marks only the first as current", () => {
    expect(progressSteps([{ title: "A", done: false }, { title: "B", done: true, detail: "x" }, { title: "C", done: false, detail: "y" }])).toEqual([
      { title: "A", marker: "current", number: 1, detail: "Waiting" },
      { title: "B", marker: "check", detail: "x" },
      { title: "C", marker: "pending", number: 3, detail: "y" },
    ]);
  });
});
