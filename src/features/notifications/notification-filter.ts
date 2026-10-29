import type { FilterOption } from "@/components/shared/filters";
import { canOpen } from "@/config/navigation";
import type { Me, Notification } from "@/lib/api/types";

/** Chip values: everything, the unread ones, or one category. */
export type NotificationFilter = "all" | "unread" | "late-delivery" | "payment" | "container";

/** Who is looking, as far as `canOpen` needs it. */
export type Viewer = Pick<Me, "shell" | "permissions">;

type KindStyle = { dot: string; filter?: NotificationFilter };

// The dot colours of 50_17.1: red (short), blue (payment, container). No kind is a late delivery yet, so that chip
// stays empty until the backend adds one. Kinds the contract doesn't list yet: a neutral dot, under "All" only.
const KIND_STYLES: Record<string, KindStyle | undefined> = {
  "short-receipt": { dot: "bg-chart-5" },
  "payment-recorded": { dot: "bg-chart-1", filter: "payment" },
  "container-loaded": { dot: "bg-chart-1", filter: "container" },
  "container-sailed": { dot: "bg-chart-1", filter: "container" },
  "container-arrived": { dot: "bg-chart-1", filter: "container" },
};
const NEUTRAL: KindStyle = { dot: "bg-muted-foreground/50" };

export const kindStyle = (kind: string) => KIND_STYLES[kind] ?? NEUTRAL;

/** The chips in the order shown in 50_17.1, right-aligned above the list. `unread` counts all unread, not just loaded. */
export function notificationFilterOptions(unread: number): (FilterOption & { value: NotificationFilter })[] {
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
export function filterNotifications(items: Notification[], filter: NotificationFilter) {
  if (filter === "all") return items;
  if (filter === "unread") return items.filter((item) => !item.read);
  return items.filter((item) => kindStyle(item.kind).filter === filter);
}

/**
 * The page a notification opens: an app path ("/…", not "//host") the viewer may open, else null. Dot segments and
 * backslashes are refused, so "/notifications/../users" can't pass the check as /notifications and land elsewhere.
 */
export function notificationTarget(viewer: Viewer | null, href: string | null) {
  if (!viewer || !href?.startsWith("/") || href.startsWith("//")) return null;
  const path = href.split(/[?#]/)[0]!;
  if (/\\|(^|\/)\.\.?(\/|$)/.test(path)) return null;
  return canOpen(viewer, path) ? href : null;
}
