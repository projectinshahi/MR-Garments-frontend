import { hasAccess } from "@/config/navigation";
import { getCurrentUser } from "@/lib/data/master";
import { getMe } from "@/lib/session";

import * as fixtures from "./fixtures";

export type { RecentReceipt, WaitingOrder } from "./fixtures";

export type StaffHomeData = Awaited<ReturnType<typeof getStaffHome>>;

/** Everything the entry-only staff home shows for the signed-in mock staff user (Chen Yu). */
export async function getStaffHome() {
  const [user, me] = await Promise.all([getCurrentUser("staff"), getMe()]);
  return structuredClone({
    // Only staff granted Receiving Enter can record (India and Warehouse staff would be sent back by the proxy).
    canRecordReceipt: !!me && hasAccess(me, "receiving", "Enter"),
    greeting: `${fixtures.salutation}, ${user.name}`,
    waitingOrders: fixtures.waitingOrders,
    recentReceipts: fixtures.recentReceipts,
    allowedActions: fixtures.allowedActions,
    hiddenAreas: fixtures.hiddenAreas,
  });
}
