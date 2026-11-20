import type { DepositDirection, SupplierStatement } from "@/lib/api/deposits-types";
import { formatMoney } from "@/lib/formatters";
import { compareCurrencies } from "@/lib/currencies";
import type { Currency, MoneyTotal, Tone } from "@/types/domain";

// The supplier-deposit archive (SD-1, read-only since the unified supplier ledger, D8): statuses, the statement's
// figures per currency (give and receive never netted) and amount text. Currencies are never added together.

type DirectionTotals = { amount: MoneyTotal[]; paid: MoneyTotal[]; pending: MoneyTotal[] };

export type DepositStatus = "paid" | "partly paid" | "due" | "open" | "partly settled" | "settled";

export const STATUS_LABEL: Record<DepositStatus, string> = { paid: "Paid", "partly paid": "Partly paid", due: "Due", open: "Open", "partly settled": "Partly settled", settled: "Settled" };
export const STATUS_TONE: Record<DepositStatus, Tone> = { paid: "success", "partly paid": "info", due: "warning", open: "warning", "partly settled": "info", settled: "success" };

/** SD-1's summary lines of one direction as the statement's three figures, per currency (CNY, USD, INR order). */
export function statementTotals(summary: SupplierStatement["summary"], direction: DepositDirection): DirectionTotals {
  const lines = summary.filter((line) => line.direction === direction).sort((a, b) => compareCurrencies(a.currency, b.currency));
  const pick = (key: "amount" | "settled" | "pending") => lines.map((line) => ({ currency: line.currency, amount: line[key] }));
  return { amount: pick("amount"), paid: pick("settled"), pending: pick("pending") };
}

/** "¥1,234.50", "¥1,000": paise shown only when there are some, as the API's own messages do. */
export const amountText = (value: number, currency: Currency) => formatMoney(value, currency, { decimals: Number.isInteger(value) ? 0 : 2 });

/** "¥1,234.50 · $200": each currency apart (zeros left out), paise only when fractional; "¥0" (or `empty`'s symbol) when nothing is left. */
export function amountList(totals: MoneyTotal[], empty: Currency = "CNY") {
  const shown = totals.filter((total) => total.amount !== 0);
  if (shown.length === 0) return amountText(0, totals[0]?.currency ?? empty);
  return shown.map((total) => amountText(total.amount, total.currency)).join(" · ");
}
