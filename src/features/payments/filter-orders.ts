import type { OrderPaymentRow } from "./data/queries";

/** Header search: case-insensitive match on PO number or supplier name. */
export function filterOrders(rows: OrderPaymentRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.po.toLowerCase().includes(q) || row.supplier.toLowerCase().includes(q));
}
