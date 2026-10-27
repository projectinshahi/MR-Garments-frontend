import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import type { DeliveryItem } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";

import { toDelivery } from "../deliveries";

export type { Delivery, DeliveryStatus } from "../deliveries";

export type CalendarData = Awaited<ReturnType<typeof getCalendar>>;

/**
 * CAL-1 for all three views, measured against today in India (read after the API call, as Cache Components needs).
 * The month and week shown are today's. Cached per request: the layout and the page share one call.
 */
export const getCalendar = cache(async () => {
  const items = await apiGet<DeliveryItem[]>("/deliveries");
  const today = todayInIndia();
  return { today, month: `${today.slice(0, 7)}-01`, deliveries: items.map((item) => toDelivery(item, today)) };
});
