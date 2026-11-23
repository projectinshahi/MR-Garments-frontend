import type { AdvanceSupplierOption } from "@/lib/api/deposits-types";
import type { LedgerEntry, LedgerEntryType, LedgerOverviewAccount, LedgerOverviewResponse, SupplierLedgerResponse } from "@/lib/api/ledger-types";
import type { Currency, Tone } from "@/types/domain";

// The Supplier ledger pages (backend docs/unified-ledger.md): LED-2 overview, LED-1 statement. Pure helpers; every
// figure is the API's, never recomputed here. Currencies are never added together.

export const ledgerHref = (supplierId: string) => `/supplier-ledger/${encodeURIComponent(supplierId)}`;

export const ENTRY_LABEL: Record<LedgerEntryType, string> = {
  payment: "Payment",
  payment_void: "Payment void",
  order_debit: "Order debit",
  order_adjustment: "Order change",
  order_cancel: "Order cancellation",
  adjustment: "Adjustment",
};
export const ENTRY_TONE: Record<LedgerEntryType, Tone> = {
  payment: "success",
  payment_void: "danger",
  order_debit: "info",
  order_adjustment: "warning",
  order_cancel: "neutral",
  adjustment: "purple",
};

/**
 * A zero-value order posting (owner rule of 2026-11-23: an order is worth its received quantity x rate): the debit of an
 * order placed before any goods, or the cancellation of an order deleted with nothing received. Kept, never rewritten:
 * the journal holds one debit per order and one cancellation per deleted order (the reconciliation checks both). It
 * moves no money and is never a payment, so it reads as what it is.
 */
export const isZeroOrderEntry = (entry: Pick<LedgerEntry, "entryType" | "amount">) => (entry.entryType === "order_debit" || entry.entryType === "order_cancel") && entry.amount === 0;
export const ZERO_ORDER_LABEL = { order_debit: "Order placed, nothing received", order_cancel: "Order deleted, nothing received" } as const;
export const NO_CHANGE = "No change";
/** The statement's pill for a zero-value order posting, with NOTHING_RECEIVED under it (the long label is the export's). */
export const ZERO_ORDER_PILL = { order_debit: "Order placed", order_cancel: "Order deleted" } as const;
export const NOTHING_RECEIVED = "Nothing received";
/** The entry's type label: a zero-value order posting says so. */
export const entryLabel = (entry: Pick<LedgerEntry, "entryType" | "amount">) =>
  isZeroOrderEntry(entry) ? ZERO_ORDER_LABEL[entry.entryType as keyof typeof ZERO_ORDER_LABEL] : ENTRY_LABEL[entry.entryType];
export const entryTone = (entry: Pick<LedgerEntry, "entryType" | "amount">): Tone => (isZeroOrderEntry(entry) ? "neutral" : ENTRY_TONE[entry.entryType]);
/** The note on every statement export about zero-value order postings. */
export const ZERO_ORDER_NOTE =
  "Order placed / Order deleted, nothing received: postings of 0 that keep the order's place in the journal (an order is worth its received quantity x rate). They are not payments and change no balance.";

/** The legacy archive's status for a receipt the owner excluded (ADV-1 `exclusionReason`): never on the account. */
export const EXCLUDED_FROM_LEDGER = "Excluded from ledger";

/** "+¥1,200.00" / "−¥300.00": a posting's signed amount (the sign is the direction on the account). */
export const signed = (amount: number, show: (value: number) => string) => `${amount < 0 ? "−" : "+"}${show(Math.abs(amount))}`;

/** One overview row: a supplier's account in one currency, or a supplier with no entries yet (`account` null). */
export type OverviewRow = { supplierId: string; supplier: string; code: string; status: LedgerOverviewAccount["status"]; account: LedgerOverviewAccount | null };
export type BalanceState = "all" | "payable" | "available" | "settled" | "held";
export type OverviewFilters = { query: string; state: BalanceState; currency: Currency | null };
export const EMPTY_OVERVIEW_FILTERS: OverviewFilters = { query: "", state: "all", currency: null };

export const stateOf = (account: LedgerOverviewAccount): Exclude<BalanceState, "all"> =>
  account.held || account.balanceCny === null ? "held" : account.balanceCny < 0 ? "payable" : account.balanceCny > 0 ? "available" : "settled";

/** LED-2's accounts (by supplier, then currency), then the suppliers without any entry yet. */
export function overviewRows({ accounts, suppliers }: Pick<LedgerOverviewResponse, "accounts" | "suppliers">): OverviewRow[] {
  const rows: OverviewRow[] = accounts.map((account) => ({ supplierId: account.supplierId, supplier: account.supplier, code: account.code, status: account.status, account }));
  const seen = new Set(accounts.map((a) => a.supplierId));
  const blank = suppliers.filter((s) => !seen.has(s.id)).map((s): OverviewRow => ({ supplierId: s.id, supplier: s.name, code: "", status: s.status, account: null }));
  return [...rows, ...blank];
}

/** Search on the supplier's name or code (any case); a state or currency filter keeps accounts only. */
export function filterOverview(rows: OverviewRow[], { query, state, currency }: OverviewFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!q || row.supplier.toLowerCase().includes(q) || row.code.toLowerCase().includes(q)) &&
      (state === "all" || (row.account !== null && stateOf(row.account) === state)) &&
      (currency === null || row.account?.currency === currency),
  );
}

export type StatementFilters = { currency: Currency | null; type: LedgerEntryType | "audit" | null };
/** `audit`: the corrections only (voids and Management adjustments). */
export function filterEntries(entries: LedgerEntry[], { currency, type }: StatementFilters) {
  return entries.filter(
    (e) => (currency === null || e.currency === currency) && (type === null || (type === "audit" ? e.entryType === "payment_void" || e.entryType === "adjustment" : e.entryType === type)),
  );
}

/** The reason a void or adjustment carries (the entry's notes; a void falls back to its payment's reason). */
export const reasonOf = (entry: LedgerEntry) => entry.notes || (entry.entryType === "payment_void" ? (entry.payment?.voidReason ?? "") : "");

/**
 * The supplier as Record payment needs it, from LED-1 (no ADV-5 call): its currencies (D10), its signed balances and
 * whether its current-currency account is held.
 */
export function paymentChoice({ supplier, accounts, currencyOptions, held }: SupplierLedgerResponse): AdvanceSupplierOption {
  return {
    id: supplier.id,
    name: supplier.name,
    currency: supplier.currency,
    exchangeRate: supplier.exchangeRate,
    held: held.some((h) => h.currency === supplier.currency) || accounts.some((a) => a.held && a.currency === supplier.currency),
    currencyOptions,
    balances: accounts.filter((a) => !a.held && a.balanceCny !== null).map((a) => ({ currency: a.currency, balanceCny: a.balanceCny! })),
  };
}
