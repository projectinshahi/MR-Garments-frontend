import { canOpen } from "@/config/navigation";
import { getMe } from "@/lib/session";

import * as fixtures from "./fixtures";

export type { ContainerRow, DashboardKpis, DeliveryRow, PaymentDueRow, StageCount } from "./fixtures";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Everything the management dashboard shows. Async and copied so a real API can replace the fixtures. */
export async function getDashboard() {
  const me = await getMe();
  // A card links to its page only when the user may open it (the proxy would send them back to the dashboard).
  const can = (path: string) => !!me && canOpen(me, path);
  return {
    ...structuredClone({
      kpis: fixtures.kpis,
      ordersByStage: fixtures.ordersByStage,
      deliveries: fixtures.deliveries,
      paymentsDue: fixtures.paymentsDue,
      containersOnTheWay: fixtures.containersOnTheWay,
    }),
    links: { calendar: can("/calendar"), payments: can("/payments"), containers: can("/containers") },
  };
}
