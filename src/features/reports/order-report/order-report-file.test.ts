import { describe, expect, it } from "vitest";

import type { OrderReport } from "@/lib/api/reports-types";

import { csvRows } from "../report-files";
import { landedCostBreakdown, orderReportFile, REPORT_SECTIONS } from "./order-report-file";

const TODAY = "2026-11-09";
const pay = {
  orderId: "o1",
  po: "MR/2026/001",
  supplierId: "s1",
  supplier: "Guangzhou Textile Co.",
  currency: "CNY" as const,
  payee: "Guangzhou Textile Co.",
  payeeRole: "supplier" as const,
  amountInr: null,
  paidOn: null,
  dueDate: null,
  rateInr: null,
  mode: null,
  reference: "",
  notes: "",
  recordedAt: "2026-10-11T05:00:00.000Z",
  recordedBy: null,
  voided: false,
  voidedAt: null,
  voidedBy: null,
  voidReason: "",
  held: false,
};
const authored = { recordedAt: null, recordedBy: null, updatedAt: null, updatedBy: null };

const report: OrderReport = {
  order: {
    id: "o1",
    po: "MR/2026/001",
    supplier: {
      id: "s1",
      name: "Guangzhou Textile Co.",
      code: "SUP-001",
      contactPerson: "Mr. Zhao Lin",
      phone: "",
      email: "",
      country: "China",
      city: "Guangzhou",
      state: "",
      postalCode: "",
      address: "",
      paymentTerms: "30% deposit",
      taxNumber: "",
      notes: "",
      currency: "CNY",
      exchangeRate: null,
      rateUpdatedAt: null,
      status: "Active",
    },
    orderDate: "2026-10-10",
    deliveryDate: "2026-11-19",
    createdAt: null,
    updatedAt: null,
    createdBy: null,
    stage: 6,
    closed: true,
    closedOn: "2026-11-05",
    currency: "CNY",
    orderValueCny: 1400,
    exchangeRate: null,
    orderValueInr: null,
    products: 2,
    totals: [
      { unit: "pcs", ordered: 100, received: 120, pending: 0, stocked: 100 },
      { unit: "m", ordered: 50, received: 30, pending: 20, stocked: 50 },
    ],
  },
  lines: [
    { id: "l1", position: 0, itemId: "i1", item: "Denim jeans", unit: "pcs", ordered: 100, received: 120, excess: 20, short: 0, pending: 0, loaded: 100, stocked: 100, rateCny: 10, valueCny: 1000 },
    { id: "l2", position: 1, itemId: "i2", item: "Cotton fabric", unit: "m", ordered: 50, received: 30, excess: 0, short: 20, pending: 20, loaded: 50, stocked: 50, rateCny: 8, valueCny: 400 },
  ],
  payments: {
    held: false,
    settledCny: 800,
    outstandingCny: 600,
    paymentStatus: "partly",
    settledInr: 9850,
    slices: [
      { entryId: "e1", entryType: "payment", paymentId: "p1", advanceEntryId: null, entryDate: "2026-10-11", amount: 300, exchangeRate: 12, amountInr: 3600, mode: "Bank", reference: "TXN-1", memoPo: "MR/2026/001" },
      { entryId: "e9", entryType: "payment", paymentId: "p9", advanceEntryId: null, entryDate: "2026-10-20", amount: 500, exchangeRate: 12.5, amountInr: 6250, mode: "Wire", reference: "UTR-9", memoPo: null },
    ],
    dueCny: 200,
    agentPaidCny: 0,
    agentPaidInr: 0,
    depositRequiredCny: 500,
    depositSettledCny: 800,
    depositPendingCny: 0,
    depositStatus: "met",
    list: [
      { ...pay, id: "p1", kind: "Deposit", amountCny: 300, amountInr: 3600, status: "paid", paidOn: "2026-10-11", rateInr: 12, mode: "Bank", reference: "TXN-1" },
      { ...pay, id: "p2", kind: "Balance", amountCny: 200, status: "due", dueDate: "2026-11-19" },
      // A second deposit still due: listed, never in the legacy deposits table (its total is paid money).
      { ...pay, id: "p3", kind: "Deposit", amountCny: 100, status: "due", dueDate: "2026-11-25" },
    ],
  },
  supplierAccount: {
    orders: 3,
    openOrders: 2,
    purchaseValue: [{ currency: "CNY", amount: 1801 }],
    settled: [{ currency: "CNY", amount: 1200 }],
    outstanding: [{ currency: "CNY", amount: 601 }],
    accounts: [
      { supplierId: "s1", currency: "CNY", held: false, creditsCny: 1200, debitsCny: 1801, balanceCny: -601, paidInr: 14850, paidInrComplete: true, outstandingCny: 601, openOrders: 2, lastPaymentOn: "2026-10-20" },
    ],
    entries: [
      {
        id: "e9",
        entryType: "payment",
        currency: "CNY",
        amount: 500,
        exchangeRate: 12.5,
        amountInr: 6250,
        entryDate: "2026-10-20",
        origin: "app",
        orderId: null,
        po: null,
        paymentId: "p9",
        advanceEntryId: null,
        reversesId: null,
        notes: null,
        balanceBefore: null,
        balanceAfter: null,
        runningBalance: -601,
        recordedAt: "2026-10-20T05:00:00.000Z",
        recordedBy: "Priya",
        payment: { kind: "Payment", payeeRole: "supplier", mode: "Wire", reference: "UTR-9", notes: "", memoPo: null, voided: false, voidedAt: null, voidedBy: null, voidReason: "" },
        advance: null,
      },
    ],
    deposits: {
      summary: [{ currency: "CNY", direction: "give", amount: 1000, settled: 400, pending: 600 }],
      list: [
        {
          id: "d1",
          direction: "give",
          currency: "CNY",
          exchangeRate: null,
          amount: 1000,
          settled: 400,
          pending: 600,
          status: "partly settled",
          openedOn: "2026-10-01",
          reference: "DEP-1",
          notes: "",
          transactions: [{ id: "t1", paidOn: "2026-10-02", amount: 400, mode: "Bank", reference: "DEP-1/1", notes: "" }],
        },
      ],
    },
  },
  receipts: [
    { id: "r1", receivedOn: "2026-10-18", office: "Guangzhou office", receivedBy: "Wang Fang", bundles: 3, deliveryNote: "DN-1", shortRemark: "", recordedAt: null, lines: [{ item: "Denim jeans", unit: "pcs", quantity: 120 }] },
  ],
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
      etaEstimated: false,
      recordedAt: null,
      recordedBy: null,
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
        goodsValueInr: 98000,
        customsDutyInr: 19600,
        otherDutiesInr: 14200,
        agentChargesInr: 1800,
        portChargesInr: 1450,
        totalInr: 37050,
        ...authored,
        recordedBy: "Anil Kumar",
      },
      transport: null,
    },
  ],
  warehouse: [
    { receiptId: "w1", transportId: "t1", container: "TCLU6000000", warehouse: "Main warehouse", receivedOn: "2026-11-05", receivedBy: "Joseph M", status: "stocked", bundlesReceived: 2, lines: [{ item: "Denim jeans", unit: "pcs", team: "Retail team", quantity: 100 }], ...authored },
    { receiptId: "w2", transportId: "t2", container: "TCLU6000001", warehouse: "Main warehouse", receivedOn: "2026-11-06", receivedBy: "Joseph M", status: "draft", bundlesReceived: 0, lines: [], ...authored },
  ],
  landedCost: { orderId: "o1", goodsInr: 9850, seaFreightInr: 0, clearingInr: 37050, transportInr: null, totalInr: 46900, stockedPieces: 150, perPieceInr: 312.67, final: false, waitingFor: "transport" },
  timeline: [
    { step: "created", on: "2026-10-10", detail: "Ordered from Guangzhou Textile Co.", at: null, by: null },
    { step: "dispatched", on: "2026-11-03", detail: "TCLU6000000 · KL 07 CD 4821 · LR LR-1", at: null, by: "Anil Kumar" },
    { step: "closed", on: "2026-11-05", detail: "Every container stocked", at: null, by: null },
  ],
};

