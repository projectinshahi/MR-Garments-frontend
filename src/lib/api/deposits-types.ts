import type { Currency, RecordStatus } from "@/types/domain";

import type { DepositStatus } from "./types";

// Deposits (backend docs/phase2-contracts.md section 3 and 8.D): DEP-1 GET /deposits, SD-1 .. SD-5. Amounts are in
// the deposit's currency as JSON numbers; a supplier deposit has no INR figure (no rate exists for it).

export type DepositDirection = "give" | "receive";
export type SupplierDepositStatus = "open" | "partly settled" | "settled";

/** A `payments` row of kind Deposit (ORD-3 or PAY-2), with its order and supplier. `amountInr` only when paid. */
export type OrderDeposit = {
  id: string;
  orderId: string;
  po: string;
  supplierId: string;
  /** The order's supplier. */
  supplier: string;
  /** Who was paid: the supplier, or a shipping agent (ORD-3 / PAY-2 `payeeRole: "agent"`). */
  payee: string;
  payeeRole: "supplier" | "agent";
  currency: Currency;
  amountCny: number;
  status: "paid" | "due";
  paidOn: string | null;
  dueDate: string | null;
  rateInr: number | null;
  amountInr: number | null;
  mode: string | null;
  reference: string;
  notes: string;
};

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

/**
 * An order with a deposit the supplier asked for (0009): the obligation the Pending tab tracks. `paidCny` is the paid
 * supplier deposits of the order, `pendingCny` = max(0, required - paid); `status` never "none" here.
 */
export type OrderDepositObligation = {
  orderId: string;
  po: string;
  supplierId: string;
  supplier: string;
  currency: Currency;
  requiredCny: number;
  paidCny: number;
  pendingCny: number;
  status: Exclude<DepositStatus, "none">;
  /** The latest paid supplier deposit's date, or null. */
  lastPaidOn: string | null;
  /** How many paid supplier deposits the order has. */
  payments: number;
  /** The supplier advance applied to the order, already inside `paidCny` (backend docs/supplier-advance.md); absent from an older backend. */
  advanceCny?: number;
};

/** DEP-1 GET /api/v1/deposits. Order deposits latest first; obligations and supplier deposits newest first; suppliers for the filter. */
export type DepositsResponse = {
  orderDeposits: OrderDeposit[];
  orderObligations: OrderDepositObligation[];
  supplierDeposits: SupplierDepositRow[];
  /** One line per supplier and currency with an advance account, by name; absent from an older backend. */
  advances?: SupplierAdvanceBalance[];
  suppliers: { id: string; name: string }[];
};

/** One payment (give) or receipt (receive) against a supplier deposit. */
export type DepositTransaction = { id: string; paidOn: string; amount: number; mode: string; reference: string; notes: string };

/** SD-1 GET /api/v1/suppliers/:supplierId/deposits. `summary`: one line per (currency, direction); never netted. */
export type SupplierStatement = {
  /** `exchangeRate`: the supplier's rate now, null while not set (absent from an older backend). */
  supplier: { id: string; name: string; contactPerson: string; phone: string; city: string; currency: Currency; exchangeRate?: number | null; status: RecordStatus };
  /** The supplier advance account beside the deposits, never netted with them; absent from an older backend. */
  advance?: AdvanceAccount;
  summary: { currency: Currency; direction: DepositDirection; amount: number; settled: number; pending: number }[];
  /** Each deposit with its transactions (newest first) in place of the count. */
  deposits: (Omit<SupplierDepositRow, "transactions"> & { transactions: DepositTransaction[] })[];
};

/** SD-2 POST /api/v1/suppliers/:supplierId/deposits; 201 `{ deposit }`. `currency` left out: the supplier's. */
export type CreateSupplierDepositBody = {
  direction: DepositDirection;
  amount: number;
  currency?: Currency;
  /** INR per 1 unit, sent only for a supplier with no saved rate (SD-2 asks for it then). */
  rateInr?: number;
  openedOn: string;
  reference?: string;
  notes?: string;
};
export type CreateSupplierDepositResponse = { deposit: SupplierDepositRow };

/** SD-3 POST /api/v1/supplier-deposits/:id/transactions; 201 `{ transaction, deposit }` (the refreshed figures). */
export type CreateDepositTransactionBody = { paidOn: string; amount: number; mode: string; reference?: string; notes?: string };
export type CreateDepositTransactionResponse = { transaction: DepositTransaction; deposit: SupplierDepositRow };

