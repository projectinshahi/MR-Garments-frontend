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
