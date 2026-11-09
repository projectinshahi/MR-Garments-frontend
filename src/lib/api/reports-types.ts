import type { Currency, MoneyTotal, RecordStatus } from "@/types/domain";

import type { ContainerState, ContainerTerms, DepositStatus, OrderStage, PaymentKind, Unit } from "./types";

// Landed cost and Reports (backend docs/wave3-contracts.md sections 6.4, 7 and 8). Owner: A6. INR amounts have 2
// decimals; dates are YYYY-MM-DD; months YYYY-MM. Order-currency amounts (...Cny) come with their `currency`, and their
// totals one per currency (`MoneyTotal[]`): amounts in different currencies are never added together.

type Named = { id: string; name: string };

export type WaitingFor = "supplier payment" | "duty" | "transport" | "warehouse";

/** One order with any cost so far: loadLandedCosts' figures plus what the Landed Cost screen shows around them. */
export type LandedCostRow = {
  orderId: string;
  po: string;
  supplier: Named;
  /** The order's: the currency of `goodsPayments[].amountCny`. Every other amount here is INR. */
  currency: Currency;
  /** Main line (position 0). */
  item: string;
  quantity: number;
  unit: Unit;
  /** The terms of every container carrying the order; "mixed" when they differ, null before loading. */
  terms: ContainerTerms | "mixed" | null;
  goodsInr: number;
  /** 0 when every container carrying the order is CNF. */
  seaFreightInr: number;
  /** null until a container of the order has a clearing / a trip. */
  clearingInr: number | null;
  transportInr: number | null;
  totalInr: number;
  stockedPieces: number;
  /** null while nothing is stocked. */
  perPieceInr: number | null;
  final: boolean;
  /** The first missing part; null when final. */
  waitingFor: WaitingFor | null;
  /** Stocked pieces per team (team creation order); costInr = pieces x perPieceInr. */
  teams: { teamId: string; team: string; pieces: number; costInr: number }[];
  /** Paid payments to the supplier, oldest first; amountInr = round2(amountCny x rateInr). */
  goodsPayments: { id: string; orderId: string; kind: PaymentKind; paidOn: string; amountCny: number; rateInr: number; amountInr: number }[];
};

/** GET /api/v1/landed-cost?supplierId=&teamId= (both optional uuids; teamId keeps orders with stock for that team). */
export type LandedCostResponse = {
  kpis: {
    finishedTotalInr: number;
    finishedPieces: number;
    finishedPos: string[];
    estimatePos: string[];
    /** What every estimate waits for; null when they differ or there are none. */
    estimateWaitingFor: WaitingFor | null;
  };
  /** Newest order first. */
  orders: LandedCostRow[];
  /** Active, for the header filters. */
  suppliers: Named[];
  teams: Named[];
};

/** Every report echoes its filters; `supplier` is the supplier's name (null when not filtered or unknown). */
type Report<T> = T & { filter: { from: string | null; to: string | null; supplier: string | null } };

/** GET /api/v1/reports/summary: the hub's stat strips. */
export type ReportsSummary = Report<{
  /** Active, for the hub's supplier filter. */
  suppliers: Named[];
  orders: { total: number; atStage1: number };
  deliveries: { dueNext7: number; late: number };
  receiving: { shortOrders: number; shortPcs: number; shortM: number };
  containers: { onTheWay: number; arrivingIn7Days: number };
  payments: { dueNext30Cny: number; dueNext30ByCurrency: MoneyTotal[] };
  landedCost: { finishedOrders: number; finishedTotalInr: number };
}>;

/** GET /api/v1/reports/order-status */
export type OrderStatusReport = Report<{
  total: number;
  /** Orders at stages 1-6, in that order. */
  stageCounts: number[];
  /** Stage 1-2 orders past their delivery date, oldest due first. */
  late: { orderId: string; po: string; supplier: string; due: string; lateDays: number }[];
  finishedThisMonth: number;
  /** Order date to reaching the warehouse, whole days; null when no order has finished. */
  averageOrderDays: number | null;
}>;

/** GET /api/v1/reports/deliveries-per-day: today and the 13 days after. */
export type DeliveriesPerDayReport = Report<{
  from: string;
  to: string;
  days: { date: string; count: number }[];
  dueNext7: number;
  suppliersNext7: number;
  dueNext14: number;
  busiest: { dates: string[]; count: number } | null;
  daysWithNone: number;
  late: number;
}>;

/** GET /api/v1/reports/ordered-vs-received: every line of every order with a receipt in China. */
export type OrderedVsReceivedReport = Report<{
  lines: {
    orderLineId: string;
    orderId: string;
    po: string;
    supplier: string;
    currency: Currency;
    item: string;
    unit: Unit;
    ordered: number;
    received: number;
    short: number;
    /** short x rateCny; null when nothing is short. */
    shortValueCny: number | null;
  }[];
  ordersChecked: number;
  shortPos: string[];
  /** CNY lines only (older frontends); use shortValueByCurrency. */
  shortValueCny: number;
  shortValueByCurrency: MoneyTotal[];
  fullOrders: number;
}>;

