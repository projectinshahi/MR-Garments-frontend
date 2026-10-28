import { cache } from "react";

import { canOpen } from "@/config/navigation";
import { apiGet } from "@/lib/api/server";
import type { DeliveryItem } from "@/lib/api/types";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

import { toDelivery } from "../deliveries";

export type { Delivery, DeliveryStatus } from "../deliveries";

export type CalendarData = Awaited<ReturnType<typeof getCalendar>>;

/**
 * CAL-1 for all three views, measured against today in India (read after the API call, as Cache Components needs),
 * and whether PO numbers link to the order (the user can open Orders). The views pick the period and filters from the
 * URL. Cached per request: the layout and the page share one call.
 */
export const getCalendar = cache(async () => {
  const [items, me] = await Promise.all([apiGet<DeliveryItem[]>("/deliveries"), getMe()]);
  const today = todayInIndia();
  return { today, deliveries: items.map((item) => toDelivery(item, today)), linkOrders: me ? canOpen(me, "/orders") : false };
});
