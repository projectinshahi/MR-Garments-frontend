import { addDays, format, parseISO } from "date-fns";

import { apiGet } from "@/lib/api/server";
import type { PaymentsResponse } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";
import type { Tone } from "@/types/domain";

// Deposits & Payments (16) reads PAY-1. The call reads the session cookie, so the page renders inside the (app)
// loading.tsx Suspense boundary; a failed call throws to the (app) error.tsx.

export type Payment = PaymentsResponse["payments"][number];

export type OrderPaymentRow = {
  po: string;
  supplier: string;
  /** CNY */
  orderValue: number;
  /** CNY */
  paid: number;
  /** INR, each payment at the rate of its own date */
  paidInr: number;
  /** CNY */
  balance: number;
  /** YYYY-MM-DD, the earliest due payment; null shows "Not yet due". */
  nextDue: string | null;
  /** danger when overdue, warning when due within 7 days. */
  nextDueTone?: Tone;
};

/** Due payments whose due date falls from today to today + N days. The API has no INR rate for them: CNY only. */
export type DueWindow = { amountCny: number; count: number; first: { po: string; due: string } | null };

export type PaymentsKpis = { paidSoFarInr: number; openOrders: number; dueNext7: DueWindow; dueNext30: DueWindow };

export type PaymentsData = {
  kpis: PaymentsKpis;
  orders: OrderPaymentRow[];
  payments: Payment[];
  /** The first order that has payments (else the first order), or null when there are no orders. */
  defaultPo: string | null;
};

const plusDays = (isoDate: string, days: number) => format(addDays(parseISO(isoDate), days), "yyyy-MM-dd");

function dueWithin(payments: Payment[], today: string, days: number): DueWindow {
  const until = plusDays(today, days);
  const due = payments
    .filter((p): p is Payment & { dueDate: string } => p.status === "due" && !!p.dueDate && p.dueDate >= today && p.dueDate <= until)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    amountCny: due.reduce((sum, p) => sum + p.amountCny, 0),
    count: due.length,
    first: due[0] ? { po: due[0].po, due: due[0].dueDate } : null,
  };
}

function dueTone(nextDue: string | null, today: string): Tone | undefined {
  if (!nextDue) return undefined;
  if (nextDue < today) return "danger";
  if (nextDue <= plusDays(today, 7)) return "warning";
  return undefined;
}

/** Everything the screen shows, derived from PAY-1 with `today` (YYYY-MM-DD, India). */
export function toPaymentsData({ orders, payments }: PaymentsResponse, today: string): PaymentsData {
  const rows = orders.map(
    (o): OrderPaymentRow => ({
      po: o.po,
      supplier: o.supplier,
      orderValue: o.orderValueCny,
      paid: o.paidCny,
      paidInr: o.paidInr,
      balance: o.balanceCny,
      nextDue: o.nextDue,
      nextDueTone: dueTone(o.nextDue, today),
    }),
  );
  return {
    kpis: {
      paidSoFarInr: orders.reduce((sum, o) => sum + o.paidInr, 0),
      openOrders: orders.filter((o) => o.balanceCny > 0).length,
      dueNext7: dueWithin(payments, today, 7),
      dueNext30: dueWithin(payments, today, 30),
    },
    orders: rows,
    payments,
    defaultPo: (rows.find((r) => payments.some((p) => p.po === r.po)) ?? rows[0])?.po ?? null,
  };
}

/** PAY-1 GET /api/v1/payments. Today is read after the API call (Cache Components). */
export async function getPayments() {
  const response = await apiGet<PaymentsResponse>("/payments");
  return toPaymentsData(response, todayInIndia());
}
