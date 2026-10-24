import * as fixtures from "./fixtures";

export type { OrderPaymentDetail, OrderPaymentRow, PaymentsKpis, ScheduledPayment } from "./fixtures";

export type PaymentsData = Awaited<ReturnType<typeof getPayments>>;

/** Everything Deposits & Payments shows. Async and copied so a real API can replace the fixtures. */
export async function getPayments() {
  return structuredClone({ kpis: fixtures.kpis, orders: fixtures.orders, detail: fixtures.selectedDetail });
}
