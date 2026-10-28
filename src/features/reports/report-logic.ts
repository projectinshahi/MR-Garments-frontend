import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

// Derived values for the reports: the containers timeline geometry (13.4; the axis runs from `start` at 0 % to `end`
// at 100 %, exclusive) and month labels.

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/** Position of `date` on a timeline axis, in percent: `start` is 0 %, `end` is 100 %. */
export function axisPercent(date: string, start: string, end: string) {
  const from = parseISO(start);
  return (differenceInCalendarDays(parseISO(date), from) * 100) / differenceInCalendarDays(parseISO(end), from);
}

/** Left edge and width (percent) of a bar from `from` to `to`, cut to the axis. */
export function barSpan(from: string, to: string, axis: { start: string; end: string }) {
  const at = (date: string) => Math.min(100, Math.max(0, axisPercent(date, axis.start, axis.end)));
  const left = at(from);
  return { left, width: at(to) - left };
}

/** The axis for a report window (`from`-`to` inclusive): ticks every 10 days from the start, and the last day. */
export function timelineAxis(from: string, to: string) {
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  const ticks = Array.from({ length: Math.ceil((days - 5) / 10) }, (_, index) => iso(addDays(parseISO(from), index * 10)));
  return { start: from, end: iso(addDays(parseISO(to), 1)), ticks: [...ticks, to] };
}

/** "Sep 2026" for 2026-09. */
export const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMM yyyy");
