import type { Currency, MoneyTotal, RecordStatus } from "@/types/domain";

import type { LedgerAccount, LedgerEntry, PaymentRow, SettlementSlice } from "./ledger-types";
import type { ContainerState, ContainerTerms, MilestoneFields, OrderStage, SettlementFields, SupplierProfile, Unit } from "./types";

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
  /** The PO date, its value in `currency` and the rate saved on the order (null for older orders). Backend docs/report-downloads.md; absent from an older backend. */
  orderDate?: string;
  orderValueCny?: number;
  exchangeRate?: number | null;
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
  /** The supplier credits that settled the order (the ledger's FIFO slices), oldest first, each at its own rate; they add up to goodsInr. */
  goodsPayments: SettlementSlice[];
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
  /** `payableByCurrency`: Σ negative ledger balances as positive amounts, held left out. */
  payments: { dueNext30Cny: number; dueNext30ByCurrency: MoneyTotal[]; payableByCurrency: MoneyTotal[] };
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

/** Held accounts left out. `payableCny`: Σ negative balances as a positive amount; `availableCny`: Σ positive ones. */
type SupplierTotals = {
  orders: number;
  orderValueCny: number;
  settledCny: number;
  outstandingCny: number;
  balanceCny: number;
  payableCny: number;
  availableCny: number;
  paidInr: number;
};

/** One RPT-5 row: the open orders' value, settled and outstanding (FIFO projection) beside the ledger account. Null figures while held. */
export type SupplierPaymentsRow = {
  supplierId: string;
  supplier: string;
  currency: Currency;
  held: boolean;
  /** Open POs. */
  orders: string[];
  orderValueCny: number;
  settledCny: number | null;
  outstandingCny: number | null;
  creditsCny: number | null;
  /** The ledger balance, signed: + available with the supplier, − payable. */
  balanceCny: number | null;
  paidInr: number | null;
};

/**
 * GET /api/v1/reports/payments-per-supplier (backend docs/unified-ledger.md RPT-5): per supplier and currency, its open
 * orders (not closed) beside its ledger account. Without a period, accounts with a non-zero balance and no open order are
 * listed too.
 */
export type PaymentsPerSupplierReport = Report<{
  /** One row per supplier and currency (CNY, USD, INR, then order value, largest first). */
  suppliers: SupplierPaymentsRow[];
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
  supplier: { id: string; name: string; contactPerson: string; phone: string; status: RecordStatus; rateUpdatedAt: string | null } & SupplierProfile;
  filter: { from: string | null; to: string | null };
  summary: {
    orders: number;
    /** Of which stage < 6 (what the report row counts). */
    openOrders: number;
    /** Supplier payment records (paid + due): those on the orders in the period plus its orderless ones; voided included. */
    payments: number;
    lineItems: number;
    /** Distinct items on those lines. */
    products: number;
    /**
     * One entry per currency of the orders in the period (and, without a period, of its accounts), in CNY, USD, INR
     * order: the orders' value, settled and outstanding (FIFO projection) and the account's credits, signed balance and
     * payments' INR (whole account, never dated). Null figures while held.
     */
    byCurrency: {
      currency: Currency;
      held: boolean;
      orders: number;
      orderValueCny: number;
      settledCny: number | null;
      outstandingCny: number | null;
      creditsCny: number | null;
      balanceCny: number | null;
      paidInr: number | null;
    }[];
  };
  /** Newest first: coalesce(paidOn, dueDate) desc. Orderless included, voided flagged. */
  payments: Page<PaymentRow>;
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
  } & SettlementFields>;
  /** One row per order line, never merged across orders: order date desc, PO desc, line position asc. */
  lines: Page<{ orderLineId: string; orderId: string; po: string; itemId: string; item: string; unit: Unit; quantity: number; rateCny: number; amountCny: number; currency: Currency }>;
  /** The supplier's whole ledger (not limited to the period): its accounts and statement (newest first). */
  ledger: { accounts: LedgerAccount[]; entries: LedgerEntry[] };
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
  /** When the record behind the step was written (ISO timestamp); null when derived (closed) or not kept (sailed). */
  at: string | null;
  /** The user who wrote it; null when the record keeps no author. */
  by: string | null;
};

