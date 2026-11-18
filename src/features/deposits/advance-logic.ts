import type { AdvanceAccount, AdvanceEntry, AdvanceHistoryKind, AdvanceSummary, SupplierAdvanceBalance } from "@/lib/api/deposits-types";
import type { AdvanceStatus } from "@/lib/api/types";
import type { MoneyTotal, Tone } from "@/types/domain";

// Supplier advance account (backend docs/supplier-advance.md), shared by the Deposits › Supplier advance tab, the order
// pages and the reports. A receipt is money already paid to the supplier before any order; an allocation applies part
// of it to an order; a reversal gives part of an allocation back. An order deposit (a paid supplier deposit on an order,
// owner decision 2026-11-18) is advance money too, applied in full to its own order: its one record is the payment, so
// it is counted once, never as a ledger entry. Amounts in different currencies are never added together.

export const ADVANCE_KIND_LABEL: Record<AdvanceHistoryKind, string> = {
  receipt: "Advance received",
  allocation: "Applied to order",
  reversal: "Returned from order",
  deposit: "Order deposit",
  excess: "Excess payment",
  excess_return: "Excess taken back",
};
export const ADVANCE_KIND_TONE: Record<AdvanceHistoryKind, Tone> = {
  receipt: "success",
  allocation: "info",
  reversal: "warning",
  deposit: "neutral",
  excess: "success",
  excess_return: "warning",
};
export const ADVANCE_STATUS_LABEL: Record<AdvanceStatus, string> = { none: "None", partial: "Partial", full: "Fully covered" };
export const ADVANCE_STATUS_TONE: Record<AdvanceStatus, Tone> = { none: "neutral", partial: "warning", full: "success" };

/**
 * What the entry did to the available advance: + receipts, excess and reversals; - allocations and excess taken back.
 * An order deposit keeps its amount (recorded and applied at once: the available advance does not move); show it unsigned.
 */
export const signedAdvance = (entry: { kind: AdvanceHistoryKind; amount: number }) =>
  entry.kind === "allocation" || entry.kind === "excess_return" ? -entry.amount : entry.amount;

/** One history row: a ledger entry, or an order deposit in the same shape (`entryDate` = its paid-on day). */
export type AdvanceHistoryRow = Omit<AdvanceEntry, "kind"> & { kind: AdvanceHistoryKind; balance: number };

/**
 * The account's history newest first: the ledger entries and the order deposits by day; on one day a deposit comes
 * first, as its balance is the available advance at the end of that day.
 */
export function advanceHistory(account: Pick<AdvanceAccount, "entries" | "deposits">): AdvanceHistoryRow[] {
  const deposits: AdvanceHistoryRow[] = (account.deposits ?? []).map((d) => ({
    id: d.id,
    kind: "deposit",
    entryDate: d.paidOn,
    currency: d.currency,
    amount: d.amount,
    exchangeRate: d.exchangeRate,
    amountInr: d.amountInr,
    advanceId: null,
    advancePaidOn: null,
    advanceReference: null,
    reversalOf: null,
    orderId: d.orderId,
    po: d.po,
    mode: d.mode ?? "",
    reference: d.reference,
    notes: d.notes,
    recordedAt: d.recordedAt,
    recordedBy: d.recordedBy,
    balance: d.balance,
  }));
  const merged: AdvanceHistoryRow[] = [];
  let next = 0;
  for (const entry of account.entries) {
    while (next < deposits.length && deposits[next]!.entryDate >= entry.entryDate) merged.push(deposits[next++]!);
    merged.push(entry);
  }
  return [...merged, ...deposits.slice(next)];
}

/** Order deposits in the currency: what they settled of their orders (0 from an older backend). */
export const depositsOf = (row: Pick<AdvanceSummary, "depositsCny">) => row.depositsCny ?? 0;
/** Excess payments in the currency: supplier money paid beyond orders' value, now available (0 from an older backend). */
export const excessOf = (row: Pick<AdvanceSummary, "excessCny">) => row.excessCny ?? 0;
/** Advance recorded: added as advance, excess payments and the order deposits. */
export const recordedOf = (row: Pick<AdvanceSummary, "receivedCny" | "excessCny" | "depositsCny">) =>
  Math.round((row.receivedCny + excessOf(row) + depositsOf(row)) * 100) / 100;

