import { addDays, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfWeek } from "date-fns";

import type { FilterOption } from "@/components/shared/filters";
import { MOCK_TODAY } from "@/lib/constants";

import type { Delivery } from "./data/queries";

// Pure derivations shared by the Month, Week and List views. Each reproduces the references exactly from the
// stored due dates and MOCK_TODAY (30 Sep 2026).

const MONDAY = { weekStartsOn: 1 } as const;

export const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

export const dueOn = (deliveries: Delivery[], day: Date) => deliveries.filter((d) => d.due === isoDay(day));

/** Monday-first weeks covering the month: 28 Sep – 1 Nov for October 2026. */
export function monthWeeks(month: string) {
  const first = parseISO(month);
  const days = eachDayOfInterval({ start: startOfWeek(first, MONDAY), end: endOfWeek(endOfMonth(first), MONDAY) });
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

/** The week of `today`, Monday to Sunday: 28 Sep – 4 Oct 2026. */
export function weekDays(today = MOCK_TODAY) {
  const start = startOfWeek(parseISO(today), MONDAY);
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

/** "Deliveries per day" for the next 7 days after `today`: Thu 1 … Wed 7. */
export function deliveriesPerDay(deliveries: Delivery[], today = MOCK_TODAY) {
  const start = addDays(parseISO(today), 1);
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map((day) => ({
    label: format(day, "EEE d"),
    value: dueOn(deliveries, day).length,
  }));
}

/** "4 days", "1 day": how late a delivery is on `today`. */
export function lateBy(due: string, today = MOCK_TODAY) {
  const days = differenceInCalendarDays(parseISO(today), parseISO(due));
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "All suppliers" followed by the suppliers in the deliveries, alphabetically. */
export function supplierOptions(deliveries: Delivery[]): FilterOption[] {
  const suppliers = [...new Set(deliveries.map((d) => d.supplier))].sort();
  return [{ value: "all", label: "All suppliers" }, ...suppliers.map((s) => ({ value: s, label: s }))];
}
