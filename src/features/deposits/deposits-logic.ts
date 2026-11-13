import { orderHref } from "@/components/shared/po-link";
import type { DepositDirection, DepositsResponse, SupplierStatement } from "@/lib/api/deposits-types";
import { formatMoney, sumByCurrency } from "@/lib/formatters";
import { compareCurrencies } from "@/lib/currencies";
import type { Currency, MoneyTotal, Tone } from "@/types/domain";

// Deposits pages (docs/phase2-contracts.md 3.3, docs/phase2-fixes.md 2): DEP-1's lists as one table. An order whose
// supplier asked for a deposit is one obligation row (required / paid / pending, from DEP-1 `orderObligations`); its
// deposit payments stay on the order's Payments tab and are not listed here again, so nothing is counted twice. An
// order without a requirement lists each deposit payment (a `payments` row, paid or due) as before. A supplier deposit
// is settled by its transactions (give: paid to the supplier; receive: received from it). Payables (order deposits,
// deposits to give) and receivables (deposits to receive) are never netted, and amounts in different currencies are
// never added together.

export type DepositKind = "order" | DepositDirection;
export type DepositStatus = "paid" | "partly paid" | "due" | "open" | "partly settled" | "settled";
export type DepositView = "all" | "pending" | "paid";

export const KIND_LABEL: Record<DepositKind, string> = { order: "Order deposit", give: "To give", receive: "To receive" };
export const STATUS_LABEL: Record<DepositStatus, string> = { paid: "Paid", "partly paid": "Partly paid", due: "Due", open: "Open", "partly settled": "Partly settled", settled: "Settled" };
export const STATUS_TONE: Record<DepositStatus, Tone> = { paid: "success", "partly paid": "info", due: "warning", open: "warning", "partly settled": "info", settled: "success" };
/** The statuses a tab's rows can have (the Status filter offers these). */
export const VIEW_STATUSES: Record<DepositView, DepositStatus[]> = {
  all: ["due", "partly paid", "paid", "open", "partly settled", "settled"],
  pending: ["due", "partly paid", "open", "partly settled"],
  paid: ["paid", "settled"],
};

export const statementHref = (supplierId: string) => `/deposits/suppliers/${encodeURIComponent(supplierId)}`;

/** One row of the Deposits table, whichever list it came from. `paid` is paid (order, give) or received (receive). */
export type DepositRow = {
  id: string;
  kind: DepositKind;
  supplierId: string;
  /** The order's supplier, or the deposit's. */
  supplier: string;
  /** Who was paid: the order deposit's payee (the supplier or a shipping agent), the supplier for an obligation or a deposit to give; "" for one to receive. */
  payee: string;
  /** The order's PO; null for a supplier deposit. */
  po: string | null;
  currency: Currency;
  amount: number;
  paid: number;
  pending: number;
  /** Last paid on (an obligation; "" while nothing is paid), paid on, due on, or the day the supplier deposit was agreed (YYYY-MM-DD). */
  date: string;
  mode: string;
  reference: string;
  notes: string;
  status: DepositStatus;
  /** The order (its Payments tab for an obligation; null when the user can't open orders), or the supplier's statement. */
  href: string | null;
  /** An obligation row's paid deposit payments, shown as "N payments"; absent on other rows. */
  payments?: number;
  /** Who an order deposit payment went to; an agent's (sea freight) is shown apart from the supplier's requirement. Absent on other rows. */
  payeeRole?: "supplier" | "agent";
  /**
   * The exchange-rate snapshot (INR per 1 of `currency`): a paid order deposit's own rate, or the supplier's rate when a
   * supplier deposit was opened (0012); null for an obligation, a due deposit or a deposit opened without a rate.
   * `amountInr`: a paid order deposit at its rate; null otherwise (a supplier deposit has no INR figure).
   */
  rate: number | null;
  amountInr: number | null;
};

/**
 * Every deposit as the table shows it, in DEP-1's order: order obligations first (newest first), then the deposit
 * payments of orders without a requirement (latest first), then supplier deposits (newest first).
 */
