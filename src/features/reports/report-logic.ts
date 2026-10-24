import { differenceInCalendarDays, parseISO } from "date-fns";

import type { MonthCost, ReceivedLine, SupplierPayment } from "./data/queries";

// Derived values for the reports. Each reproduces its reference exactly (see report-logic.test.ts).

/** Position of `date` on a timeline axis, in percent: `start` is 0 %, `end` is 100 %. */
export function axisPercent(date: string, start: string, end: string) {
  const from = parseISO(start);
  return (differenceInCalendarDays(parseISO(date), from) * 100) / differenceInCalendarDays(parseISO(end), from);
}

/** Left edge and width (percent) of a bar from `from` to `to` on the axis. */
export function barSpan(from: string, to: string, axis: { start: string; end: string }) {
  const left = axisPercent(from, axis.start, axis.end);
  return { left, width: axisPercent(to, axis.start, axis.end) - left };
}

/** Quantity not received (13.3 "Short"). */
export const shortQty = (line: Pick<ReceivedLine, "ordered" | "received">) => Math.max(0, line.ordered - line.received);

/** 13.3 KPIs: orders checked, orders with a shortage, ¥ value taken off, orders received in full. */
export function summarizeReceived(lines: ReceivedLine[]) {
  const short = lines.filter((line) => shortQty(line) > 0);
  return {
    checked: lines.length,
    shortPos: short.map((line) => line.po),
    shortValue: short.reduce((sum, line) => sum + (line.shortValue ?? 0), 0),
    full: lines.length - short.length,
  };
}

/** 13.5 balance per supplier (¥). */
export const balance = (row: Pick<SupplierPayment, "orderValue" | "paid">) => row.orderValue - row.paid;

/** 13.5 totals row and KPIs. */
export function supplierTotals(rows: SupplierPayment[]) {
  const sum = (pick: (row: SupplierPayment) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    orders: sum((row) => row.orders.length),
    orderValue: sum((row) => row.orderValue),
    paid: sum((row) => row.paid),
    paidInr: sum((row) => row.paidInr),
    balance: sum(balance),
  };
}

/** ₹ per piece, or null when nothing was received. */
export const perPiece = (landedCost: number, pieces: number) => (pieces > 0 ? landedCost / pieces : null);

/** 13.6 totals row and KPIs, plus the biggest month's cost. */
export function monthTotals(months: MonthCost[]) {
  const pieces = months.reduce((sum, m) => sum + m.pieces, 0);
  const landedCost = months.reduce((sum, m) => sum + m.landedCost, 0);
  return { pieces, landedCost, perPiece: perPiece(landedCost, pieces), biggest: Math.max(...months.map((m) => m.landedCost)) };
}
