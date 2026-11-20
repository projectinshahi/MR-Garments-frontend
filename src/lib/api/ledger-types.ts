import type { Currency, RecordStatus } from "@/types/domain";

import type { MilestoneFields, OrderStage, PayeeRole, SettlementFields } from "./types";

// Unified supplier ledger (backend docs/unified-ledger.md, migration 0017). One account per (supplier, currency); its
// balance is the sum of its postings: positive = money available with the supplier, zero = settled, negative = payable
// to the supplier. Currencies are never added together or converted. Order figures are a FIFO projection, read-only.

/** A posting's kind: + payment, − payment_void, − order_debit, ± order_adjustment, + order_cancel, ± adjustment (Management). */
export type LedgerEntryType = "payment" | "payment_void" | "order_debit" | "order_adjustment" | "order_cancel" | "adjustment";

/** One supplier account. Balances are signed; every figure is null while the account is held (pending review). */
export type LedgerAccount = {
  supplierId: string;
  currency: Currency;
  held: boolean;
  creditsCny: number | null;
  debitsCny: number | null;
  balanceCny: number | null;
  /** Payments less voids at their own rates; `paidInrComplete` false when some have no rate. */
  paidInr: number | null;
  paidInrComplete: boolean;
  outstandingCny: number | null;
  /** Null while held. */
  openOrders: number | null;
  lastPaymentOn: string | null;
};

/** The payment document behind a `payment` or `payment_void` posting. `memoPo`: the order a legacy payment was recorded against. */
export type LedgerEntryPayment = {
  kind: PaymentRow["kind"];
  payeeRole: PayeeRole;
  mode: string | null;
  reference: string;
  notes: string;
  memoPo: string | null;
  voided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

/** LED-1 `entries` (newest first). `runningBalance`: the account's balance right after the entry, by date order. */
export type LedgerEntry = {
  id: string;
  entryType: LedgerEntryType;
  currency: Currency;
  /** Signed, in the account's currency. */
  amount: number;
  /** INR per 1 unit as copied from the source; null stays null (INR shows as not set). */
  exchangeRate: number | null;
  amountInr: number | null;
  entryDate: string;
  origin: "backfill" | "app";
  orderId: string | null;
  /** The order's PO now, or the stored one of a deleted order; null on payments and adjustments. */
  po: string | null;
  paymentId: string | null;
  advanceEntryId: string | null;
  reversesId: string | null;
  /** The adjustment's or the void's reason. */
  notes: string | null;
  /** Adjustments only. */
  balanceBefore: number | null;
  balanceAfter: number | null;
  runningBalance: number | null;
  recordedAt: string;
  /** The user's name ("" when unknown). */
  recordedBy: string;
  payment: LedgerEntryPayment | null;
  advance: { mode: string; reference: string; notes: string } | null;
};

/** A credit that settled an order, oldest first (ORD-4 `slices`). */
export type SettlementSlice = {
  entryId: string;
  entryType: "payment" | "adjustment";
  paymentId: string | null;
  advanceEntryId: string | null;
  entryDate: string;
  amount: number;
  exchangeRate: number | null;
  amountInr: number | null;
  mode: string | null;
  reference: string | null;
  memoPo: string | null;
};

/**
 * A payment document (PAY-1, ORD-4, PAY-2/3). An orderless supplier payment has `orderId`/`po` null and kind "Payment";
 * Deposit and Balance remain on legacy and shipping-agent rows. Voided rows are listed, flagged, and every total leaves
 * them out.
 */
export type PaymentRow = {
  id: string;
  orderId: string | null;
  po: string | null;
  supplierId: string;
  supplier: string;
  currency: Currency;
  kind: "Deposit" | "Balance" | "Payment";
  payee: string;
  payeeRole: PayeeRole;
  amountCny: number;
  status: "paid" | "due";
  paidOn: string | null;
  dueDate: string | null;
  rateInr: number | null;
  /** Null while due. */
  amountInr: number | null;
  mode: string | null;
  reference: string;
  notes: string;
  recordedAt: string;
  voided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string;
  /** The payment's account is held (D4, "pending review"): listed as a record, counted in no total. */
  held: boolean;
};

/** The before/after of the account a write touched (PAY-2, PAY-3). */
export type LedgerChange = { supplierId: string; currency: Currency; balanceBefore: number; balanceAfter: number };

/** LED-2 totals per currency, held accounts left out. `payableCny`: Σ negative balances as a positive amount. */
export type LedgerTotal = { currency: Currency; accounts: number; balanceCny: number; payableCny: number; availableCny: number; outstandingCny: number };

/** LED-2 account row. */
export type LedgerOverviewAccount = LedgerAccount & { supplier: string; code: string; status: RecordStatus };

/** LED-2 GET /api/v1/supplier-ledger (payments View). Accounts by supplier name, then currency. */
export type LedgerOverviewResponse = {
  accounts: LedgerOverviewAccount[];
  totals: LedgerTotal[];
  suppliers: { id: string; name: string; status: RecordStatus }[];
};

/** LED-1 `orders` (oldest first): the FIFO projection of the supplier's live orders. */
export type LedgerOrder = {
  id: string;
  po: string;
  orderDate: string;
  stage: OrderStage;
  currency: Currency;
  exchangeRate: number | null;
  valueCny: number;
} & SettlementFields &
  MilestoneFields;

/** A held account's raw legacy records (D4): read-only, nothing here is posted or counted. */
export type HeldAccount = {
  currency: Currency;
  reason: string;
  orders: { id: string; po: string; orderDate: string; stage: OrderStage; valueCny: number }[];
  payments: {
    id: string;
    po: string;
    kind: string;
    payeeRole: PayeeRole;
    status: "paid" | "due";
    amountCny: number;
    paidOn: string | null;
    rateInr: number | null;
    mode: string | null;
    reference: string;
    notes: string;
    recordedAt: string;
  }[];
  advanceEntries: { id: string; kind: string; amount: number; entryDate: string; exchangeRate: number | null; po: string; mode: string; reference: string; notes: string; recordedAt: string }[];
};

/** LED-1 GET /api/v1/suppliers/:supplierId/ledger (payments View). */
export type SupplierLedgerResponse = {
  supplier: { id: string; code: string; name: string; currency: Currency; exchangeRate: number | null; status: RecordStatus };
  accounts: LedgerAccount[];
  /** D10: the supplier's current currency plus every currency with a non-zero balance, never a held one. */
  currencyOptions: Currency[];
  entries: LedgerEntry[];
  orders: LedgerOrder[];
  held: HeldAccount[];
};

/** LED-3 POST /api/v1/suppliers/:supplierId/ledger/adjustments (payments Full). Strict: no other keys. */
export type CreateAdjustmentBody = {
  currency: Currency;
  /** Signed, ≠ 0, 2 decimals: + raises the balance (more available), − lowers it (more payable). */
  amount: number;
  entryDate: string;
  /** Required for non-INR; left out for INR. */
  rateInr?: number;
  reason: string;
  /** Generated once per dialog open (uuid); a resubmit returns the same entry. */
  idempotencyKey: string;
};
export type CreateAdjustmentResponse = { entry: LedgerEntry; balanceBefore: number; balanceAfter: number };