/** GET /api/v1/reports/containers-timeline: containers overlapping the window `from`-`to` (inclusive). */
export type ContainersTimelineReport = Report<{
  from: string;
  to: string;
  containers: { id: string; number: string; status: ContainerState; loadedOn: string; arrival: string }[];
  /** Loading or at sea. */
  active: number;
  arrivingIn7Days: string[];
  averageSeaDays: number | null;
  nextArrival: { date: string; number: string } | null;
}>;

type SupplierTotals = { orders: number; orderValueCny: number; paidCny: number; paidInr: number; balanceCny: number };

/** GET /api/v1/reports/payments-per-supplier: open orders (stage below 6), supplier payments only. */
export type PaymentsPerSupplierReport = Report<{
  /** One row per supplier and order currency (CNY, USD, INR, then order value, largest first). */
  suppliers: { supplierId: string; supplier: string; currency: Currency; orders: string[]; orderValueCny: number; paidCny: number; paidInr: number; balanceCny: number }[];
  /** CNY orders only (older frontends); use totalsByCurrency. */
  totals: SupplierTotals;
  totalsByCurrency: (SupplierTotals & { currency: Currency })[];
  /** CNY only; use dueNext30ByCurrency. */
  dueNext30Cny: number;
  dueNext30ByCurrency: MoneyTotal[];
  finishedPos: string[];
}>;

/** One page of a list, 10 rows; a page past the end has no rows and the real total. */
type Page<T> = { rows: T[]; total: number; page: number; pageSize: 10 };

/**
 * GET /api/v1/reports/payments-per-supplier/:supplierId (docs/supplier-payment-detail-contract.md): one supplier's
 * orders in the period (every stage), their supplier payments and lines. `?from&to` (the period) filter everything;
 * `?paymentFrom&paymentTo` the payments, `?stage` the orders, `?paymentsPage&ordersPage&linesPage` each list's page.
 * The summary ignores all but the period. Amounts are in each order's currency (`...Cny` is the legacy name).
 */
export type SupplierPaymentDetail = {
  supplier: { id: string; name: string; contactPerson: string; phone: string; city: string; address: string; currency: Currency; status: RecordStatus };
  filter: { from: string | null; to: string | null };
  summary: {
    orders: number;
    /** Of which stage < 6 (what the report row counts). */
    openOrders: number;
    /** Supplier payment records (paid + due) on those orders. */
    payments: number;
    lineItems: number;
    /** Distinct items on those lines. */
    products: number;
    /** One entry per order currency present, in CNY, USD, INR order. Empty when there are no orders. Deposits are part of paid. */
    byCurrency: { currency: Currency; orders: number; orderValueCny: number; paidCny: number; paidInr: number; depositsCny: number; balanceCny: number }[];
  };
  /** Newest first: coalesce(paidOn, dueDate) desc. */
  payments: Page<{
    id: string;
    orderId: string;
    po: string;
    currency: Currency;
    kind: PaymentKind;
    status: "paid" | "due";
    paidOn: string | null;
    dueDate: string | null;
    amountCny: number;
    rateInr: number | null;
    /** null when due. */
    amountInr: number | null;
    mode: string | null;
  }>;
  /** Newest first: order date desc, PO desc. */
  orders: Page<{
    id: string;
    po: string;
    orderDate: string;
    deliveryDate: string;
    stage: OrderStage;
    currency: Currency;
    /** Sum of line quantities per unit, pcs first then m (never add pcs and m). */
    quantities: { unit: Unit; quantity: number }[];
    /** Main line (position 0), for the status label. */
    quantity: number;
    received: number;
    unit: Unit;
    orderValueCny: number;
    paidCny: number;
    balanceCny: number;
  }>;
  /** One row per order line, never merged across orders: order date desc, PO desc, line position asc. */
  lines: Page<{ orderLineId: string; orderId: string; po: string; itemId: string; item: string; unit: Unit; quantity: number; rateCny: number; amountCny: number; currency: Currency }>;
};

/** GET /api/v1/reports/landed-cost-by-month: finished orders by the month they were stocked. */
export type LandedCostByMonthReport = Report<{
  months: { month: string; pieces: number; landedCostInr: number; perPieceInr: number | null; soFar: boolean }[];
  totals: { orders: number; pieces: number; landedCostInr: number; perPieceInr: number | null };
  biggest: { month: string; landedCostInr: number } | null;
}>;

// Phase 2 (backend docs/phase2-contracts.md sections 4 and 8.R). Owner: Agent R.

/** The dated steps of an order's timeline, in date order; only the steps of sections the user may see. */
export type OrderTimelineStep = {
  step: "created" | "deposit" | "payment" | "received" | "loaded" | "sailed" | "arrived" | "cleared" | "dispatched" | "unloaded" | "stocked" | "closed";
  on: string;
  detail: string;
};

export type OrderReportPayment = {
  id: string;
  kind: PaymentKind;
  payee: string;
  payeeRole: "supplier" | "agent";
  amountCny: number;
  /** round2(amountCny x rateInr) when paid; null when due. */
  amountInr: number | null;
  status: "paid" | "due";
  paidOn: string | null;
  dueDate: string | null;
  rateInr: number | null;
  mode: string | null;
  reference: string;
  notes: string;
};

