import { describe, expect, it } from "vitest";

import { calendarFile } from "@/features/calendar/calendar-download";
import { clearingFile } from "@/features/clearing/clearing-files";
import { containersFile } from "@/features/containers/containers-files";
import type { ContainerRow } from "@/features/containers/containers-logic";
import { dashboardFile } from "@/features/dashboard/dashboard-files";
import { landedCostFile } from "@/features/landed-cost/landed-cost-files";
import type { LandedCostData, LandedCostRow } from "@/features/landed-cost/data/queries";
import type { OrderPaymentRow, Payment } from "@/features/payments/data/queries";
import { paymentsFile } from "@/features/payments/payment-files";
import type { ReceiptRow } from "@/features/receiving/data/queries";
import { receivingFile } from "@/features/receiving/receiving-files";
import { suppliersListFile } from "@/features/suppliers/supplier-files";
import { transportFile } from "@/features/transport/transport-files";
import { warehouseFile } from "@/features/warehouse/warehouse-files";
import type { ClearingListRow, TripListRow, WarehouseListRow } from "@/lib/api/stages-types";
import type { OrderListItem, PaymentsResponse, SupplierRow } from "@/lib/api/types";

import type { SupplierPaymentDetail } from "./data/queries";
import { toPdf } from "./pdf";
import { csvRows, type ReportFile, type Section } from "./report-files";
import { hubFile } from "./reports-hub";
import { supplierDetailFile } from "./supplier-detail-files";
import { toXlsx } from "./xlsx";

// The page report downloads (backend docs/report-downloads.md): each page's own file from the rows its filters keep.

const TODAY = "2026-11-12";
const titles = (file: ReportFile) => file.sections.map((s) => s.title);
/** Every file a test builds also goes through the three writers, so a cell a writer can't take fails here. */
const written = new Set<ReportFile>();
const write = (file: ReportFile) => {
  if (written.has(file)) return;
  written.add(file);
  expect(Buffer.from(toPdf(file, "Generated now")).toString("latin1").startsWith("%PDF-1.4"), file.title).toBe(true);
  expect(toXlsx(file, "Generated now").byteLength, file.title).toBeGreaterThan(1000);
  expect(csvRows(file).length, file.title).toBeGreaterThan(0);
};
const section = (file: ReportFile, title: string): Section => {
  write(file);
  const found = file.sections.find((s) => s.title === title);
  if (!found) throw new Error(`No section ${title}: ${titles(file).join(", ")}`);
  return found;
};
const headers = (s: Section) => s.columns.map((c) => c.header);
const column = (s: Section, header: string) => s.rows.map((row) => row[headers(s).indexOf(header)]);

describe("Deposits & Payments", () => {
  const order = (po: string, patch: Partial<OrderPaymentRow> = {}): OrderPaymentRow => ({
    orderId: po,
    po,
    supplier: "Foshan Fabrics",
    currency: "CNY",
    supplierRate: 12,
    orderValue: 1000,
    paid: 700,
    paidInr: 8400,
    supplierPaid: 500,
    supplierPaidInr: 6000,
    balance: 500,
    depositRequired: null,
    depositPaid: 0,
    depositPending: null,
    depositStatus: "none",
    nextDue: null,
    ...patch,
  });
  const payment = (id: string, patch: Partial<Payment>): Payment => ({
    id,
    orderId: "PO-1",
    po: "PO-1",
    currency: "CNY",
    kind: "Balance",
    payee: "Foshan Fabrics",
    payeeRole: "supplier",
    amountCny: 500,
    status: "paid",
    paidOn: "2026-11-01",
    dueDate: null,
    rateInr: 12,
    mode: "Wire",
    reference: "UTR 1",
    notes: "",
    amountInr: 6000,
    ...patch,
  });
  const payments = [
    payment("p1", {}),
    payment("p2", { payee: "Sino Freight", payeeRole: "agent", kind: "Deposit", amountCny: 200, amountInr: 2400 }),
    payment("p3", { po: "PO-2", amountCny: 90 }),
  ];

  it("keeps supplier and shipping-agent payments apart, each with its own rate and INR, for the orders the search keeps", () => {
    const file = paymentsFile([order("PO-1")], payments, "po-1", TODAY);
    expect(file.filters).toBe('Search: "po-1"');
    expect(titles(file)).toEqual(["Summary", "Payments by order (CNY)", "Supplier payments (CNY)", "Shipping-agent payments (CNY)"]);
    const supplier = section(file, "Supplier payments (CNY)");
    expect(column(supplier, "Reference")).toEqual(["UTR 1"]);
    expect(column(supplier, "Exchange rate (INR per 1 CNY)")).toEqual([12]);
    expect(supplier.total).toEqual(["Total", null, null, null, null, null, null, null, 500, null, 6000, null, null]);
    expect(column(section(file, "Shipping-agent payments (CNY)"), "Paid to (agent)")).toEqual(["Sino Freight"]);
    // PO-2 is not in the search: its payment is not in the file.
    expect(file.sections.flatMap((s) => s.rows).some((row) => row.includes("PO-2"))).toBe(false);
  });

  it("writes no agent sheet when no agent was paid", () => {
    expect(titles(paymentsFile([order("PO-1")], [payments[0]!], "", TODAY))).not.toContain("Shipping-agent payments (CNY)");
  });
});

