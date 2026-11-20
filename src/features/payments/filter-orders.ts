import type { OrderPaymentRow, Payment } from "./data/queries";

/** Header search: case-insensitive match on PO number or supplier name. */
export function filterOrders(rows: OrderPaymentRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.po.toLowerCase().includes(q) || row.supplier.toLowerCase().includes(q));
}

/** The same search over payments: PO (an orderless payment has none), supplier, payee or reference. */
export function filterPayments(rows: Payment[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => [row.po ?? "", row.supplier, row.payee, row.reference].some((field) => field.toLowerCase().includes(q)));
}