/** When a record was written and by whom (null when the row keeps none), and when it last changed. */
type Authored = { recordedAt: string | null; recordedBy: string | null; updatedAt: string | null; updatedBy: string | null };

/** An order-linked payment (legacy supplier memo rows and agent rows) and who recorded it (null when unknown). */
export type OrderReportPayment = PaymentRow & { recordedBy: string | null };

/** One China receipt of the order (REC-3), with this order's lines. */
export type OrderReportReceipt = {
  id: string;
  receivedOn: string;
  office: string;
  receivedBy: string;
  bundles: number;
  deliveryNote: string;
  shortRemark: string;
  recordedAt: string | null;
  lines: { item: string; unit: Unit; quantity: number }[];
};

/** A supplier-level deposit (migration 0008, a read-only archive) with its transactions, linked to no order. */
export type OrderReportDeposit = {
  id: string;
  direction: "give" | "receive";
  currency: Currency;
  /** The supplier's rate when the deposit was opened; null before migration 0012 or without a rate then. */
  exchangeRate: number | null;
  amount: number;
  settled: number;
  pending: number;
  status: "open" | "partly settled" | "settled";
  openedOn: string;
  reference: string;
  notes: string;
  transactions: { id: string; paidOn: string; amount: number; mode: string; reference: string; notes: string }[];
};

/**
 * The supplier's account beside the order: every order of the supplier per currency (settled and outstanding from the
 * FIFO projection, held accounts left out), its ledger accounts and statement (newest first), and the deposits archive.
 */
export type OrderReportSupplierAccount = {
  orders: number;
  openOrders: number;
  purchaseValue: MoneyTotal[];
  settled: MoneyTotal[];
  outstanding: MoneyTotal[];
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
  deposits: {
    summary: { currency: Currency; direction: "give" | "receive"; amount: number; settled: number; pending: number }[];
    list: OrderReportDeposit[];
  };
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
  etaEstimated: boolean;
  recordedAt: string | null;
  recordedBy: string | null;
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
    /** Information only: not part of the clearing cost. */
    goodsValueInr: number | null;
    customsDutyInr: number;
    otherDutiesInr: number;
    agentChargesInr: number;
    portChargesInr: number;
    totalInr: number;
  } & Authored | null;
  /** The container's road trip and its own totals; null without one or below `transport` View. */
  transport: {
    id: string;
    company: string;
    lrNumber: string;
    vehicleNumber: string;
    driverName: string;
    driverPhone: string;
    destination: string;
    loadedOn: string;
    loadedFrom: string;
    loadedBy: string;
    unloadedOn: string | null;
    bundlesLoaded: number;
    bundlesReceived: number | null;
    receivedBy: string;
    shortRemark: string;
    status: "on_road" | "unloaded";
    freightInr: number;
    handlingInr: number;
    totalInr: number;
  } & Authored | null;
};

/**
 * RPT-O1 GET /api/v1/orders/:po/report: everything the order's Report tab shows. A section is null when the user's
 * access to its capability is below View (payments, containers, warehouse, landedCost).
 */