describe("Receiving (China)", () => {
  const receipt: ReceiptRow = {
    id: "r1",
    receivedOn: "2026-11-02",
    orderId: "o1",
    po: "PO-1",
    supplier: "Foshan Fabrics",
    item: "Denim jeans",
    office: "Guangzhou office",
    ordered: 100,
    unit: "pcs",
    thisReceipt: 60,
    totalSoFar: 60,
    short: null,
    bundles: 3,
    receivedBy: "Wang Fang",
    state: "partly",
    statusLabel: "Partly received",
    received: "60 pcs Denim jeans",
    containers: [],
    lines: [
      { item: "Denim jeans", unit: "pcs", quantity: 60, ordered: 100, received: 60 },
      { item: "Cotton fabric", unit: "m", quantity: 45, ordered: 40, received: 45 },
    ],
    deliveryNote: "DN-1",
    shortRemark: "40 to follow",
  };
  const kpis = { month: "November", receiptsThisMonth: 1, receiptsSupplierCount: 1, waitingToBeReceived: null, partlyReceived: 1, partlyReceivedPos: ["PO-1"] };

  it("lists each receipt with its notes, and each line's shortage or excess against the order", () => {
    const file = receivingFile([receipt], kpis, "No filters", TODAY);
    expect(section(file, "Summary").rows).toContainEqual(["Waiting to be received", "Not in your access"]);
    const receipts = section(file, "Receipts");
    expect(column(receipts, "Short")).toEqual([40]);
    expect(column(receipts, "Delivery note")).toEqual(["DN-1"]);
    expect(column(receipts, "In containers")).toEqual(["None"]);
    const lines = section(file, "Received items");
    expect(lines.rows.map((row) => row.slice(3))).toEqual([
      ["Denim jeans", "pcs", 100, 60, 60, 40, 0],
      ["Cotton fabric", "m", 40, 45, 45, 0, 5],
    ]);
  });

  it("leaves the line's shortage blank when an older backend gave no ordered quantity", () => {
    const old = { ...receipt, lines: [{ item: "Denim jeans", unit: "pcs", quantity: 60, ordered: null, received: null }] };
    expect(section(receivingFile([old], kpis, "No filters", TODAY), "Received items").rows[0]!.slice(5)).toEqual([null, 60, null, null, null]);
  });
});