export type OrderReportContainer = {
  id: string;
  number: string;
  status: ContainerState;
  terms: ContainerTerms;
  agent: string;
  portOfLoading: string;
  portOfArrival: string;
  loadedOn: string | null;
  sailedOn: string | null;
  eta: string;
  /** This order's lines only. */
  lines: { orderLineId: string; item: string; unit: Unit; bundles: number; quantity: number }[];
  /** The container's clearing and its own totals; null without one or below `clearing` View. */
  clearing: {
    id: string;
    agent: string;
    arrivedOn: string;
    handedOn: string | null;
    billOfEntry: string;
    dutyPaidOn: string | null;
    clearedOn: string | null;
    status: "in_clearing" | "cleared";
    customsDutyInr: number;
    otherDutiesInr: number;
    agentChargesInr: number;
    portChargesInr: number;
    totalInr: number;
  } | null;
  /** The container's road trip and its own totals; null without one or below `transport` View. */
  transport: {
    id: string;
    company: string;
    lrNumber: string;
    vehicleNumber: string;
    driverName: string;
    destination: string;
    loadedOn: string;
    unloadedOn: string | null;
    bundlesLoaded: number;
    bundlesReceived: number | null;
    status: "on_road" | "unloaded";
    freightInr: number;
    handlingInr: number;
    totalInr: number;
  } | null;
};

/**
 * RPT-O1 GET /api/v1/orders/:po/report: everything the order's Report tab shows. A section is null when the user's
 * access to its capability is below View (payments, containers, warehouse, landedCost).
 */
export type OrderReport = {
  order: {
    id: string;
    po: string;
    supplier: { id: string; name: string; contactPerson: string; phone: string; city: string };
    orderDate: string;
    deliveryDate: string;
    stage: OrderStage;
    closed: boolean;
    closedOn: string | null;
    currency: Currency;
    orderValueCny: number;
    /** One total per unit (pieces and metres are never added together). */
    totals: { unit: Unit; ordered: number; received: number; stocked: number }[];
  };
  /** excess = max(0, received - ordered), short = max(0, ordered - received). */
  lines: { id: string; position: number; item: string; unit: Unit; ordered: number; received: number; excess: number; short: number; loaded: number; stocked: number; rateCny: number; valueCny: number }[];
  /** Paid, balance, deposits and due count supplier payments only; `list` is every payment, oldest first. */
  payments: {
    paidCny: number;
    paidInr: number;
    balanceCny: number;
    depositsPaidCny: number;
    dueCny: number;
    /** The deposit the supplier asked for (0009) and what is still pending against it; null / "none" when none was agreed. */
    depositRequiredCny: number | null;
    depositPendingCny: number | null;
    depositStatus: DepositStatus;
    list: OrderReportPayment[];
  } | null;
  logistics: OrderReportContainer[] | null;
  /** Every warehouse receipt (draft or stocked) of a trip carrying the order's goods, with this order's pieces per team. */
  warehouse: { receiptId: string; transportId: string; container: string; warehouse: string; receivedOn: string; receivedBy: string; status: "draft" | "stocked"; bundlesReceived: number; lines: { item: string; unit: Unit; team: string; quantity: number }[] }[] | null;
  /** loadLandedCosts' figures, unchanged. */
  landedCost: Omit<LandedCostRow, "po" | "supplier" | "currency" | "item" | "quantity" | "unit" | "terms" | "teams" | "goodsPayments"> | null;
  timeline: OrderTimelineStep[];
};

export type OrderState = "pending" | "active" | "closed";
export type PaymentState = "unpaid" | "partly" | "paid";

/** One row of RPT-O2: the ORD-1 figures with paid and balance counting supplier payments only. */
export type OrderReportRow = {
  id: string;
  po: string;
  orderDate: string;
  deliveryDate: string;
  stage: OrderStage;
  supplier: Named;
  currency: Currency;
  item: string;
  quantity: number;
  unit: Unit;
  received: number;
  stocked: number;
  closed: boolean;
  closedOn: string | null;
  orderValueCny: number;
  paidCny: number;
  paidInr: number;
  balanceCny: number;
  paymentStatus: PaymentState;
  /** null while the order has no cost at all. */
  landedCostInr: number | null;
  perPieceInr: number | null;
};

/**
 * RPT-O2 GET /api/v1/reports/orders?po&supplierId&from&to&status&warehouseId&paymentStatus: every order (newest
 * first) matching the filters, the summary of those rows, the filters echoed by name and the page's select options.
 */
export type OrderReportsResponse = {
  rows: OrderReportRow[];
  summary: { orders: number; byCurrency: { currency: Currency; orderValueCny: number; paidCny: number; balanceCny: number }[]; paidInr: number; landedCostInr: number };
  filter: { po: string | null; supplier: string | null; from: string | null; to: string | null; status: OrderState | null; warehouse: string | null; paymentStatus: PaymentState | null };
  options: { suppliers: Named[]; warehouses: Named[] };
};
