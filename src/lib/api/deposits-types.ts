import type { Currency, RecordStatus } from "@/types/domain";

import type { PaymentRow } from "./ledger-types";
import type { MilestoneFields } from "./types";

// Deposits after the unified supplier ledger (backend docs/unified-ledger.md): DEP-1 GET /deposits lists the Deposit
// Required milestones and two read-only archives (legacy order-linked Deposit payments and supplier deposits); SD-1 is
// the supplier-deposit archive; ADV-1 the legacy advance archive. SD-2..5 and ADV-2..4 answer 410. Amounts are in the
// record's currency as JSON numbers; currencies are never added together.

export type DepositDirection = "give" | "receive";
export type SupplierDepositStatus = "open" | "partly settled" | "settled";

/** A supplier deposit: `settled` and `pending` are summed live from its transactions; `transactions` is their count. */
export type SupplierDepositRow = {
  id: string;
  supplierId: string;
  supplier: string;
  direction: DepositDirection;
  currency: Currency;
  /** The supplier's rate (INR per 1 of `currency`) when the deposit was opened; null before migration 0012 or without a rate then. */
  exchangeRate: number | null;
  amount: number;
  /** The amount in INR at the deposit's own rate (2 decimals); null without a rate; absent from an older backend. */
  amountInr?: number | null;
  settled: number;
  pending: number;
  status: SupplierDepositStatus;
  openedOn: string;
  reference: string;
  notes: string;
  transactions: number;
};

/** DEP-1 `milestones`: an order with a Deposit Required (D11), newest first; figures null while held or not posted. */
export type DepositMilestone = {
  orderId: string;
  po: string;
  orderDate: string;
  supplierId: string;
  supplier: string;
  currency: Currency;
  held: boolean;
} & MilestoneFields;

/** DEP-1 GET /api/v1/deposits (payments View). */
export type DepositsResponse = {
  milestones: DepositMilestone[];
  /** Legacy order-linked Deposit payments (archive). */
  /** Legacy order-linked Deposit payments (archive), as DEP-1 sends them: PaymentRows (voided and held flagged). */
  orderDeposits: PaymentRow[];
  /** The supplier-deposit archive, newest first. */
  supplierDeposits: SupplierDepositRow[];
  suppliers: { id: string; name: string }[];
};

/** One payment (give) or receipt (receive) against a supplier deposit. */
export type DepositTransaction = { id: string; paidOn: string; amount: number; mode: string; reference: string; notes: string };

/** SD-1 GET /api/v1/suppliers/:supplierId/deposits: the read-only archive. `summary`: one line per (currency, direction); never netted. */
export type SupplierStatement = {
  /** `exchangeRate`: the supplier's rate now, null while not set (absent from an older backend). */
  supplier: { id: string; name: string; contactPerson: string; phone: string; city: string; currency: Currency; exchangeRate?: number | null; status: RecordStatus };
  summary: { currency: Currency; direction: DepositDirection; amount: number; settled: number; pending: number }[];
  /** Each deposit with its transactions (newest first) in place of the count. */
  deposits: (Omit<SupplierDepositRow, "transactions"> & { transactions: DepositTransaction[] })[];
};

/** excess / excess_return (0016): supplier money paid on an order beyond its value, and part of it taken back. */
export type AdvanceKind = "receipt" | "allocation" | "reversal" | "excess" | "excess_return";

/** ADV-1 GET /api/v1/suppliers/:supplierId/advances (payments View): the legacy advance archive, oldest first, read-only. */
export type AdvanceArchiveEntry = {
  id: string;
  kind: AdvanceKind;
  amount: number;
  currency: Currency;
  exchangeRate: number | null;
  amountInr: number | null;
  entryDate: string;
  /** Null on a receipt (no order). */
  po: string | null;
  paymentId: string | null;
  advanceId: string | null;
  mode: string;
  reference: string;
  notes: string;
  recordedAt: string;
  recordedBy: string;
};
export type AdvanceArchiveResponse = { supplier: { id: string; name: string; currency: Currency }; entries: AdvanceArchiveEntry[] };

/**
 * ADV-5 GET /api/v1/supplier-advances/suppliers (payments Enter): the Record payment supplier list, active suppliers by
 * name. `currencyOptions` (D10): the supplier's currency plus currencies with a non-zero balance, never a held one;
 * `balances`: its signed ledger balances (+ available with the supplier, − payable); `held`: its current-currency
 * account is pending review.
 */
export type AdvanceSupplierOption = {
  id: string;
  name: string;
  currency: Currency;
  exchangeRate: number | null;
  held: boolean;
  currencyOptions: Currency[];
  balances: { currency: Currency; balanceCny: number }[];
};
export type AdvanceSuppliersResponse = { suppliers: AdvanceSupplierOption[] };