describe("Shipping (Containers)", () => {
  const container: ContainerRow = {
    id: "c1",
    number: "MSKU 1",
    agent: "Sino Freight",
    terms: "FOB",
    orders: [
      { po: "PO-1", part: false, supplier: "Foshan Fabrics" },
      { po: "PO-3", part: true, supplier: "Hangzhou Knits" },
    ],
    bundles: 5,
    loadedOn: "2026-10-01",
    sailedOn: "2026-10-02",
    etaIndia: "2026-10-30",
    etaEstimated: true,
    status: "sea",
    portOfLoading: "Nansha",
    portOfArrival: "Kochi",
  };
  const agentPayment = (po: string): PaymentsResponse["payments"][number] => ({
    id: po,
    orderId: po,
    po,
    currency: "CNY",
    kind: "Deposit",
    payee: "Sino Freight",
    payeeRole: "agent",
    amountCny: 300,
    status: "paid",
    paidOn: "2026-10-03",
    dueDate: null,
    rateInr: 12,
    mode: "Wire",
    reference: "",
    notes: "",
    amountInr: 3600,
  });

  it("lists containers, a row per PO, and the agent payments of those POs only", () => {
    const file = containersFile([container], "Status: Active", TODAY, [agentPayment("PO-1"), agentPayment("PO-9")]);
    expect(column(section(file, "Containers"), "Port of loading")).toEqual(["Nansha"]);
    expect(column(section(file, "Containers"), "POs")).toEqual(["PO-1, PO-3 (part)"]);
    expect(column(section(file, "POs per container"), "Supplier")).toEqual(["Foshan Fabrics", "Hangzhou Knits"]);
    expect(column(section(file, "Shipping-agent payments (CNY)"), "PO")).toEqual(["PO-1"]);
  });

  it("says so when the role can't view payments, instead of an empty sheet", () => {
    const file = containersFile([container], "Status: Active", TODAY, "denied");
    expect(titles(file)).not.toContain("Shipping-agent payments (CNY)");
    expect(file.notes).toContain("Shipping-agent payments are left out: they need Payments access.");
  });
});

describe("Clearing (India)", () => {
  const row = (number: string, patch: Partial<ClearingListRow> = {}): ClearingListRow => ({
    containerId: number,
    number,
    terms: "CNF",
    eta: "2026-10-20",
    agent: { id: "a1", name: "Kochi Clearing" },
    arrivedOn: "2026-10-21",
    handedOn: "2026-10-22",
    billOfEntry: "BE-1",
    dutyPaidOn: "2026-10-23",
    clearedOn: "2026-10-24",
    orders: ["PO-1"],
    status: "cleared",
    clearingCostInr: 37050,
    goodsValueInr: 98000,
    customsDutyInr: 19600,
    otherDutiesInr: 14200,
    agentChargesInr: 1800,
    portChargesInr: 1450,
    ...patch,
  });

  it("writes each charge apart and their total; a waiting container has none", () => {
    const waiting = row("C2", { status: "waiting", agent: null, arrivedOn: null, handedOn: null, clearedOn: null, dutyPaidOn: null, billOfEntry: "", clearingCostInr: 0, goodsValueInr: null, customsDutyInr: null, otherDutiesInr: null, agentChargesInr: null, portChargesInr: null });
    const file = clearingFile([row("C1"), waiting], { inClearingNow: 1, clearedLast30Days: 1, averageDaysToClear: 3, clearingCostLast30DaysInr: 37050 }, "No filters", TODAY);
    const table = section(file, "Clearing by container");
    expect(column(table, "Customs duty (INR)")).toEqual([19600, null]);
    expect(column(table, "Total recorded charges (INR)")).toEqual([37050, null]);
    expect(table.total!.slice(-7)).toEqual([98000, 19600, 14200, 1800, 1450, 37050, null]);
  });
});

describe("Transport", () => {
  const trip: TripListRow = {
    id: "t1",
    containerId: "c1",
    container: "MSKU 1",
    vehicleNumber: "KL 07",
    lrNumber: "LR-1",
    company: { id: "k1", name: "Kerala Roadways" },
    orders: ["PO-1"],
    bundlesLoaded: 4,
    loadedOn: "2026-11-01",
    unloadedOn: "2026-11-02",
    bundlesReceived: 3,
    status: "unloaded",
    costInr: 2650,
    freightInr: 2200,
    handlingInr: 450,
    destination: "Main warehouse",
    driverName: "Suresh P",
    shortRemark: "1 bundle wet",
    quantities: [
      { unit: "pcs", quantity: 100 },
      { unit: "m", quantity: 40 },
    ],
  };

  it("writes the trip's cost apart, its destination and its goods per unit", () => {
    const kpis = { onTheWay: 0, deliveredLast30Days: 1, bundlesDeliveredLast30Days: 3, shortLast30Days: 1, transportCostLast30DaysInr: 2650 };
    const file = transportFile([trip], { kpis, ready: [] }, "No filters", TODAY);
    const trips = section(file, "Trips");
    expect(column(trips, "Quantity transported")).toEqual(["100 pcs · 40 m"]);
    expect(column(trips, "Warehouse destination")).toEqual(["Main warehouse"]);
    expect(trips.total!.slice(-4)).toEqual([2200, 450, 2650, null]);
  });
});

