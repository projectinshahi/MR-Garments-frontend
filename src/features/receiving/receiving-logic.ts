import type { ReceiptLine, ReceiptRow, ReceiptState } from "./data/queries";

export const ALL = "all";

export type ReceiptFilters = { query: string; office: string; supplier: string; state: ReceiptState | typeof ALL };

/** Client-side list filtering: PO or supplier search, office, supplier and status chip. */
export function filterReceipts(rows: ReceiptRow[], { query, office, supplier, state }: ReceiptFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.po.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q)) &&
      (office === ALL || r.office === office) &&
      (supplier === ALL || r.supplier === supplier) &&
      (state === ALL || r.state === state),
  );
}

/** Quantity still missing after this receipt; never negative. */
export const lineShort = (line: ReceiptLine) => Math.max(0, line.ordered - line.receivedEarlier - line.receivedNow);

/** Effect on payment: balance before this receipt, less the value of short priced lines. */
export function paymentEffect(payment: { orderValue: number; depositsPaid: number }, lines: ReceiptLine[]) {
  const balanceBefore = payment.orderValue - payment.depositsPaid;
  const deductions = lines.flatMap((line) => {
    if (line.unitPrice === undefined) return [];
    const short = lineShort(line);
    return [{ unit: line.unit, short, unitPrice: line.unitPrice, amount: short * line.unitPrice }];
  });
  const balanceNow = balanceBefore - deductions.reduce((sum, d) => sum + d.amount, 0);
  return { balanceBefore, deductions, balanceNow };
}
