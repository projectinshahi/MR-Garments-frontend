import * as fixtures from "./fixtures";

export type { NotificationCategory, NotificationDot, NotificationItem } from "./fixtures";

export type NotificationsData = Awaited<ReturnType<typeof getNotifications>>;

/** Notifications for the signed-in user, newest first. Async and copied so a real API can replace it. */
export async function getNotifications() {
  return structuredClone({ items: fixtures.notifications });
}