describe("Warehouse", () => {
  const row = (id: string, receiptId: string, location: string, lines: WarehouseListRow["lines"]): WarehouseListRow => ({
    id,
    receiptId,
    transportId: "t1",
    receivedOn: "2026-11-03",
    receivedBy: "Joseph M",
    container: "MSKU 1",
    orderId: "o1",
    po: "PO-1",
    item: "Denim jeans",
    supplier: "Foshan Fabrics",
    location: { id: location, name: location === "w1" ? "Main warehouse" : "Second warehouse" },
    received: lines!.reduce((sum, l) => sum + l.quantity, 0),
    teams: { retail: lines!.reduce((sum, l) => sum + l.quantity, 0) },
    costPerPieceInr: 120,
    lrNumber: "LR-1",
    bundlesReceived: 3,
    bundlesLoaded: 4,
    shortRemark: "1 bundle wet",
    lines,
  });
  const first = row("r1:o1", "r1", "w1", [{ orderLineId: "l1", item: "Denim jeans", unit: "pcs", ordered: 100, quantity: 60 }]);
  const second = row("r2:o1", "r2", "w2", [{ orderLineId: "l1", item: "Denim jeans", unit: "pcs", ordered: 100, quantity: 30 }]);

  it("counts pending over every receipt of the line, even those filtered out, and the stock by item and warehouse", () => {
    const file = warehouseFile([first], [first, second], { teams: [{ id: "retail", name: "Retail team" }], ready: [] }, { showCosts: true, filters: "Warehouse: Main warehouse", today: TODAY });
    const items = section(file, "Received items");
    expect(column(items, "Stocked so far")).toEqual([90]);
    expect(column(items, "Pending")).toEqual([10]);
    expect(column(items, "Bundles short")).toEqual([1]);
    expect(column(items, "Landed cost per piece (INR)")).toEqual([120]);
    expect(section(file, "Stock by item and warehouse").rows).toEqual([["Main warehouse", "Denim jeans", "pcs", 60, 1]]);
    expect(section(file, "Pieces per team").total).toEqual(["Total", null, null, null, 60, 60]);
  });

  it("leaves the cost out for a role without landed cost", () => {
    const file = warehouseFile([first], [first], { teams: [], ready: [] }, { showCosts: false, filters: "", today: TODAY });
    expect(headers(section(file, "Received items"))).not.toContain("Landed cost per piece (INR)");
  });
});

