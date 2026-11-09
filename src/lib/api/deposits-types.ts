import type { Currency, RecordStatus } from "@/types/domain";

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
  supplier: string;
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
  amount: number;
  settled: number;
  pending: number;
  status: SupplierDepositStatus;
  openedOn: string;
  reference: string;
  notes: string;
  transactions: number;
};

/** DEP-1 GET /api/v1/deposits. Order deposits latest first; supplier deposits newest first; suppliers for the filter. */
export type DepositsResponse = {
  orderDeposits: OrderDeposit[];
  supplierDeposits: SupplierDepositRow[];
  suppliers: { id: string; name: string }[];
};

/** One payment (give) or receipt (receive) against a supplier deposit. */
export type DepositTransaction = { id: string; paidOn: string; amount: number; mode: string; reference: string; notes: string };

/** SD-1 GET /api/v1/suppliers/:supplierId/deposits. `summary`: one line per (currency, direction); never netted. */
export type SupplierStatement = {
  supplier: { id: string; name: string; contactPerson: string; phone: string; city: string; currency: Currency; status: RecordStatus };
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
