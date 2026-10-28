import { addDays, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfWeek } from "date-fns";

import type { FilterOption } from "@/components/shared/filters";
import type { DeliveryItem } from "@/lib/api/types";

// Pure derivations shared by the Month, Week and List views. `today` is always passed in (the date in India, read by
// the query), so every status and label is measured against the same day.

/** late = due before today, due-soon = today to 7 days ahead, on-track = later. */
export type DeliveryStatus = "late" | "due-soon" | "on-track";

export type Delivery = {
  po: string;
  supplier: string;
  item: string;
  quantity: number;
  unit: string;
  /** ISO date */
  due: string;
  status: DeliveryStatus;
  /** "4 days late", "Due today", "Due in 1 day", "On track" */
  statusLabel: string;
};

export const MONDAY = { weekStartsOn: 1 } as const;
const DUE_SOON_DAYS = 7;

export const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A CAL-1 row as the views show it on `today`. */
export function toDelivery({ po, supplier, item, quantity, unit, due }: DeliveryItem, today: string): Delivery {
  const days = differenceInCalendarDays(parseISO(due), parseISO(today));
  if (days < 0) return { po, supplier, item, quantity, unit, due, status: "late", statusLabel: `${lateBy(due, today)} late` };
  if (days <= DUE_SOON_DAYS)
    return { po, supplier, item, quantity, unit, due, status: "due-soon", statusLabel: days === 0 ? "Due today" : `Due in ${plural(days, "day")}` };
  return { po, supplier, item, quantity, unit, due, status: "on-track", statusLabel: "On track" };
}

export const dueOn = (deliveries: Delivery[], day: Date) => deliveries.filter((d) => d.due === isoDay(day));

/** Monday-first weeks covering the month: 28 Sep – 1 Nov for October 2026. */
export function monthWeeks(month: string) {
  const first = parseISO(month);
  const days = eachDayOfInterval({ start: startOfWeek(first, MONDAY), end: endOfWeek(endOfMonth(first), MONDAY) });
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

/** The week holding `day`, Monday to Sunday: 28 Sep – 4 Oct 2026 for 30 Sep. */
export function weekDays(day: string) {
  const start = startOfWeek(parseISO(day), MONDAY);
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

/** "Deliveries per day" for the next 7 days after `today`: Thu 1 … Wed 7 for 30 Sep. */
export function deliveriesPerDay(deliveries: Delivery[], today: string) {
  const start = addDays(parseISO(today), 1);
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map((day) => ({
    label: format(day, "EEE d"),
    value: dueOn(deliveries, day).length,
  }));
}

/** "4 days", "1 day": how late a delivery is on `today`. */
export function lateBy(due: string, today: string) {
  return plural(differenceInCalendarDays(parseISO(today), parseISO(due)), "day");
}

/** "All suppliers" followed by the suppliers in the deliveries, alphabetically. */
export function supplierOptions(deliveries: Delivery[]): FilterOption[] {
  const suppliers = [...new Set(deliveries.map((d) => d.supplier))].sort();
  return [{ value: "all", label: "All suppliers" }, ...suppliers.map((s) => ({ value: s, label: s }))];
}