describe("Landed Cost", () => {
  const order: LandedCostRow = {
    orderId: "o1",
    po: "PO-1",
    supplier: { id: "s1", name: "Foshan Fabrics" },
    currency: "CNY",
    item: "Denim jeans",
    quantity: 100,
    unit: "pcs",
    orderDate: "2026-10-01",
    orderValueCny: 1000,
    exchangeRate: 12.5,
    terms: "FOB",
    goodsInr: 12100,
    seaFreightInr: 2400,
    clearingInr: 3000,
    transportInr: 500,
    totalInr: 18000,
    stockedPieces: 100,
    perPieceInr: 180,
    final: true,
    waitingFor: null,
    teams: [{ teamId: "retail", team: "Retail team", pieces: 100, costInr: 18000 }],
    goodsPayments: [
      { id: "g1", orderId: "o1", kind: "Deposit", paidOn: "2026-10-02", amountCny: 400, rateInr: 12, amountInr: 4800 },
      { id: "g2", orderId: "o1", kind: "Balance", paidOn: "2026-10-20", amountCny: 600, rateInr: 12.1667, amountInr: 7300 },
    ],
  };
  const data: LandedCostData = {
    kpis: { finishedTotalInr: 18000, finishedPieces: 100, finishedPos: ["PO-1"], estimatePos: [], estimateWaitingFor: null },
    orders: [order],
    suppliers: [{ id: "s1", name: "Foshan Fabrics" }],
    teams: [{ id: "retail", name: "Retail team" }],
    teamId: null,
    supplierId: null,
  };

  it("writes the engine's figures as they are, with the PO at its saved rate beside them, never recomputed", () => {
    const table = section(landedCostFile(data, "No filters", TODAY), "Landed cost by order (CNY orders)");
    const value = (header: string) => column(table, header)[0];
    expect(value("PO value (CNY)")).toBe(1000);
    expect(value("Rate saved on order (INR per 1 CNY)")).toBe(12.5);
    expect(value("PO value at saved rate (INR)")).toBe(12500);
    expect(value("Goods (INR)")).toBe(12100);
    expect(value("Average payment rate (INR per 1 CNY)")).toBe(12.1);
    expect(value("Total landed cost (INR)")).toBe(18000);
    expect(value("Landed cost per piece (INR)")).toBe(180);
  });

  it("shows no INR PO value for an order placed before rates were saved", () => {
    const table = section(landedCostFile({ ...data, orders: [{ ...order, exchangeRate: null }] }, "No filters", TODAY), "Landed cost by order (CNY orders)");
    expect(column(table, "PO value at saved rate (INR)")).toEqual([null]);
  });
});

describe("Supplier list and supplier detail", () => {
  const supplier = {
    id: "s1",
    name: "Foshan Fabrics",
    contactPerson: "Mr. Chen",
    phone: "+86",
    status: "Active",
    code: "SUP-001",
    email: "",
    country: "China",
    city: "Foshan",
    state: "",
    postalCode: "",
    address: "",
    paymentTerms: "30 days",
    taxNumber: "",
    notes: "",
    currency: "CNY",
    exchangeRate: 12.0412,
    rateUpdatedAt: null,
  } as const;
  const row: SupplierRow = {
    ...supplier,
    openOrders: 1,
    openPos: 2,
    ytdValue: [
      { currency: "CNY", amount: 5000 },
      { currency: "USD", amount: 200 },
    ],
    balance: [{ currency: "CNY", amount: 1200 }],
    hasTransactions: true,
  };

  it("lists the profile with the current rate, and the amounts per currency as numbers, never added together", () => {
    const file = suppliersListFile([row], "Status: Active", TODAY);
    expect(column(section(file, "Supplier list"), "Purchase value (this year)")).toEqual(["CNY 5,000.00 · USD 200.00"]);
    expect(column(section(file, "Supplier list"), "Current exchange rate (INR per 1)")).toEqual([12.0412]);
    expect(section(file, "Purchases and balances (CNY)").rows).toEqual([["SUP-001", "Foshan Fabrics", 5000, 1200]]);
    expect(section(file, "Purchases and balances (USD)").rows).toEqual([["SUP-001", "Foshan Fabrics", 200, 0]]);
  });

  const page = (rows: number): SupplierPaymentDetail["orders"] => ({
    rows: Array.from({ length: rows }, (_, i) => ({
      id: `o${i}`,
      po: `PO-${i}`,
      orderDate: "2026-10-01",
      deliveryDate: "2026-11-01",
      stage: 1,
      currency: "CNY",
      quantities: [{ unit: "pcs", quantity: 10 }],
      quantity: 10,
      received: 0,
      unit: "pcs",
      orderValueCny: 100,
      paidCny: 0,
      balanceCny: 100,
    })),
    total: rows,
    page: 1,
    pageSize: 10,
  });
  const detail: SupplierPaymentDetail = {
    supplier,
    filter: { from: null, to: null },
    summary: { orders: 12, openOrders: 12, payments: 0, lineItems: 0, products: 0, byCurrency: [{ currency: "CNY", orders: 12, orderValueCny: 1200, paidCny: 0, paidInr: 0, depositsCny: 0, balanceCny: 1200 }] },
    payments: { rows: [], total: 0, page: 1, pageSize: 10 },
    orders: page(12),
    lines: { rows: [], total: 0, page: 1, pageSize: 10 },
  };

  it("holds every order of the supplier (more than one page), and says when deposits are not in the role's access", () => {
    const file = supplierDetailFile(detail, null, "Supplier: Foshan Fabrics", TODAY);
    expect(section(file, "Purchase orders (CNY)").rows).toHaveLength(12);
    expect(file.filename).toBe(`supplier-sup-001-${TODAY}`);
    expect(file.notes).toContain("Supplier deposits are left out: they need Payments access.");
    // The overview is a key-value block: Excel and PDF only.
    expect(csvRows(file)[0]).toEqual(["Purchase orders (CNY)"]);
  });
});

