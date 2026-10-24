import type { FilterOption } from "@/components/shared/filters";

import type { NotificationCategory, NotificationItem } from "./data/queries";

/** Chip values: everything, the unread ones, or one category. */
export type NotificationFilter = "all" | "unread" | Extract<NotificationCategory, "late-delivery" | "payment" | "container">;

/** The chips in the order shown in 50_17.1, right-aligned above the list. */
export function notificationFilterOptions(items: NotificationItem[]): (FilterOption & { value: NotificationFilter })[] {
  const unread = items.filter((item) => item.unread).length;
  return [
    { value: "all", label: "All" },
    { value: "unread", label: `Unread (${unread})` },
    { value: "late-delivery", label: "Late deliveries" },
    { value: "payment", label: "Payments" },
    { value: "container", label: "Containers" },
  ];
}

export function isNotificationFilter(value: string): value is NotificationFilter {
  return ["all", "unread", "late-delivery", "payment", "container"].includes(value);
}

/** Client-side filtering for the chips; keeps the newest-first order. */
export function filterNotifications(items: NotificationItem[], filter: NotificationFilter) {
  if (filter === "all") return items;
  if (filter === "unread") return items.filter((item) => item.unread);
  return items.filter((item) => item.category === filter);
}