export function toRows({ orderDeposits, orderObligations = [], supplierDeposits }: DepositsResponse, linkPo = true): DepositRow[] {
  // An older API sends no obligations: every deposit payment is then listed as before.
  const withRequirement = new Set(orderObligations.map((o) => o.orderId));
  return [
    ...orderObligations.map(
      (o): DepositRow => ({
        id: o.orderId,
        kind: "order",
        supplierId: o.supplierId,
        supplier: o.supplier,
        payee: o.supplier,
        po: o.po,
        currency: o.currency,
        amount: o.requiredCny,
        paid: o.paidCny,
        pending: o.pendingCny,
        date: o.lastPaidOn ?? "",
        mode: "",
        reference: "",
        notes: "",
        status: o.status === "partly" ? "partly paid" : o.status,
        href: linkPo ? `${orderHref(o.po)}/payments` : null,
        payments: o.payments,
        rate: null,
        amountInr: null,
      }),
    ),
    // Payments to the supplier of an order with a requirement are inside its obligation row; an agent's deposit (sea
    // freight) is not part of that requirement, so it keeps its own row, marked as the agent's (phase 2 final fixes, 4).
    ...orderDeposits
      .filter((d) => !withRequirement.has(d.orderId) || d.payeeRole !== "supplier")
      .map(
        (d): DepositRow => ({
          id: d.id,
          kind: "order",
          supplierId: d.supplierId,
          supplier: d.supplier,
          payee: d.payee,
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
          href: linkPo ? orderHref(d.po) : null,
          payeeRole: d.payeeRole,
          rate: d.rateInr,
          amountInr: d.amountInr,
        }),
      ),
    ...supplierDeposits.map(
      (d): DepositRow => ({
        id: d.id,
        kind: d.direction,
        supplierId: d.supplierId,
        supplier: d.supplier,
        payee: d.direction === "give" ? d.supplier : "",
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
        rate: d.exchangeRate ?? null,
        amountInr: null,
      }),
    ),
  ];
}

/** Pending: obligations, due order deposits and supplier deposits with something left; Paid: paid obligations and order deposits, and settled ones. */
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

/** One direction's figures, each per currency: the amounts agreed, paid (or received), pending, and how many deposits. */
export type DirectionTotals = { amount: MoneyTotal[]; paid: MoneyTotal[]; pending: MoneyTotal[]; count: number };
const totalsOf = (rows: DepositRow[]): DirectionTotals => ({
  amount: sumByCurrency(rows, currencyOf, (r) => r.amount),
  paid: sumByCurrency(rows, currencyOf, (r) => r.paid),
  pending: sumByCurrency(rows, currencyOf, (r) => r.pending),
  count: rows.length,
});

/** The overview cards, from the rows shown: payables (order deposits and deposits to give) and receivables apart, never netted. */
export const totals = (rows: DepositRow[]) => ({
  pay: totalsOf(rows.filter((row) => row.kind !== "receive")),
  receive: totalsOf(rows.filter((row) => row.kind === "receive")),
});

export type SupplierSummary = { supplierId: string; supplier: string; give: DirectionTotals; receive: DirectionTotals; href: string };

/** One line per supplier with supplier deposits in `rows` (order deposits are not part of give or receive), by name. */
export function supplierSummaries(rows: DepositRow[]): SupplierSummary[] {
  const bySupplier = new Map<string, DepositRow[]>();
  for (const row of rows) if (row.kind !== "order") bySupplier.set(row.supplierId, [...(bySupplier.get(row.supplierId) ?? []), row]);
  return [...bySupplier.entries()]
    .map(([supplierId, list]) => ({
      supplierId,
      supplier: list[0]!.supplier,
      give: totalsOf(list.filter((r) => r.kind === "give")),
      receive: totalsOf(list.filter((r) => r.kind === "receive")),
      href: statementHref(supplierId),
    }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier));
}

/** SD-1's summary lines of one direction as the statement's three figures, per currency (CNY, USD, INR order). */
export function statementTotals(summary: SupplierStatement["summary"], direction: DepositDirection): Omit<DirectionTotals, "count"> {
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