describe("Dashboard", () => {
  const order = (po: string, stage: OrderListItem["stage"], patch: Partial<OrderListItem> = {}): OrderListItem => ({
    id: po,
    po,
    orderDate: "2026-10-01",
    deliveryDate: "2026-12-01",
    stage,
    supplier: { id: "s1", name: "Foshan Fabrics" },
    currency: "CNY",
    exchangeRate: 12,
    item: "Denim jeans",
    quantity: 100,
    unit: "pcs",
    received: 0,
    stocked: 0,
    closed: false,
    closedOn: null,
    orderValueCny: 1000,
    paidCny: 400,
    supplierPaidCny: 300,
    supplierPaidInr: 3600,
    paidInr: 4800,
    depositRequiredCny: null,
    depositPaidCny: 0,
    depositPendingCny: null,
    depositStatus: "none",
    ...patch,
  });

  it("writes every row behind the cards and says which sources the role can't read", () => {
    const deliveries = Array.from({ length: 7 }, (_, i) => ({ orderId: `d${i}`, po: `PO-${i}`, supplier: "Foshan Fabrics", item: "Denim jeans", quantity: 10, unit: "pcs", received: 0, due: "2026-11-01" }));
    const file = dashboardFile({ orders: [order("PO-1", 2), order("PO-2", 6)], deliveries, payments: "denied", containers: "failed" }, TODAY);
    expect(section(file, "Late and upcoming deliveries").rows).toHaveLength(7);
    expect(section(file, "Summary").rows).toContainEqual(["Payments due in next 30 days", "Not in your access"]);
    expect(section(file, "Summary").rows).toContainEqual(["Containers on the way", "Could not be loaded"]);
    expect(section(file, "Summary").rows).toContainEqual(["Outstanding balance to suppliers", "CNY 1,400.00"]);
    expect(section(file, "Payments due").rows).toEqual([["Not in your access"]]);
    expect(section(file, "Supplier summary (CNY orders)").rows).toEqual([["Foshan Fabrics", 2, 1, 2000, 600, 1400]]);
  });
});

describe("Delivery calendar and the Reports hub", () => {
  it("calendar: the deliveries given, with the counts per status", () => {
    const file = calendarFile([{ po: "PO-1", supplier: "Foshan Fabrics", item: "Denim jeans", quantity: 10, unit: "pcs", due: "2026-11-01", status: "late", statusLabel: "11 days late" }], "Supplier: Foshan Fabrics", TODAY);
    expect(section(file, "Summary").rows).toContainEqual(["Late", 1]);
    expect(section(file, "Deliveries").rows).toEqual([["2026-11-01", "PO-1", "Foshan Fabrics", "Denim jeans", 10, "pcs", "11 days late"]]);
  });

  it("hub: its cards' figures, payments due per currency", () => {
    const file = hubFile(
      {
        filter: { from: "2026-10-01", to: "2026-10-31", supplier: null },
        suppliers: [],
        orders: { total: 4, atStage1: 1 },
        deliveries: { dueNext7: 2, late: 1 },
        receiving: { shortOrders: 1, shortPcs: 20, shortM: 0 },
        containers: { onTheWay: 1, arrivingIn7Days: 1 },
        payments: { dueNext30Cny: 500, dueNext30ByCurrency: [{ currency: "CNY", amount: 500 }] },
        landedCost: { finishedOrders: 1, finishedTotalInr: 18000 },
      },
      TODAY,
    );
    expect(file.filters).toBe("1 Oct – 31 Oct 2026");
    expect(section(file, "Reports summary").rows).toContainEqual(["Payments", "Due in next 30 days", "CNY 500.00"]);
  });
});
