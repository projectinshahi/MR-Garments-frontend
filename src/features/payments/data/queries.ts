import { addDays, format, parseISO } from "date-fns";

import { canOpen, hasAccess } from "@/config/navigation";
import type { AdvanceSupplierOption, AdvanceSuppliersResponse } from "@/lib/api/deposits-types";
import type { LedgerTotal, PaymentRow } from "@/lib/api/ledger-types";
import { apiGet } from "@/lib/api/server";
import type { OrderOptions, PaymentsResponse } from "@/lib/api/types";
import { getMe } from "@/lib/session";
import { sumByCurrency } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import type { MoneyTotal, Tone } from "@/types/domain";

import { live } from "../money";

// Payments (16, the unified supplier ledger) reads PAY-1: every payment (orderless supplier payments, legacy
// order-linked ones and shipping-agent ones, voided ones flagged), the orders with the API's FIFO figures, and the
// supplier accounts' per-currency totals. Voided payments are listed but count in no total here. The call reads the
// session cookie, so the page renders inside the (app) loading.tsx Suspense boundary; a failure throws to error.tsx.

export type Payment = PaymentRow;

/** A PAY-1 order with its next-due tone (danger overdue, warning within 7 days). */
export type OrderPaymentRow = PaymentsResponse["orders"][number] & { nextDueTone?: Tone };

/** Due payments whose due date falls from today to today + N days, one total per currency (no INR rate until paid). */
export type DueWindow = { amounts: MoneyTotal[]; count: number; first: { po: string | null; due: string } | null };

/**
 * `paidSoFarInr`: Σ INR of the non-void paid payments (every payee); `paidCount` how many; `unrated` paid ones without
 * an INR figure. `payable` / `available`: LED-2 totals per currency (held accounts left out), never added together.
 */
export type PaymentsKpis = {
  paidSoFarInr: number;
  paidCount: number;
  unrated: number;
  payable: MoneyTotal[];
  available: MoneyTotal[];
  dueNext30: DueWindow;
};

export type PaymentsData = {
  kpis: PaymentsKpis;
  orders: OrderPaymentRow[];
  payments: Payment[];
  totals: LedgerTotal[];
  /** The first order that has payments (else the first order), or null when there are no orders. */
  defaultPo: string | null;
};

const plusDays = (isoDate: string, days: number) => format(addDays(parseISO(isoDate), days), "yyyy-MM-dd");

function dueWithin(payments: Payment[], today: string, days: number): DueWindow {
  const until = plusDays(today, days);
  const due = live(payments)
    .filter((p): p is Payment & { dueDate: string } => p.status === "due" && !!p.dueDate && p.dueDate >= today && p.dueDate <= until)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    amounts: sumByCurrency(due, (p) => p.currency, (p) => p.amountCny),
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
export function toPaymentsData({ orders, payments, totals = [] }: PaymentsResponse, today: string): PaymentsData {
  const rows = orders.map((o): OrderPaymentRow => ({ ...o, nextDueTone: dueTone(o.nextDue, today) }));
  const paid = live(payments).filter((p) => p.status === "paid");
  const pick = (key: "payableCny" | "availableCny") => totals.filter((t) => t[key] > 0).map((t) => ({ currency: t.currency, amount: t[key] }));
  return {
    kpis: {
      paidSoFarInr: Math.round(paid.reduce((sum, p) => sum + (p.amountInr ?? 0), 0) * 100) / 100,
      paidCount: paid.length,
      unrated: paid.filter((p) => p.amountInr === null).length,
      payable: pick("payableCny"),
      available: pick("availableCny"),
      dueNext30: dueWithin(payments, today, 30),
    },
    orders: rows,
    payments,
    totals,
    defaultPo: (rows.find((r) => payments.some((p) => p.po === r.po)) ?? rows[0])?.po ?? null,
  };
}

export type PaymentsScreenData = Awaited<ReturnType<typeof getPayments>>;

/**
 * What the signed-in user may do here. payments Enter: Record payment (ADV-5's suppliers with their currencies and
 * balances) and Record sea freight payment (ORD-2's shipping agents); `suppliers`/`agents` null without it. A 403 or
 * any failure on either list just means none. payments Full: Void. `linkPo`: POs open the order page.
 */
export async function getPaymentAccess() {
  const me = await getMe();
  const canEnter = !!me && hasAccess(me, "payments", "Enter");
  const [agents, suppliers] = canEnter
    ? await Promise.all([
        apiGet<OrderOptions>("/orders/options").then(
          (options) => options.agents,
          (): OrderOptions["agents"] => [],
        ),
        apiGet<AdvanceSuppliersResponse>("/supplier-advances/suppliers").then(
          (response) => response.suppliers,
          (): AdvanceSupplierOption[] => [],
        ),
      ])
    : [null, null];
  return {
    agents,
    suppliers,
    linkPo: !!me && canOpen(me, "/orders"),
    // PAY-3 (void) and LED-3 (adjustment) need payments Full (Management); the API refuses anyone else too.
    canVoid: !!me && hasAccess(me, "payments", "Full"),
  };
}

/** PAY-1 GET /api/v1/payments. Today is read after the API call (Cache Components). */
export async function getPayments() {
  const [response, access] = await Promise.all([apiGet<PaymentsResponse>("/payments"), getPaymentAccess()]);
  return { ...toPaymentsData(response, todayInIndia()), ...access };
}
