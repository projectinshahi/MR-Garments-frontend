import { getCurrentUser } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { RecentReceipt, WaitingOrder } from "./fixtures";

export type StaffHomeData = Awaited<ReturnType<typeof getStaffHome>>;

/** Everything the entry-only staff home shows for the signed-in mock staff user (Chen Yu). */
export async function getStaffHome() {
  const user = await getCurrentUser("staff");
  return structuredClone({
    greeting: `${fixtures.salutation}, ${user.name}`,
    waitingOrders: fixtures.waitingOrders,
    recentReceipts: fixtures.recentReceipts,
    allowedActions: fixtures.allowedActions,
    hiddenAreas: fixtures.hiddenAreas,
  });
}
