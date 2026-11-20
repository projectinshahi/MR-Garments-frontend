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
