import { paymentsByPO } from "./fixtures";

export type OrderPayments = NonNullable<Awaited<ReturnType<typeof getOrderPayments>>>;
export type PaymentRow = OrderPayments["payments"][number];

/** Deposits & payments tab (08). Each payment is converted at its own day's rate. */
export async function getOrderPayments(po: string) {
  const fixture = paymentsByPO[po];
  if (!fixture) return undefined;
  const data = structuredClone(fixture);
  const payments = data.payments.map((p) => ({ ...p, inr: p.amount * p.rate }));
  const orderValue = data.pieces * data.pricePerPiece;
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    ...data,
    payments,
    orderValue,
    paid,
    balance: orderValue - paid,
    paidInr: payments.reduce((sum, p) => sum + p.inr, 0),
  };
}
