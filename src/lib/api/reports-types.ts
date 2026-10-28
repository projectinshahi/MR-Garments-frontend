import type { ContainerState, ContainerTerms, PaymentKind, Unit } from "./types";

// Landed cost and Reports (backend docs/wave3-contracts.md sections 6.4, 7 and 8). Owner: A6. INR amounts have 2
// decimals; dates are YYYY-MM-DD; months YYYY-MM.

type Named = { id: string; name: string };

export type WaitingFor = "supplier payment" | "duty" | "transport" | "warehouse";

/** One order with any cost so far: loadLandedCosts' figures plus what the Landed Cost screen shows around them. */
export type LandedCostRow = {
  orderId: string;
  po: string;
  supplier: Named;
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
  payments: { dueNext30Cny: number };
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
  shortValueCny: number;
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

/** GET /api/v1/reports/payments-per-supplier: open orders (stage below 6), supplier payments only. */
export type PaymentsPerSupplierReport = Report<{
  suppliers: { supplierId: string; supplier: string; orders: string[]; orderValueCny: number; paidCny: number; paidInr: number; balanceCny: number }[];
  totals: { orders: number; orderValueCny: number; paidCny: number; paidInr: number; balanceCny: number };
  dueNext30Cny: number;
  finishedPos: string[];
}>;

/** GET /api/v1/reports/landed-cost-by-month: finished orders by the month they were stocked. */
export type LandedCostByMonthReport = Report<{
  months: { month: string; pieces: number; landedCostInr: number; perPieceInr: number | null; soFar: boolean }[];
  totals: { orders: number; pieces: number; landedCostInr: number; perPieceInr: number | null };
  biggest: { month: string; landedCostInr: number } | null;
}>;
