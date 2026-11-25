import type { LedgerAccount, PaymentRow } from "./ledger-types";
import type { DollarCostTotal, SupplierOrderRow } from "./reports-types";
import type { Currency } from "@/types/domain";

// Supplier Full History (backend docs/supplier-history.md): SH-1..SH-6 for the supplier profile's tabs and RPT-SH for the
// Supplier History report. Read-only; Management only.

export type HistorySupplier = { id: string; name: string; code: string; status: string };
export type Paged<T> = { rows: T[]; page: number; pageSize: number; total: number };

/** SH-1 GET /suppliers/:id/history: live accounts apart from the historical totals per currency. */
/** SH-0: every history tab's header (SH-1's supplier, live accounts and holds). */
export type SupplierHistoryHeader = Pick<SupplierHistoryOverview, "supplier" | "accounts" | "holds">;

export type SupplierHistoryOverview = {
  supplier: HistorySupplier & {
    currency: Currency;
    exchangeRate: number | null;
    rateUpdatedAt: string | null;
    contactPerson: string;
    phone: string;
    email: string;
    country: string;
    city: string;
    paymentTerms: string;
    createdAt: string;
  };
  accounts: Omit<LedgerAccount, "entries">[];
  holds: { currency: Currency; reason: string; since: string }[];
  totals: {
    currency: Currency;
    held: boolean;
    orders: number;
    poValue: number;
    orderValue: number;
    settled: number;
    outstanding: number;
    /** Payments recorded less their voids (null while held). */
    paymentsActive: number | null;
    paymentsRecorded: number;
    paymentsVoided: number;
    adjustments: number | null;
  }[];
  dollarCost: DollarCostTotal;
  landedCostInr: number;
  activity: { first: string | null; last: string | null };
  counts: { orders: number; receipts: number; agentPayments: number };
};

/** SH-2: RPT-S1's rows of the supplier, with when the landed cost became final and protected. */
export type HistoryOrdersResponse = {
  supplier: HistorySupplier;
  orders: Paged<SupplierOrderRow & { protectedAt: string | null }>;
  byCurrency: { currency: Currency; orderValueCny: number; poValueCny: number; settledCny: number; outstandingCny: number }[];
  dollarCost: DollarCostTotal;
};

export type HistoryPayment = PaymentRow & {
  source: "payment" | "advance";
  recordedBy: string | null;
  /** Posted by the 2026-11-23 cutover: recorded then, not when paid. */
  migrated: boolean;
  ledgerCredit: number | null;
  ledgerVoid: number | null;
  /** The live FIFO projection's orders this credit settles now (derived, not a stored allocation). */
  settlesNow: { po: string; amount: number }[];
};
export type HistoryPaymentsResponse = {
  supplier: HistorySupplier;
  payments: Paged<HistoryPayment>;
  totals: { currency: Currency; active: number; count: number; voided: number }[];
};

export type HistoryReceipt = {
  id: string;
  orderId: string;
  po: string;
  currency: Currency;
  receivedOn: string;
  location: string;
  receivedBy: string | null;
  bundles: number;
  deliveryNote: string;
  shortRemark: string;
  recordedAt: string;
  lines: { item: string; unit: string; quantity: number; containers: { number: string; quantity: number }[]; warehouse: { team: string; quantity: number }[] }[];
};
export type HistoryReceiptsResponse = { supplier: HistorySupplier; receipts: Paged<HistoryReceipt> };

export type HistoryLandedCostOrder = {
  id: string;
  po: string;
  orderDate: string;
  currency: Currency;
  stage: number;
  held: boolean;
  orderValueCny: number;
  landedCost: SupplierOrderRow["landedCost"];
  protectedAt: string | null;
  containers: (SupplierOrderRow["containers"][number] & {
    clearing: { status: string; billOfEntry: string; clearedOn: string | null; customsDutyInr: number; otherDutiesInr: number; agentChargesInr: number; portChargesInr: number } | null;
    transport: { status: string; lrNumber: string; unloadedOn: string | null; freightInr: number; handlingInr: number } | null;
  })[];
  agentPayments: (PaymentRow & { recordedBy: string | null })[];
};
export type HistoryLandedCostResponse = {
  supplier: HistorySupplier;
  orders: Paged<HistoryLandedCostOrder>;
  landedCostInr: number;
  agentPayments: { count: number; voided: number };
};

export const EVENT_TYPES = [
  "supplier_created",
  "order_placed",
  "order_value_posted",
  "order_value_changed",
  "order_cancelled",
  "receipt_recorded",
  "payment_recorded",
  "payment_voided",
  "management_adjustment",
  "agent_payment",
  "agent_payment_voided",
  "container_loaded",
  "clearing_recorded",
  "transport_recorded",
  "warehouse_stocked",
  "landed_cost_final",
  "account_held",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_STATUSES = ["active", "voided", "held", "migrated"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export type HistoryEvent = {
  id: string;
  type: EventType;
  date: string | null;
  recordedAt: string | null;
  origin: "app" | "migrated";
  /** null: the source keeps no author ("Not recorded"). */
  actor: string | null;
  supplier: { id: string; name: string; code: string };
  currency: string | null;
  amount: number | null;
  amountInr: number | null;
  po: string | null;
  reference: string | null;
  details: string;
  reason: string | null;
  status: "active" | "voided" | "held" | null;
};

/** SH-6 GET /suppliers/:id/history/events. */
export type HistoryEventsResponse = { supplier: HistorySupplier; events: Paged<HistoryEvent>; byType: Partial<Record<EventType, number>> };

/** RPT-SH GET /reports/supplier-history. */
export type SupplierHistoryReport = {
  events: Paged<HistoryEvent>;
  byType: Partial<Record<EventType, number>>;
  filter: { supplier: string | null; from: string | null; to: string | null; types: EventType[]; status: EventStatus | null; q: string | null };
  options: { suppliers: { id: string; name: string }[]; types: EventType[]; statuses: EventStatus[] };
};
