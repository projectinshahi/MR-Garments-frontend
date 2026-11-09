import { orderHref } from "@/components/shared/po-link";
import type { DepositDirection, DepositsResponse, SupplierStatement } from "@/lib/api/deposits-types";
import { formatMoney, sumByCurrency } from "@/lib/formatters";
import { type Currency, CURRENCIES, type MoneyTotal, type Tone } from "@/types/domain";

// Deposits pages (docs/phase2-contracts.md 3.3): DEP-1's two lists as one table. An order deposit is a `payments` row
// (paid or due); a supplier deposit is settled by its transactions (give: paid to the supplier; receive: received
// from it). The two are never netted and amounts in different currencies are never added together.

export type DepositKind = "order" | DepositDirection;
export type DepositStatus = "paid" | "due" | "open" | "partly settled" | "settled";
export type DepositView = "all" | "pending" | "paid";

export const KIND_LABEL: Record<DepositKind, string> = { order: "Order deposit", give: "To give", receive: "To receive" };
export const STATUS_LABEL: Record<DepositStatus, string> = { paid: "Paid", due: "Due", open: "Open", "partly settled": "Partly settled", settled: "Settled" };
export const STATUS_TONE: Record<DepositStatus, Tone> = { paid: "success", due: "warning", open: "warning", "partly settled": "info", settled: "success" };

export const statementHref = (supplierId: string) => `/deposits/suppliers/${encodeURIComponent(supplierId)}`;

/** One row of the Deposits table, whichever list it came from. `paid` is paid (order, give) or received (receive). */
export type DepositRow = {
  id: string;
  kind: DepositKind;
  supplierId: string;
  supplier: string;
  /** The order's PO; null for a supplier deposit. */
  po: string | null;
  currency: Currency;
  amount: number;
  paid: number;
  pending: number;
  /** Paid on, due on, or the day the supplier deposit was agreed (YYYY-MM-DD). */
  date: string;
  mode: string;
  reference: string;
  notes: string;
  status: DepositStatus;
  /** The order, or the supplier's statement. */
  href: string;
};

/** Every deposit as the table shows it, in DEP-1's order: order deposits first (latest first), then supplier deposits (newest first). */
export function toRows({ orderDeposits, supplierDeposits }: DepositsResponse): DepositRow[] {
  return [
    ...orderDeposits.map(
      (d): DepositRow => ({
        id: d.id,
        kind: "order",
        supplierId: d.supplierId,
        supplier: d.supplier,
        po: d.po,
        currency: d.currency,
        amount: d.amountCny,
        paid: d.status === "paid" ? d.amountCny : 0,
        pending: d.status === "due" ? d.amountCny : 0,
        date: d.paidOn ?? d.dueDate ?? "",
        mode: d.mode ?? "",
        reference: d.reference,
        notes: d.notes,
        status: d.status,
        href: orderHref(d.po),
      }),
    ),
    ...supplierDeposits.map(
      (d): DepositRow => ({
        id: d.id,
        kind: d.direction,
        supplierId: d.supplierId,
        supplier: d.supplier,
        po: null,
        currency: d.currency,
        amount: d.amount,
        paid: d.settled,
        pending: d.pending,
        date: d.openedOn,
        mode: "",
        reference: d.reference,
        notes: d.notes,
        status: d.status,
        href: statementHref(d.supplierId),
      }),
    ),
  ];
}

/** Pending: due order deposits and supplier deposits with something left; Paid: paid order deposits and settled ones. */
export const inView = (row: DepositRow, view: DepositView) =>
  view === "all" || (view === "pending" ? row.pending > 0 : row.status === "paid" || row.status === "settled");

export type DepositFilters = {
  /** A supplier id, or null for all. */
  supplierId: string | null;
  /** Matched against the PO, ignoring case. */
  po: string;
  /** YYYY-MM-DD bounds on `date`, inclusive; "" for none. */
  from: string;
  to: string;
  status: DepositStatus | null;
  currency: Currency | null;
  kind: DepositKind | null;
};

export const EMPTY_FILTERS: DepositFilters = { supplierId: null, po: "", from: "", to: "", status: null, currency: null, kind: null };

/** Client-side filtering of the loaded rows (every deposit is loaded, as Orders does). */
export function filterDeposits(rows: DepositRow[], f: DepositFilters) {
  const po = f.po.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (f.supplierId === null || row.supplierId === f.supplierId) &&
      (!po || (row.po ?? "").toLowerCase().includes(po)) &&
      (!f.from || row.date >= f.from) &&
      (!f.to || row.date <= f.to) &&
      (f.status === null || row.status === f.status) &&
      (f.currency === null || row.currency === f.currency) &&
      (f.kind === null || row.kind === f.kind),
  );
}

export const isFiltered = (f: DepositFilters) => JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);

const currencyOf = (row: { currency: Currency }) => row.currency;

/** The overview cards, from the rows shown: each figure per currency. `paid`: paid, or received for deposits to receive. */
export const totals = (rows: DepositRow[]) => ({
  amount: sumByCurrency(rows, currencyOf, (r) => r.amount),
  paid: sumByCurrency(rows, currencyOf, (r) => r.paid),
  pending: sumByCurrency(rows, currencyOf, (r) => r.pending),
  count: rows.length,
});

/** The six figures of one direction: to give / given / pending to give (or to receive / received / pending to receive). */
export type DirectionTotals = { amount: MoneyTotal[]; paid: MoneyTotal[]; pending: MoneyTotal[]; count: number };
const directionTotals = (rows: DepositRow[]): DirectionTotals => ({ ...totals(rows) });

export type SupplierSummary = { supplierId: string; supplier: string; give: DirectionTotals; receive: DirectionTotals; href: string };

/** One line per supplier with supplier deposits in `rows` (order deposits are not part of give or receive), by name. */
export function supplierSummaries(rows: DepositRow[]): SupplierSummary[] {
  const bySupplier = new Map<string, DepositRow[]>();
  for (const row of rows) if (row.kind !== "order") bySupplier.set(row.supplierId, [...(bySupplier.get(row.supplierId) ?? []), row]);
  return [...bySupplier.entries()]
    .map(([supplierId, list]) => ({
      supplierId,
      supplier: list[0]!.supplier,
      give: directionTotals(list.filter((r) => r.kind === "give")),
      receive: directionTotals(list.filter((r) => r.kind === "receive")),
      href: statementHref(supplierId),
    }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier));
}

/** SD-1's summary lines of one direction as the statement's three figures, per currency (CNY, USD, INR order). */
export function statementTotals(summary: SupplierStatement["summary"], direction: DepositDirection): Omit<DirectionTotals, "count"> {
  const lines = summary.filter((line) => line.direction === direction).sort((a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency));
  const pick = (key: "amount" | "settled" | "pending") => lines.map((line) => ({ currency: line.currency, amount: line[key] }));
  return { amount: pick("amount"), paid: pick("settled"), pending: pick("pending") };
}

/** "¥1,234.50", "¥1,000": paise shown only when there are some, as the API's own messages do. */
export const amountText = (value: number, currency: Currency) => formatMoney(value, currency, { decimals: Number.isInteger(value) ? 0 : 2 });

/** Notes in a table cell: the first line, cut at `max` characters with an ellipsis. */
export function trimNotes(notes: string, max = 40) {
  const line = notes.split("\n")[0]!.trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
