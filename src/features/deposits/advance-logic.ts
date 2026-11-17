import type { AdvanceAccount, AdvanceEntry, AdvanceKind, AdvanceSummary } from "@/lib/api/deposits-types";
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

/** The entries that pass the filters (type, day range inclusive, PO contains the text in any case); `balance` stays the ledger's own. */
export function filterAdvanceEntries<T extends AdvanceEntry>(entries: T[], f: AdvanceFilters): T[] {
  const po = f.po.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (!f.kind || entry.kind === f.kind) &&
      (!f.from || entry.entryDate >= f.from) &&
      (!f.to || entry.entryDate <= f.to) &&
      (!po || entry.po.toLowerCase().includes(po)),
  );
}

/** A receipt nothing has drawn on (the only kind ADV-3 deletes). */
export const isUnusedReceipt = (entry: AdvanceEntry, account: AdvanceAccount) =>
  entry.kind === "receipt" && !account.entries.some((other) => other.kind === "allocation" && other.advanceId === entry.id);