const SHEETS = ["Order Overview", "Supplier Details", "Order Items", "China Receiving", "Shipping", "Customs", "Warehouse", "Payment History", "Deposit History", "Landed Cost", "Order Timeline"];

describe("order report file", () => {
  const file = orderReportFile(report, TODAY);
  const titled = (title: string) => file.sections.find((section) => section.title === title)!;

  it("is named after the PO (slashes become dashes) and spells out the order and supplier code in its filters line", () => {
    expect(file).toMatchObject({ title: "Order report MR/2026/001", filename: "order-report-MR-2026-001-2026-11-09" });
    expect(file.filters).toBe("Supplier: Guangzhou Textile Co. (SUP-001) · Ordered 10 Oct 2026 · 6. India warehouse · Closed on 5 Nov 2026");
  });

  it("puts each section on its sheet, one sheet per report section, in the page's order", () => {
    expect([...new Set(file.sections.map((section) => section.sheet))]).toEqual(SHEETS);
    expect(file.sections.map((section) => section.title)).toEqual([
      "Overview",
      "Quantities",
      "Supplier",
      "Supplier financial summary",
      "Supplier ledger accounts",
      "Statement (CNY)",
      "Items",
      "China receipts",
      "Containers",
      "Sea freight paid to shipping agents",
      "Clearing (container totals)",
      "Transport (container totals)",
      "Warehouse receipts",
      "Payment summary",
      "Settled by (supplier credits, oldest first)",
      "Payments recorded on this PO",
      "Legacy deposits recorded against this PO",
      "Supplier account deposits (not linked to this PO)",
      "Landed cost breakdown",
      "Landed cost",
      "Timeline",
    ]);
    // The page's section navigation covers the same ground, Documents included.
    expect(REPORT_SECTIONS.map((section) => section.label)).toEqual(["Overview", "Supplier", "Items", "China Processing", "Shipping", "Customs", "Warehouse", "Payments", "Deposits", "Landed Cost", "Timeline", "Documents"]);
  });

  it("writes the overview and supplier as Field/Value rows, the items with pending and excess, and the currency codes in the headers", () => {
    const rows = csvRows(file);
    expect(rows).toContainEqual(["Status", "Closed on 5 Nov 2026"]);
    expect(rows).toContainEqual(["Original PO value (CNY)", 1400]);
    expect(rows).toContainEqual(["Outstanding (CNY)", 600]);
    expect(rows).toContainEqual(["Payment status", "Partly paid"]);
    expect(rows).toContainEqual(["Supplier code", "SUP-001"]);
    expect(rows).toContainEqual(["Payment terms", "30% deposit"]);
    expect(rows).toContainEqual(["Email", "–"]);
    expect(rows).toContainEqual(["m", 50, 30, 20, 50]);
    const items = titled("Items");
    expect(items.columns.map((column) => column.header)).toEqual(["Sl. No.", "Item code", "Item", "Unit", "Quantity", "Received", "Pending", "Excess", "Loaded", "Stocked", "Rate (CNY)", "Amount (CNY)"]);
    expect(items.rows).toEqual([
      [1, null, "Denim jeans", "pcs", 100, 120, 0, 20, 100, 100, 10, 1000],
      [2, null, "Cotton fabric", "m", 50, 30, 20, 0, 50, 50, 8, 400],
    ]);
    expect(items.total?.at(-1)).toBe(1400);
  });

  it("keeps the supplier's account apart from the PO: every-order totals, the account deposit, and no utilisation claimed", () => {
    const summary = titled("Supplier financial summary").rows;
    expect(summary).toContainEqual(["Total purchase value with this supplier", "1,801.00 CNY"]);
    expect(summary).toContainEqual(["Supplier balance (ledger)", "CNY: Payable to supplier ¥601.00"]);
    expect(summary).toContainEqual(["Outstanding (every order)", "601.00 CNY"]);
    expect(summary).toContainEqual(["Outstanding for this PO (CNY)", 600]);
    expect(summary).toContainEqual(["Deposit utilised for this PO", "Not tracked: account deposits are not linked to orders"]);
    expect(titled("Legacy deposits recorded against this PO").rows).toEqual([["2026-10-11", null, "TXN-1", 300, 12, 3600, "Bank", "paid", ""]]);
    expect(titled("Legacy deposits recorded against this PO").total?.[3]).toBe(300);
    // The due deposit is listed, not a paid one.
    expect(titled("Payments recorded on this PO").rows).toHaveLength(3);
    // The supplier's statement (the ledger's own sections) sits on the Supplier Details sheet.
    expect(titled("Statement (CNY)")).toMatchObject({ sheet: "Supplier Details" });
    expect(titled("Statement (CNY)").rows[0]!.slice(0, 7)).toEqual(["2026-10-20", "Payment", null, 500, 12.5, 6250, -601]);
    expect(titled("Supplier account deposits (not linked to this PO)").rows).toEqual([["DEP-1", "To give", "2026-10-01", "CNY", null, 1000, 400, 600, "partly settled", "Not tracked", "", "2026-10-02", "DEP-1/1", "Bank", 400, ""]]);
  });

  it("lists the China receipts, the containers with arrival and author columns, a clearing row per container and no transport row without a trip", () => {
    expect(titled("China receipts").rows).toEqual([[1, "2026-10-18", "Guangzhou office", "Wang Fang", 3, "DN-1", "", "–", "Denim jeans", "pcs", 120]]);
    expect(titled("Containers").rows[0]).toEqual(["TCLU6000000", "Cleared", "CNF", "Sino Freight", "Nansha", "Kochi", "2026-10-20", "2026-10-20", "2026-10-28", "No", "2026-10-30", "Denim jeans: 100 pcs (2 bundles)", "–", "–"]);
    expect(titled("Sea freight paid to shipping agents").rows).toEqual([]);
    const [clearing] = titled("Clearing (container totals)").rows;
    expect(clearing!.slice(0, 15)).toEqual(["TCLU6000000", "Kochi Clearing Services", "2026-10-30", null, "BE-1", "2026-11-01", "2026-11-02", "Cleared", 98000, 19600, 14200, 1800, 1450, 37050, "Anil Kumar"]);
    expect(titled("Transport (container totals)").rows).toEqual([]);
  });

  it("gives a draft receipt without lines one row, the landed cost as components with their standing, and the timeline with who and when", () => {
    expect(titled("Warehouse receipts").rows).toEqual([
      ["TCLU6000000", "Main warehouse", "2026-11-05", "Joseph M", "Stocked", 2, "Denim jeans", "pcs", "Retail team", 100, "–", "–"],
      ["TCLU6000001", "Main warehouse", "2026-11-06", "Joseph M", "Draft", 0, null, null, null, null, "–", "–"],
    ]);
    const breakdown = titled("Landed cost breakdown").rows;
    expect(breakdown).toContainEqual(["International sea freight (payments to shipping agents)", 0, "Not applicable"]);
    expect(breakdown).toContainEqual(["Customs duty, other duties, agent and port charges (allocated share)", 37050, "Recorded"]);
    expect(breakdown).toContainEqual(["India transportation: freight, loading and unloading (allocated share)", null, "Missing"]);
    expect(breakdown).toContainEqual(["Insurance", null, "Not recorded in this system"]);
    expect(titled("Landed cost").rows).toContainEqual(["Status", "Estimate, waiting for transport"]);
    expect(titled("Landed cost").rows).toContainEqual(["Total additional expenses (INR)", 37050]);
    expect(titled("Timeline").rows).toEqual([
      ["Order placed", "2026-10-10", "Done", "Ordered from Guangzhou Textile Co.", "–", "–"],
      ["On the road", "2026-11-03", "Done", "TCLU6000000 · KL 07 CD 4821 · LR LR-1", "–", "Anil Kumar"],
      ["Order closed", "2026-11-05", "Done", "Every container stocked", "–", "–"],
    ]);
  });

  it("writes the settlement (the credits that settled the order) and the payments on this PO, the agent's sea freight apart", () => {
    const summary = titled("Payment summary").rows;
    expect(summary).toContainEqual(["Sea freight paid to agents (CNY)", 0]);
    expect(summary).toContainEqual(["Settled from the supplier's account (CNY)", 800]);
    expect(summary).toContainEqual(["Refunds and corrections", "Voids and Management adjustments on the supplier ledger (the statement on Supplier Details)"]);
    const settled = titled("Settled by (supplier credits, oldest first)");
    expect(settled.rows).toEqual([
      ["2026-10-11", "Payment", "TXN-1", "Bank", "MR/2026/001", 300, 12, 3600],
      ["2026-10-20", "Payment", "UTR-9", "Wire", null, 500, 12.5, 6250],
    ]);
    expect(settled.total).toEqual([null, "Settled", null, null, null, 800, null, 9850]);
    expect(titled("Payments recorded on this PO").rows[1]!.slice(0, -1)).toEqual([null, "", "Balance (legacy)", null, 200, "CNY", null, null, "Guangzhou Textile Co.", "supplier", "", "due", "2026-11-19", "–"]);
    // A voided payment is listed with its reason and counts nowhere.
    const voided = orderReportFile({ ...report, payments: { ...report.payments!, list: [{ ...report.payments!.list[0]!, voided: true, voidReason: "Duplicate" }] } }, TODAY);
    expect(voided.sections.find((s) => s.title === "Payments recorded on this PO")!.rows[0]![11]).toBe("voided: Duplicate");
    expect(voided.sections.find((s) => s.title === "Legacy deposits recorded against this PO")!.rows).toEqual([]);
  });

  it("adds the Deposit Required milestone (D11), with its standing, only when one was agreed", () => {
    const rows = csvRows(file);
    expect(rows).toContainEqual(["Deposit required (CNY)", 500]);
    expect(rows).toContainEqual(["Deposit pending (CNY)", 0]);
    expect(rows).toContainEqual(["Deposit milestone", "Deposit met"]);
    const none = csvRows(orderReportFile({ ...report, payments: { ...report.payments!, depositRequiredCny: null, depositPendingCny: null, depositStatus: "none" } }, TODAY));
    expect(none.filter((row) => String(row[0]).startsWith("Deposit required") || String(row[0]).startsWith("Deposit pending"))).toEqual([]);
  });

  it("writes a held account's order (pending review) with no settlement figures", () => {
    const held = { ...report.payments!, held: true, settledCny: null, outstandingCny: null, paymentStatus: null, settledInr: null, slices: [] };
    const rows = csvRows(orderReportFile({ ...report, payments: held }, TODAY));
    expect(rows).toContainEqual(["Payment status", "Opening balance pending review"]);
    expect(rows).toContainEqual(["Outstanding (CNY)", null]);
  });

  it("a held account's order: its payments listed as pending review, no due, sea freight or deposit total (pre-release audit M3)", () => {
    const list = report.payments!.list.map((p) => ({ ...p, held: true }));
    const held = { ...report.payments!, held: true, settledCny: null, outstandingCny: null, paymentStatus: null, settledInr: null, slices: [], agentPaidCny: null, agentPaidInr: null, dueCny: null, list };
    const heldFile = orderReportFile({ ...report, payments: held }, TODAY);
    const of = (title: string) => heldFile.sections.find((s) => s.title === title)!;
    expect(of("Payment summary").rows).toContainEqual(["Due (CNY)", null]);
    expect(of("Payment summary").rows).toContainEqual(["Sea freight paid to agents (CNY)", null]);
    expect(of("Payments recorded on this PO").rows[0]![11]).toBe("pending review");
    expect(of("Legacy deposits recorded against this PO").rows).toHaveLength(1); // listed as a record
    expect(of("Legacy deposits recorded against this PO").total?.[3]).toBeNull(); // counted nowhere
  });

  it("explains a CNF order's sea freight and marks the parts the records never hold", () => {
    const { components, additionalInr } = landedCostBreakdown(report.landedCost!, report.logistics);
    expect(components.map((component) => component.status)).toEqual(["recorded", "not tracked", "not tracked", "not tracked", "not applicable", "not tracked", "recorded", "not tracked", "missing", "not tracked", "not tracked"]);
    expect(additionalInr).toBe(37050);
    // An FOB order with agent payments: sea freight recorded; goods partly paid while a balance is outstanding.
    const fob = landedCostBreakdown({ ...report.landedCost!, seaFreightInr: 1200, waitingFor: "supplier payment" }, [{ ...report.logistics![0]!, terms: "FOB" }]);
    expect(fob.components[0]).toMatchObject({ inr: 9850, status: "partial" });
    expect(fob.components[4]).toMatchObject({ inr: 1200, status: "recorded" });
    // FOB with no agent payment yet: 0 is what the records hold (the engine never waits for sea freight), never "missing".
    expect(landedCostBreakdown(report.landedCost!, [{ ...report.logistics![0]!, terms: "FOB" }]).components[4]).toMatchObject({ inr: 0, status: "recorded" });
  });

  it("writes as PDF and Excel without a writer complaint, every section included", async () => {
    const { toPdf } = await import("../pdf");
    const { toXlsx } = await import("../xlsx");
    const pdf = Buffer.from(toPdf(file, "Generated now")).toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    for (const title of ["Supplier financial summary", "China receipts", "Payments recorded on this PO", "Landed cost breakdown", "Timeline"]) expect(pdf).toContain(`(${title}) Tj`);
    expect(pdf).toContain("Page 1 of");
    const xlsx = toXlsx(file, "Generated now");
    expect(xlsx.byteLength).toBeGreaterThan(1000);
  });

  it("leaves out the sections the API nulled", () => {
    const limited = orderReportFile({ ...report, payments: null, supplierAccount: null, receipts: null, logistics: null, warehouse: null, landedCost: null }, TODAY);
    expect([...new Set(limited.sections.map((section) => section.sheet))]).toEqual(["Order Overview", "Supplier Details", "Order Items", "Order Timeline"]);
  });
});
