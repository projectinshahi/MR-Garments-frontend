import type { AdvanceKind } from "@/lib/api/deposits-types";

// The pre-ledger supplier advance (backend docs/supplier-advance.md) is a read-only archive since the unified supplier
// ledger (ADV-1): its receipts are on the ledger as payments; allocations, reversals and excess rows are kept for
// reference only. These name the archive's rows.

export const ADVANCE_KIND_LABEL: Record<AdvanceKind, string> = {
  receipt: "Advance received",
  allocation: "Applied to order",
  reversal: "Returned from order",
  excess: "Excess payment",
  excess_return: "Excess taken back",
};
