import { differenceInCalendarDays, parseISO } from "date-fns";

import type { OrderListItem } from "@/lib/api/types";
import type { Tone } from "@/types/domain";

/** The chip an order counts under (Completed is stage 6, checked separately). */
export type StatusChip = "late" | "dueSoon" | "shortReceived" | null;
export type OrderStatus = { label: string; tone: Tone; chip: StatusChip };

const DUE_SOON_DAYS = 7;
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** Status label, tone and chip of an order (docs/live-screens-contracts.md, "Order status"); `today` is YYYY-MM-DD in India. */
export function orderStatus(
  order: Pick<OrderListItem, "stage" | "deliveryDate" | "quantity" | "received" | "unit">,
  today: string,
): OrderStatus {
  if (order.stage === 4) return { label: "In clearing", tone: "info", chip: null };
  if (order.stage === 5) return { label: "On the road", tone: "info", chip: null };
  if (order.stage === 6) return { label: "Received", tone: "success", chip: null };
  if (order.stage === 3 && order.received < order.quantity) {
    return { label: `Short by ${order.quantity - order.received} ${order.unit}`, tone: "warning", chip: "shortReceived" };
  }
  const ahead = differenceInCalendarDays(parseISO(order.deliveryDate), parseISO(today));
  if (ahead < 0 && order.stage <= 2) return { label: `Late ${days(-ahead)}`, tone: "danger", chip: "late" };
  if (ahead === 0) return { label: "Due today", tone: "warning", chip: "dueSoon" };
  if (ahead > 0 && ahead <= DUE_SOON_DAYS) return { label: `Due in ${days(ahead)}`, tone: "warning", chip: "dueSoon" };
  return { label: "On track", tone: "success", chip: null };
}
