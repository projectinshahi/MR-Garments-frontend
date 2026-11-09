import { describe, expect, it } from "vitest";

import type { OrderReport } from "@/lib/api/reports-types";

import { csvRows } from "../report-files";
import { orderReportFile } from "./order-report-file";

const TODAY = "2026-11-09";

const report: OrderReport = {
  order: {
    id: "o1",
    po: "MR/2026/001",
    supplier: { id: "s1", name: "Guangzhou Textile Co.", contactPerson: "Mr. Zhao Lin", phone: "", city: "Guangzhou" },
    orderDate: "2026-10-10",
    deliveryDate: "2026-11-19",
    stage: 6,
    closed: true,
    closedOn: "2026-11-05",
    currency: "CNY",
    orderValueCny: 1400,
    totals: [
      { unit: "pcs", ordered: 100, received: 120, stocked: 100 },
      { unit: "m", ordered: 50, received: 30, stocked: 50 },
    ],
  },
  lines: [
    { id: "l1", position: 0, item: "Denim jeans", unit: "pcs", ordered: 100, received: 120, excess: 20, short: 0, loaded: 100, stocked: 100, rateCny: 10, valueCny: 1000 },
    { id: "l2", position: 1, item: "Cotton fabric", unit: "m", ordered: 50, received: 30, excess: 0, short: 20, loaded: 50, stocked: 50, rateCny: 8, valueCny: 400 },
  ],
  payments: {
    paidCny: 800,
    paidInr: 9850,
    balanceCny: 600,
    depositsPaidCny: 300,
    dueCny: 200,
    depositRequiredCny: 500,
    depositPendingCny: 200,
    depositStatus: "partly",
    list: [
      { id: "p1", kind: "Deposit", payee: "Guangzhou Textile Co.", payeeRole: "supplier", amountCny: 300, amountInr: 3600, status: "paid", paidOn: "2026-10-11", dueDate: null, rateInr: 12, mode: "Bank", reference: "TXN-1", notes: "" },
      { id: "p2", kind: "Balance", payee: "Guangzhou Textile Co.", payeeRole: "supplier", amountCny: 200, amountInr: null, status: "due", paidOn: null, dueDate: "2026-11-19", rateInr: null, mode: null, reference: "", notes: "" },
    ],
  },
  logistics: [
    {
      id: "c1",
      number: "TCLU6000000",
      status: "arrived",
      terms: "CNF",
      agent: "Sino Freight",
      portOfLoading: "Nansha",
      portOfArrival: "Kochi",
      loadedOn: "2026-10-20",
      sailedOn: "2026-10-20",
      eta: "2026-10-28",
      lines: [{ orderLineId: "l1", item: "Denim jeans", unit: "pcs", bundles: 2, quantity: 100 }],
      clearing: {
        id: "cl1",
        agent: "Kochi Clearing Services",
        arrivedOn: "2026-10-30",
        handedOn: null,
        billOfEntry: "BE-1",
        dutyPaidOn: "2026-11-01",
        clearedOn: "2026-11-02",
        status: "cleared",
        customsDutyInr: 19600,
        otherDutiesInr: 14200,
        agentChargesInr: 1800,
        portChargesInr: 1450,
        totalInr: 37050,
      },
      transport: null,
    },
  ],
  warehouse: [
    { receiptId: "w1", transportId: "t1", container: "TCLU6000000", warehouse: "Main warehouse", receivedOn: "2026-11-05", receivedBy: "Joseph M", status: "stocked", bundlesReceived: 2, lines: [{ item: "Denim jeans", unit: "pcs", team: "Retail team", quantity: 100 }] },
    { receiptId: "w2", transportId: "t2", container: "TCLU6000001", warehouse: "Main warehouse", receivedOn: "2026-11-06", receivedBy: "Joseph M", status: "draft", bundlesReceived: 0, lines: [] },
  ],
  landedCost: { orderId: "o1", goodsInr: 9850, seaFreightInr: 0, clearingInr: 37050, transportInr: null, totalInr: 46900, stockedPieces: 150, perPieceInr: 312.67, final: false, waitingFor: "transport" },
  timeline: [
    { step: "created", on: "2026-10-10", detail: "Ordered from Guangzhou Textile Co." },
    { step: "dispatched", on: "2026-11-03", detail: "TCLU6000000 · KL 07 CD 4821 · LR LR-1" },
    { step: "closed", on: "2026-11-05", detail: "Every container stocked" },
  ],
};

