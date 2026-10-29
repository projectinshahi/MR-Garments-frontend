import { addDays, format, parseISO } from "date-fns";

import { lateBy, toDelivery } from "@/features/calendar/deliveries";
import { containerKpis, toContainerRow } from "@/features/containers/containers-logic";
import type { ContainerListItem, DeliveryItem, OrderListItem, PaymentsResponse } from "@/lib/api/types";
import type { StageNumber, Terms, Tone } from "@/types/domain";

// Pure derivations for the dashboard (04) from ORD-1, CAL-1, PAY-1 and CON-1. `today` is YYYY-MM-DD in India, so the
// dashboard agrees with the Orders, Calendar, Payments and Containers screens on the same day.

/** A source as the dashboard got it: its data, "denied" (403, the role can't see it) or "failed" (any other error). */
export type Source<T> = T | "denied" | "failed";

export const isAvailable = <T>(source: Source<T>): source is T => source !== "denied" && source !== "failed";
const map = <T, U>(source: Source<T>, derive: (value: T) => U): Source<U> => (isAvailable(source) ? derive(source) : source);

/** Rows per card: the cards hold five, and each links to its full list. */
const ROWS = 5;
const PAYMENTS_WINDOW_DAYS = 30;

export type StageCount = { stage: StageNumber; count: number };
export type DeliveryRow = { po: string; supplier: string; due: string; status: string; tone: Tone };
export type PaymentDueRow = { id: string; payee: string; po: string; payment: "Deposit" | "Balance"; due: string; amountCny: number };
export type ContainerRow = { container: string; agent: string; terms: Terms; etaIndia: string };

/** Active orders are stages 1-5 (stage 6, India warehouse, is complete); the stage list shows all six. */
function orders(list: OrderListItem[]) {
  const active = list.filter((o) => o.stage < 6);
  return {
    active: active.length,
    stages: new Set(active.map((o) => o.stage)).size,
    byStage: ([1, 2, 3, 4, 5, 6] as const).map((stage) => ({ stage, count: list.filter((o) => o.stage === stage).length })),
  };
}

/** CAL-1 (stage 1-2, due date oldest first): late ones, then those due within 7 days, as the calendar labels them. */
function deliveries(items: DeliveryItem[], today: string) {
  const all = items.map((item) => toDelivery(item, today));
  const late = all.filter((d) => d.status === "late");
  const dueSoon = all.filter((d) => d.status === "due-soon");
  return {
    late: late.length,
    dueNext7: dueSoon.length,
    dueSuppliers: new Set(dueSoon.map((d) => d.supplier)).size,
    rows: [...late, ...dueSoon].slice(0, ROWS).map(
      (d): DeliveryRow => ({
        po: d.po,
        supplier: d.supplier,
        due: d.due,
        status: d.status === "late" ? `Late ${lateBy(d.due, today)}` : d.statusLabel,
        tone: d.status === "late" ? "danger" : "warning",
      }),
    ),
  };
}

/** Due payments from today to 30 days ahead, as the Payments screen counts them. Due payments have no INR rate: CNY. */
function paymentsDue({ payments }: PaymentsResponse, today: string) {
  const until = format(addDays(parseISO(today), PAYMENTS_WINDOW_DAYS), "yyyy-MM-dd");
  const due = payments
    .filter((p): p is typeof p & { dueDate: string } => p.status === "due" && !!p.dueDate && p.dueDate >= today && p.dueDate <= until)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    amountCny: due.reduce((sum, p) => sum + p.amountCny, 0),
    windowDays: PAYMENTS_WINDOW_DAYS,
    rows: due.slice(0, ROWS).map((p): PaymentDueRow => ({ id: p.id, payee: p.payee, po: p.po, payment: p.kind, due: p.dueDate, amountCny: p.amountCny })),
  };
}

/** Containers at sea, soonest ETA first; "arriving this week" as the Containers screen counts it. */
function containersOnTheWay(items: ContainerListItem[], today: string) {
  const rows = items.map(toContainerRow);
  const atSea = rows.filter((r) => r.status === "sea").sort((a, b) => a.etaIndia.localeCompare(b.etaIndia));
  return {
    onTheWay: atSea.length,
    arrivingThisWeek: containerKpis(rows, today).arrivingThisWeek.length,
    rows: atSea.slice(0, ROWS).map((r): ContainerRow => ({ container: r.number, agent: r.agent, terms: r.terms, etaIndia: r.etaIndia })),
  };
}

export type DashboardSources = {
  orders: Source<OrderListItem[]>;
  deliveries: Source<DeliveryItem[]>;
  payments: Source<PaymentsResponse>;
  containers: Source<ContainerListItem[]>;
};

export const toDashboard = (sources: DashboardSources, today: string) => ({
  orders: map(sources.orders, orders),
  deliveries: map(sources.deliveries, (items) => deliveries(items, today)),
  paymentsDue: map(sources.payments, (response) => paymentsDue(response, today)),
  containers: map(sources.containers, (items) => containersOnTheWay(items, today)),
});
