import * as fixtures from "./fixtures";

export type { Delivery, DeliveryStatus } from "./fixtures";

export type CalendarData = Awaited<ReturnType<typeof getCalendar>>;

/** Deliveries for all three calendar views. Async and copied so a real API can replace the fixtures. */
export async function getCalendar() {
  return structuredClone({ month: fixtures.calendarMonth, deliveries: fixtures.deliveries });
}