/** A summary figure per currency (available, received, ...), CNY, USD, INR first as the API orders them. */
export const summaryTotals = (summary: AdvanceSummary[], pick: (row: AdvanceSummary) => number): MoneyTotal[] =>
  summary.map((row) => ({ currency: row.currency, amount: pick(row) }));

export type AdvanceFilters = { kind: AdvanceHistoryKind | null; from: string; to: string; po: string };
export const EMPTY_ADVANCE_FILTERS: AdvanceFilters = { kind: null, from: "", to: "", po: "" };
export const isAdvanceFiltered = (f: AdvanceFilters) => JSON.stringify(f) !== JSON.stringify(EMPTY_ADVANCE_FILTERS);

/**
 * The entries that pass the filters (type, day range inclusive, and the text in the PO, the reference or the advance
 * it draws from, any case); `balance` stays the ledger's own.
 */
export function filterAdvanceEntries<T extends Pick<AdvanceHistoryRow, "kind" | "entryDate" | "po" | "reference" | "advanceReference">>(entries: T[], f: AdvanceFilters): T[] {
  const text = f.po.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (!f.kind || entry.kind === f.kind) &&
      (!f.from || entry.entryDate >= f.from) &&
      (!f.to || entry.entryDate <= f.to) &&
      (!text || [entry.po, entry.reference, entry.advanceReference ?? ""].some((field) => field.toLowerCase().includes(text))),
  );
}

/**
 * Applied to orders, net: what the orders hold now (allocated less what came back from deleted or reduced orders) plus
 * the order deposits, applied in full to their orders. Recorded less this is the available advance.
 */
export const netApplied = (row: Pick<AdvanceSummary, "allocatedCny" | "reversedCny" | "depositsCny">) =>
  Math.round((row.allocatedCny - row.reversedCny + depositsOf(row)) * 100) / 100;

/** One supplier on the supplier-wise overview: its account per currency (empty without an advance). */
export type SupplierAdvanceRow = { supplierId: string; supplier: string; accounts: AdvanceSummary[]; orders: number };

/**
 * Every supplier DEP-1 lists (active ones, and any inactive one with records), each with its own advance account per
 * currency from DEP-1 `advances` (the ledger's totals). Suppliers holding an advance come first, then by name; a
 * currency's figures are never added to another's.
 */
export function supplierAdvanceRows(suppliers: { id: string; name: string }[], advances: SupplierAdvanceBalance[]): SupplierAdvanceRow[] {
  const named = new Map(suppliers.map((s) => [s.id, s.name]));
  for (const row of advances) if (!named.has(row.supplierId)) named.set(row.supplierId, row.supplier);
  return [...named]
    .map(([supplierId, supplier]) => {
      const accounts = advances
        .filter((row) => row.supplierId === supplierId)
        .map(({ currency, receivedCny, excessCny, allocatedCny, reversedCny, availableCny, depositsCny, orders }) => ({
          currency,
          receivedCny,
          excessCny,
          allocatedCny,
          reversedCny,
          availableCny,
          depositsCny,
          orders,
        }));
      return { supplierId, supplier, accounts, orders: accounts.reduce((sum, row) => sum + row.orders, 0) };
    })
    .sort((a, b) => Number(b.accounts.length > 0) - Number(a.accounts.length > 0) || a.supplier.localeCompare(b.supplier));
}

export type OverviewFilters = { query: string; withAdvance: boolean };
/** Supplier name contains the text (any case); `withAdvance` keeps the suppliers with an advance account. */
export const filterSupplierRows = (rows: SupplierAdvanceRow[], { query, withAdvance }: OverviewFilters) =>
  rows.filter((row) => (!withAdvance || row.accounts.length > 0) && row.supplier.toLowerCase().includes(query.trim().toLowerCase()));

/** A receipt nothing has drawn on (the only kind ADV-3 deletes). */
export const isUnusedReceipt = (entry: AdvanceEntry, account: AdvanceAccount) =>
  entry.kind === "receipt" && !account.entries.some((other) => other.kind === "allocation" && other.advanceId === entry.id);
