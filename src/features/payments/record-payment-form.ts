import { z } from "zod";

import { toAdvanceBody } from "@/features/deposits/advance-form";
import type { CreatePaymentBody } from "@/lib/api/types";
import type { Currency } from "@/types/domain";

// Record payment (PAY-2): what the inputs hold (strings, as typed), the client-side checks mirroring the API, and the
// PAY-2 body. Messages are the API's own (backend payments.routes.ts MESSAGES), so both sides say the same thing.
// The amount is in the order's currency; an INR order takes no rate (the server stores 1). On Deposits & Payments the
// user first chooses the payment type: an order payment (PAY-2, as above) or a supplier advance with no order, recorded
// as the chosen supplier's advance (ADV-2, backend docs/supplier-advance.md) in the supplier's currency: one advance
// receipt, never a payment record as well.

/** The "Paid to" value for the order's supplier; any other value is a shipping agent's id. */
export const SUPPLIER_PAYEE = "supplier";

/** What the money is for: an order payment, or the supplier's advance (no order). Chosen first on Deposits & Payments. */
export type PaymentTarget = "order" | "advance";

export const MESSAGES = {
  target: "Choose Order payment or Supplier advance.",
  order: "Choose an order from the list.",
  supplier: "Choose a supplier from the list.",
  kind: "Choose Deposit or Balance.",
  payee: "Choose who the payment was paid to.",
  amount: "Enter an amount above 0.",
  paidOn: "Enter the date the payment was made.",
  paidOnFuture: "The payment date can't be in the future.",
  rateInr: "Enter an INR rate above 0.",
  mode: "Enter the payment mode.",
  modeTooLong: "Use 100 characters or fewer for the mode.",
  referenceTooLong: "Use 100 characters or fewer for the reference.",
  notesTooLong: "Use 1,000 characters or fewer for the notes.",
};
const M = MESSAGES;

/** "2,345.50" → 2345.5; blank is 0, anything else unreadable is NaN. */
export const toNumber = (text: string) => Number(text.replace(/,/g, "").trim());

/** The INR equivalent shown as you type: amount × rate to the paisa, 0 until both are numbers. */
export const paymentINR = (amountCny: string, rateInr: string) => {
  const inr = Math.round(toNumber(amountCny) * toNumber(rateInr) * 100) / 100;
  return Number.isFinite(inr) ? inr : 0;
};

const decimal = (message: string, min: number, max: number) =>
  z.string().transform(toNumber).pipe(z.number({ error: message }).min(min, message).max(max, message));

/**
 * `today` is the date in India (YYYY-MM-DD): a payment can't be dated after it. `currency` is the chosen order's (for
 * a supplier advance, the chosen supplier's): an INR one's rate is not asked, and not sent. `target` "advance": no order,
 * so the supplier is needed and the kind is Deposit (the money goes to the supplier's advance). The caller asks for the
 * payment type first; the schema is built for the one chosen, which is its output.
 */
export const recordPaymentSchema = (today: string, currency: Currency = "CNY", target: PaymentTarget = "order") => {
  const withOrder = target === "order";
  return z.object({
    target: z.string().optional().transform(() => target),
    orderId: withOrder ? z.string().min(1, M.order) : z.string(),
    supplierId: withOrder ? z.string().optional() : z.string().min(1, M.supplier),
    kind: withOrder ? z.string().pipe(z.enum(["Deposit", "Balance"], { error: M.kind })) : z.string().transform(() => "Deposit" as const),
    payee: z.string().min(1, M.payee),
    amountCny: decimal(M.amount, 0.01, 999_999_999_999),
    paidOn: z.iso.date({ error: M.paidOn }).refine((day) => day <= today, M.paidOnFuture),
    rateInr: currency === "INR" ? z.string().transform(() => undefined) : decimal(M.rateInr, 0.0001, 99_999_999),
    mode: z.string().trim().min(1, M.mode).max(100, M.modeTooLong),
    // Transaction or receipt number and notes (migration 0008), optional: left out of the body when empty.
    reference: z.string().trim().max(100, M.referenceTooLong).optional(),
    notes: z.string().trim().max(1000, M.notesTooLong).optional(),
  });
};
export type RecordPaymentInput = z.input<ReturnType<typeof recordPaymentSchema>>;
export type RecordPaymentValues = z.output<ReturnType<typeof recordPaymentSchema>>;

export const emptyPayment = (orderId: string, today: string): RecordPaymentInput => ({
  // No payment type chosen: the dialog asks for it before anything else.
  target: "",
  orderId,
  supplierId: "",
  kind: "",
  payee: SUPPLIER_PAYEE,
  amountCny: "",
  paidOn: today,
  rateInr: "",
  mode: "",
  reference: "",
  notes: "",
});

/** Empty reference and notes are left out (the API stores ""), so an older API that doesn't know them is fine too. */
export function toCreatePaymentBody({ orderId, kind, amountCny, paidOn, mode, payee, rateInr, reference, notes }: RecordPaymentValues): CreatePaymentBody {
  const supplier = payee === SUPPLIER_PAYEE;
  return {
    orderId,
    kind,
    amountCny,
    paidOn,
    mode,
    ...(rateInr === undefined ? {} : { rateInr }),
    payeeRole: supplier ? "supplier" : "agent",
    agentId: supplier ? null : payee,
    ...(reference ? { reference } : {}),
    ...(notes ? { notes } : {}),
  };
}

/** Without an order: the ADV-2 body for the chosen supplier's advance. Kind and payee don't apply (a deposit to the supplier). */
export const toSupplierAdvanceBody = ({ amountCny, paidOn, rateInr, mode, reference = "", notes = "" }: RecordPaymentValues) =>
  toAdvanceBody({ amount: amountCny, paidOn, rateInr, mode, reference, notes });

/** PAY-2 (or, without an order, ADV-2) 422 field → the form field it belongs under. Fields the form doesn't have are shown as a toast instead. */
export const FORM_FIELD: Record<string, keyof RecordPaymentInput> = {
  orderId: "orderId",
  kind: "kind",
  payeeRole: "payee",
  agentId: "payee",
  amountCny: "amountCny",
  amount: "amountCny",
  paidOn: "paidOn",
  rateInr: "rateInr",
  mode: "mode",
  reference: "reference",
  notes: "notes",
};
