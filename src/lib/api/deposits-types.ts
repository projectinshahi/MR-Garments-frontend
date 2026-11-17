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
  supplier: { id: string; name: string; contactPerson: string; phone: string; city: string; currency: Currency; status: RecordStatus };
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

export type AdvanceKind = "receipt" | "allocation" | "reversal";

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
  /** Null on a receipt and once the order was deleted; `po` keeps the number ("" on a receipt). */
  orderId: string | null;
  po: string;
  mode: string;
  reference: string;
  notes: string;
  recordedAt: string;
  recordedBy: string;
};

/** Per currency: received, applied to orders, given back, available, and how many POs drew on it. */
export type AdvanceSummary = { currency: Currency; receivedCny: number; allocatedCny: number; reversedCny: number; availableCny: number; orders: number };

/** The account: totals per currency and every entry newest first with `balance`, the available advance right after it. */
export type AdvanceAccount = { summary: AdvanceSummary[]; entries: (AdvanceEntry & { balance: number })[] };

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
