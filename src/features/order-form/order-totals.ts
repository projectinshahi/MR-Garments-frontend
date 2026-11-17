// Totals for the New order form: line amounts, order total, deposits and the balance still to pay.
// Money is rounded to cents so float noise (6.2 × 2,400) never shows.

const cents = (value: number) => Math.round(value * 100) / 100;

/** "2,400" → 2400; empty or invalid input counts as 0. */
export const parseNumber = (text: string) => Number(text.replace(/,/g, "")) || 0;

export const lineAmount = (line: { rate: number; quantity: number }) => cents(line.rate * line.quantity);

export const depositINR = (deposit: { amount: number; rate: number }) => cents(deposit.amount * deposit.rate);

export function orderTotals(lines: { rate: number; quantity: number }[], deposits: { amount: number; rate: number }[]) {
  const orderTotal = cents(lines.reduce((sum, line) => sum + lineAmount(line), 0));
  const depositsPaid = cents(deposits.reduce((sum, d) => sum + d.amount, 0));
  const depositsINR = cents(deposits.reduce((sum, d) => sum + depositINR(d), 0));
  return { orderTotal, depositsPaid, depositsINR, balance: cents(orderTotal - depositsPaid) };
}

/**
 * What the supplier's advance will cover when the order is placed (ORD-3 applies it; backend docs/supplier-advance.md):
 * the smaller of the advance available and what the order owes after the supplier deposits typed here (agent deposits
 * are sea freight). `remaining` is still to pay after both. The server's figure is the one saved.
 */
export function advancePreview(orderTotal: number, supplierDeposits: number, available: number) {
  const owed = Math.max(0, cents(orderTotal - supplierDeposits));
  const applied = Math.min(Math.max(0, available), owed);
  return { applied: cents(applied), remaining: cents(owed - applied), partial: applied > 0 && applied < owed };
}