export type OrderReport = {
  order: {
    id: string;
    po: string;
    /** The supplier's whole profile (backend docs/suppliers.md) as it is now; the order keeps its own currency. */
    supplier: Named & SupplierProfile & { contactPerson: string; phone: string; status: RecordStatus; rateUpdatedAt: string | null };
    orderDate: string;
    deliveryDate: string;
    createdAt: string | null;
    updatedAt: string | null;
    createdBy: string | null;
    stage: OrderStage;
    closed: boolean;
    closedOn: string | null;
    currency: Currency;
    orderValueCny: number;
    /** The rate saved when the order was placed (null for older orders) and the PO value at it, never at a later rate. */
    exchangeRate: number | null;
    orderValueInr: number | null;
    /** Distinct lines on the order. */
    products: number;
    /** One total per unit (pieces and metres are never added together); pending = max(0, ordered - received). */
    totals: { unit: Unit; ordered: number; received: number; pending: number; stocked: number }[];
  };
  /** excess = max(0, received - ordered), short = pending = max(0, ordered - received). */
  lines: {
    id: string;
    position: number;
    itemId: string;
    item: string;
    unit: Unit;
    ordered: number;
    received: number;
    excess: number;
    short: number;
    pending: number;
    loaded: number;
    stocked: number;
    rateCny: number;
    valueCny: number;
  }[];
  /**
   * The order's settlement (FIFO projection of its supplier's account) with the credits (`slices`) that settled it, the
   * Deposit Required milestone, agent payments (sea freight) and due supplier rows. `list`: the order-linked payments,
   * oldest first, voided flagged (they count in no figure).
   */
  payments: ({
    list: OrderReportPayment[];
    slices: SettlementSlice[];
    agentPaidCny: number;
    agentPaidInr: number;
    dueCny: number;
  } & SettlementFields &
    MilestoneFields) | null;
  /** The supplier's account (payments View): every order of the supplier and the account-level deposits; null below View. */
  supplierAccount: OrderReportSupplierAccount | null;
  /** The order's China receipts (receiving View), oldest first; null below View. */
  receipts: OrderReportReceipt[] | null;
  logistics: OrderReportContainer[] | null;
  /** Every warehouse receipt (draft or stocked) of a trip carrying the order's goods, with this order's pieces per team. */
  warehouse: ({
    receiptId: string;
    transportId: string;
    container: string;
    warehouse: string;
    receivedOn: string;
    receivedBy: string;
    status: "draft" | "stocked";
    bundlesReceived: number;
    lines: { item: string; unit: Unit; team: string; quantity: number }[];
  } & Authored)[] | null;
  /** loadLandedCosts' figures, unchanged. */
  landedCost: Omit<LandedCostRow, "po" | "supplier" | "currency" | "item" | "quantity" | "unit" | "terms" | "teams" | "goodsPayments"> | null;
  timeline: OrderTimelineStep[];
};

export type OrderState = "pending" | "active" | "closed";
export type PaymentState = "unpaid" | "partly" | "paid";

/**
 * One row of RPT-O2: settled, outstanding and payment status from the ledger's FIFO projection (value − settled =
 * outstanding, never negative; null while held or not posted), the Deposit Required milestone, and `paidInr` = goods
 * INR (settledInr) + agent INR.
 */
export type OrderReportRow = {
  id: string;
  po: string;
  orderDate: string;
  deliveryDate: string;
  stage: OrderStage;
  supplier: Named & { code: string };
  currency: Currency;
  /** The rate saved on the order (null for older orders) and the PO value at it; `paidInr` stays at each credit's own rate. */
  exchangeRate: number | null;
  orderValueInr: number | null;
  item: string;
  quantity: number;
  unit: Unit;
  received: number;
  stocked: number;
  /** Distinct lines, and the ordered quantity per unit over every line (never added across units). */
  lineCount: number;
  quantities: { unit: Unit; quantity: number }[];
  closed: boolean;
  closedOn: string | null;
  orderValueCny: number;
  agentPaidInr: number;
  paidInr: number | null;
  /** null while the order has no cost at all. */
  landedCostInr: number | null;
  perPieceInr: number | null;
} & SettlementFields &
  MilestoneFields;

/**
 * RPT-O2 GET /api/v1/reports/orders?po&supplierId&from&to&status&warehouseId&paymentStatus: every order (newest
 * first) matching the filters, the summary of those rows, the filters echoed by name and the page's select options.
 */
export type OrderReportsResponse = {
  rows: OrderReportRow[];
  summary: { orders: number; byCurrency: { currency: Currency; orderValueCny: number; settledCny: number; outstandingCny: number }[]; paidInr: number; landedCostInr: number };
  filter: {
    po: string | null;
    /** The supplier-name text filter, as typed. */
    supplierName: string | null;
    supplier: string | null;
    from: string | null;
    to: string | null;
    status: OrderState | null;
    stage: OrderStage | null;
    currency: Currency | null;
    warehouse: string | null;
    paymentStatus: PaymentState | null;
  };
  options: { suppliers: Named[]; warehouses: Named[] };
};
