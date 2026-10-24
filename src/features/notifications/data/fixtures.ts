import { formatCNY, formatINR, formatQty, formatShortDate } from "@/lib/formatters";

// Screenshot-faithful fixtures (D1): 50_17.1_Notifications.jpeg. Seven notifications in the order shown (newest first).

/** What a notification is about. The filter chips select on it (see notification-filter.ts). */
export type NotificationCategory = "late-delivery" | "delivery-reminder" | "payment" | "container" | "short-receipt";

/** Dot colour as drawn: red (late, short), amber (due tomorrow), blue (payment, container), green (duty calculated). */
export type NotificationDot = "red" | "amber" | "blue" | "green";

export type NotificationItem = {
  id: string;
  title: string;
  /** Parts of the muted detail line, shown joined with " · ". */
  details: string[];
  /**
   * Time label exactly as shown. Not computed: the last two rows read "30 Sep" (the `MOCK_TODAY` date) below
   * "24 Sep", while the first rows say "Today", so no clock reproduces all seven labels.
   */
  time: string;
  unread: boolean;
  category: NotificationCategory;
  dot: NotificationDot;
};

export const notifications: NotificationItem[] = [
  {
    id: "ntf-2044-late",
    title: "PO-2044 delivery is 1 day late",
    // PO-2044 is "Men’s shirts 1,800 pcs" here, as on the Calendar; Orders (5) shows Ladies kurtis (inventory §9).
    details: ["Shenzhen Apparel", `was due ${formatShortDate("2026-09-29")}`, `Men’s shirts ${formatQty(1_800, "pcs")}`],
    time: "Today, 09:00",
    unread: true,
    category: "late-delivery",
    dot: "red",
  },
  {
    id: "ntf-2047-2053-due",
    title: "PO-2047 and PO-2053 are due tomorrow (1 Oct)",
    details: ["Guangzhou Textile Co.", "Yiwu Trims Ltd."],
    time: "Today, 09:00",
    unread: true,
    category: "delivery-reminder",
    dot: "amber",
  },
  {
    id: "ntf-2041-payment",
    title: "Payment due in 5 days: PO-2041",
    details: ["Guangzhou Textile Co.", formatCNY(50_000), `about ${formatINR(1_500_000)}`],
    time: "Today, 08:30",
    unread: true,
    category: "payment",
    dot: "blue",
  },
  {
    id: "ntf-msku-4471203-arrival",
    title: "Container MSKU 4471203 arrives on 2 Oct",
    details: ["Sino Freight", "FOB", formatQty(60, "bundles")],
    time: "Yesterday, 18:10",
    unread: false,
    category: "container",
    dot: "blue",
  },
  {
    id: "ntf-2035-short",
    title: "Short receipt: PO-2035, 40 pcs short",
    details: [`Payment reduced by ${formatCNY(2_400)}`, "remark by Chen Yu"],
    time: "24 Sep, 16:45",
    unread: false,
    category: "short-receipt",
    dot: "red",
  },
  {
    id: "ntf-caiu-2298076-duty",
    title: "Duty calculated for CAIU 2298076",
    details: [`Total clearing cost ${formatINR(370_500)}`],
    time: "30 Sep, 17:35",
    unread: false,
    // Clearing is done per container, so the duty notice is listed under "Containers".
    category: "container",
    dot: "green",
  },
  {
    id: "ntf-2041-late",
    title: "PO-2041 delivery is 4 days late",
    details: ["Guangzhou Textile Co.", `was due ${formatShortDate("2026-09-26")}`],
    time: "30 Sep, 09:00",
    unread: false,
    category: "late-delivery",
    dot: "red",
  },
];