describe("order report file", () => {
  const file = orderReportFile(report, TODAY);

  it("is named after the PO (slashes become dashes) and spells out the order in its filters line", () => {
    expect(file).toMatchObject({ title: "Order report MR/2026/001", filename: "order-report-MR-2026-001-2026-11-09" });
    expect(file.filters).toBe("Supplier: Guangzhou Textile Co. · Ordered 10 Oct 2026 · 6. India warehouse · Closed on 5 Nov 2026");
  });

  it("puts each section on its sheet, in the contract's order", () => {
    expect([...new Set(file.sections.map((section) => section.sheet))]).toEqual(["Order Summary", "Items", "Payments", "Logistics", "Warehouse", "Landed Cost", "Timeline"]);
    expect(file.sections.map((section) => section.title)).toEqual([
      "Overview",
      "Quantities",
      "Items",
      "Supplier payments",
      "Payments",
      "Containers",
      "Clearing (container totals)",
      "Transport (container totals)",
      "Warehouse receipts",
      "Landed cost",
      "Timeline",
    ]);
  });

  it("writes the overview as Field/Value rows, the items with excess and short, and the currency codes in the headers", () => {
    const rows = csvRows(file);
    expect(rows).toContainEqual(["Status", "Closed on 5 Nov 2026"]);
    expect(rows).toContainEqual(["Order value (CNY)", 1400]);
    expect(rows).toContainEqual(["Contact", "Mr. Zhao Lin"]);
    expect(rows).toContainEqual(["Phone", "–"]);
    expect(rows).toContainEqual(["m", 50, 30, 50]);
    const items = file.sections[2]!;
    expect(items.columns.map((column) => column.header)).toEqual(["#", "Item", "Unit", "Ordered", "Received", "Excess", "Short", "Loaded", "Stocked", "Rate (CNY)", "Value (CNY)"]);
    expect(items.rows).toEqual([
      [1, "Denim jeans", "pcs", 100, 120, 20, 0, 100, 100, 10, 1000],
      [2, "Cotton fabric", "m", 50, 30, 0, 20, 50, 50, 8, 400],
    ]);
    expect(items.total?.at(-1)).toBe(1400);
    expect(rows).toContainEqual(["Balance (CNY)", 600]);
    expect(rows).toContainEqual(["Balance", "Guangzhou Textile Co.", "supplier", 200, null, null, "due", null, "2026-11-19", null, "", ""]);
  });

  it("lists containers with this order's goods, a clearing row per cleared container and no transport row without a trip", () => {
    const [containers, clearing, transport] = file.sections.slice(5, 8);
    expect(containers!.rows[0]).toEqual(["TCLU6000000", "Cleared", "CNF", "Sino Freight", "Nansha", "Kochi", "2026-10-20", "2026-10-20", "2026-10-28", "Denim jeans: 100 pcs"]);
    expect(clearing!.rows).toEqual([["TCLU6000000", "Kochi Clearing Services", "2026-10-30", null, "BE-1", "2026-11-01", "2026-11-02", "Cleared", 19600, 14200, 1800, 1450, 37050]]);
    expect(transport!.rows).toEqual([]);
  });

  it("gives a draft receipt without lines one row, the landed cost as Field/Value and the timeline with step labels", () => {
    const warehouse = file.sections[8]!;
    expect(warehouse.rows).toEqual([
      ["TCLU6000000", "Main warehouse", "2026-11-05", "Joseph M", "Stocked", 2, "Denim jeans", "pcs", "Retail team", 100],
      ["TCLU6000001", "Main warehouse", "2026-11-06", "Joseph M", "Draft", 0, null, null, null, null],
    ]);
    expect(file.sections[9]!.rows).toContainEqual(["Status", "Estimate, waiting for transport"]);
    expect(file.sections[9]!.rows).toContainEqual(["Transport (INR)", null]);
    expect(file.sections[10]!.rows).toEqual([
      ["Order placed", "2026-10-10", "Ordered from Guangzhou Textile Co."],
      ["On the road", "2026-11-03", "TCLU6000000 · KL 07 CD 4821 · LR LR-1"],
      ["Order closed", "2026-11-05", "Every container stocked"],
    ]);
  });

  it("adds the deposit the supplier asked for, with its standing, only when one was agreed (0009)", () => {
    const rows = csvRows(file);
    expect(rows).toContainEqual(["Deposit required (CNY)", 500]);
    expect(rows).toContainEqual(["Deposit pending (CNY)", 200]);
    expect(rows).toContainEqual(["Deposit status", "Deposit partly paid"]);
    const none = csvRows(orderReportFile({ ...report, payments: { ...report.payments!, depositRequiredCny: null, depositPendingCny: null, depositStatus: "none" } }, TODAY));
    expect(none.filter((row) => String(row[0]).startsWith("Deposit "))).toEqual([]);
    expect(none).toContainEqual(["Deposits paid (CNY)", 300]);
    // An older RPT-O1 without the deposit fields: no deposit rows, nothing thrown.
    const older: Partial<NonNullable<OrderReport["payments"]>> = { ...report.payments! };
    delete older.depositRequiredCny;
    delete older.depositPendingCny;
    delete older.depositStatus;
    const legacy = csvRows(orderReportFile({ ...report, payments: older as OrderReport["payments"] }, TODAY));
    expect(legacy.filter((row) => String(row[0]).startsWith("Deposit "))).toEqual([]);
    expect(legacy).toContainEqual(["Deposits paid (CNY)", 300]);
  });

  it("leaves out the sections the API nulled", () => {
    const limited = orderReportFile({ ...report, payments: null, logistics: null, warehouse: null, landedCost: null }, TODAY);
    expect([...new Set(limited.sections.map((section) => section.sheet))]).toEqual(["Order Summary", "Items", "Timeline"]);
  });
});
