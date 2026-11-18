import type { AdvanceAccount, AdvanceEntry, AdvanceKind, AdvanceSummary, SupplierAdvanceBalance } from "@/lib/api/deposits-types";
import type { AdvanceStatus } from "@/lib/api/types";
import type { MoneyTotal, Tone } from "@/types/domain";

// Supplier advance account (backend docs/supplier-advance.md), shared by the Deposits › Supplier advance tab, the order
// pages and the reports. A receipt is money already paid to the supplier before any order; an allocation applies part
// of it to an order; a reversal gives part of an allocation back. None of them is a payment or a supplier deposit, so
// their figures are always shown apart from those, and amounts in different currencies are never added together.

export const ADVANCE_KIND_LABEL: Record<AdvanceKind, string> = { receipt: "Advance received", allocation: "Applied to order", reversal: "Returned from order" };
export const ADVANCE_KIND_TONE: Record<AdvanceKind, Tone> = { receipt: "success", allocation: "info", reversal: "warning" };
export const ADVANCE_STATUS_LABEL: Record<AdvanceStatus, string> = { none: "None", partial: "Partial", full: "Fully covered" };
export const ADVANCE_STATUS_TONE: Record<AdvanceStatus, Tone> = { none: "neutral", partial: "warning", full: "success" };

/** +amount for receipts and reversals, -amount for allocations: what the entry did to the available advance. */
export const signedAdvance = (entry: Pick<AdvanceEntry, "kind" | "amount">) => (entry.kind === "allocation" ? -entry.amount : entry.amount);

/** A summary figure per currency (available, received, ...), CNY, USD, INR first as the API orders them. */
export const summaryTotals = (summary: AdvanceSummary[], pick: (row: AdvanceSummary) => number): MoneyTotal[] =>
  summary.map((row) => ({ currency: row.currency, amount: pick(row) }));

export type AdvanceFilters = { kind: AdvanceKind | null; from: string; to: string; po: string };
export const EMPTY_ADVANCE_FILTERS: AdvanceFilters = { kind: null, from: "", to: "", po: "" };
export const isAdvanceFiltered = (f: AdvanceFilters) => JSON.stringify(f) !== JSON.stringify(EMPTY_ADVANCE_FILTERS);

/**
 * The entries that pass the filters (type, day range inclusive, and the text in the PO, the reference or the advance
 * it draws from, any case); `balance` stays the ledger's own.
 */
export function filterAdvanceEntries<T extends AdvanceEntry>(entries: T[], f: AdvanceFilters): T[] {
  const text = f.po.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (!f.kind || entry.kind === f.kind) &&
      (!f.from || entry.entryDate >= f.from) &&
      (!f.to || entry.entryDate <= f.to) &&
      (!text || [entry.po, entry.reference, entry.advanceReference ?? ""].some((field) => field.toLowerCase().includes(text))),
  );
}

/** Applied to orders, net: what the orders hold now (allocated less what came back from deleted or reduced orders). */
export const netApplied = (row: Pick<AdvanceSummary, "allocatedCny" | "reversedCny">) => Math.round((row.allocatedCny - row.reversedCny) * 100) / 100;

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
        .map(({ currency, receivedCny, allocatedCny, reversedCny, availableCny, orders }) => ({ currency, receivedCny, allocatedCny, reversedCny, availableCny, orders }));
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