// Supplier advance account (backend docs/supplier-advance.md): ADV-1 GET /suppliers/:id/advances, ADV-2 POST
// /suppliers/:id/advances, ADV-3 DELETE /supplier-advances/:id. A ledger that is only added to: a receipt is money
// already paid to the supplier before any order; an allocation is part of one receipt applied to an order (ORD-3,
// ORD-5); a reversal gives part of an allocation back (ORD-5 lowering the total, ORD-6 deleting the order).

/** excess / excess_return (0016): supplier money paid on an order beyond its value, and part of it taken back. */
export type AdvanceKind = "receipt" | "allocation" | "reversal" | "excess" | "excess_return";
/** A row of the advance history: a ledger entry, or an order deposit (`deposits`). */
export type AdvanceHistoryKind = AdvanceKind | "deposit";

/** One ledger entry, in its currency; `exchangeRate` is the receipt's typed rate (carried by its allocations and reversals). */
export type AdvanceEntry = {
  id: string;
  kind: AdvanceKind;
  /** A receipt: the day it was paid; an allocation or reversal: the day it was recorded. */
  entryDate: string;
  currency: Currency;
  amount: number;
  exchangeRate: number;
  amountInr: number;
  /** The receipt an allocation or reversal draws from or returns to, its paid-on day and reference; null on a receipt. */
  advanceId: string | null;
  advancePaidOn: string | null;
  advanceReference: string | null;
  reversalOf: string | null;
  /** An excess: the supplier payment it is part of (null once deleted; absent from an older backend). */
  paymentId?: string | null;
  /** Null on a receipt and once the order was deleted; `po` keeps the number ("" on a receipt). */
  orderId: string | null;
  po: string;
  mode: string;
  reference: string;
  notes: string;
  recordedAt: string;
  recordedBy: string;
};

/**
 * Per currency: received (added as advance), applied to orders, given back, available, the order deposits
 * (`depositsCny`, absent from an older backend) and how many POs used either. Available is the ledger's alone: an order
 * deposit is applied in full to its own order.
 */
export type AdvanceSummary = {
  currency: Currency;
  receivedCny: number;
  /** Supplier payments beyond their orders' value, net of what was taken back (0016; absent from an older backend). */
  excessCny?: number;
  allocatedCny: number;
  reversedCny: number;
  availableCny: number;
  depositsCny?: number;
  orders: number;
};

/**
 * An order deposit (owner decision 2026-11-18): a paid supplier deposit on an order, entered on New order or recorded
 * later as a Deposit payment. The payment is its only record; the account shows it as advance applied to that order.
 * `id` is the payment's; `balance` is the available advance on its day (it does not change it).
 */
export type OrderDepositEntry = {
  id: string;
  orderId: string;
  po: string;
  paidOn: string;
  currency: Currency;
  /** What the deposit settled of its order; the rest (paidAmount - amount) is in the account as an excess. */
  amount: number;
  /** The whole payment (absent from an older backend). */
  paidAmount?: number;
  exchangeRate: number;
  amountInr: number;
  mode: string | null;
  reference: string;
  notes: string;
  recordedAt: string;
  recordedBy: string;
  balance: number;
};

/**
 * The account: totals per currency, every ledger entry newest first with `balance` (the available advance right after
 * it) and the order deposits (`deposits`, newest first; absent from an older backend).
 */
export type AdvanceAccount = { summary: AdvanceSummary[]; entries: (AdvanceEntry & { balance: number })[]; deposits?: OrderDepositEntry[] };

/** ADV-1 `openOrders`: an order of the supplier still owing it (balance > 0), oldest first; ADV-4 can apply the advance to it. */
export type AdvanceOpenOrder = { po: string; orderDate: string; currency: Currency; orderValueCny: number; paidCny: number; advanceCny: number; balanceCny: number };

/** ADV-1: the supplier (its rate now is the Add advance default), its account and its orders still owing. */
export type SupplierAdvanceResponse = AdvanceAccount & {
  supplier: { id: string; name: string; currency: Currency; exchangeRate: number | null; status: RecordStatus };
  /** Absent from an older backend. */
  openOrders?: AdvanceOpenOrder[];
};

/** DEP-1 `advances`: one line per supplier and currency. */
export type SupplierAdvanceBalance = AdvanceSummary & { supplierId: string; supplier: string };

/** ADV-2 body: no order is chosen; `rateInr` left out for an INR supplier. */
export type CreateAdvanceBody = { amount: number; paidOn: string; rateInr?: number; mode: string; reference?: string; notes?: string };
