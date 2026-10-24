import * as fixtures from "./fixtures";

export type { ContainerRow, DashboardKpis, DeliveryRow, PaymentDueRow, StageCount } from "./fixtures";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Everything the management dashboard shows. Async and copied so a real API can replace the fixtures. */
export async function getDashboard() {
  return structuredClone({
    kpis: fixtures.kpis,
    ordersByStage: fixtures.ordersByStage,
    deliveries: fixtures.deliveries,
    paymentsDue: fixtures.paymentsDue,
    containersOnTheWay: fixtures.containersOnTheWay,
  });
}
