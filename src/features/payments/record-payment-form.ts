import { z } from "zod";

import type { CreatePaymentBody } from "@/lib/api/types";

// Record payment (PAY-2): what the inputs hold (strings, as typed), the client-side checks mirroring the API, and the
// PAY-2 body. Messages are the API's own (backend payments.routes.ts MESSAGES), so both sides say the same thing.

/** The "Paid to" value for the order's supplier; any other value is a shipping agent's id. */
export const SUPPLIER_PAYEE = "supplier";

export const MESSAGES = {
  order: "Choose an order from the list.",
  kind: "Choose Deposit or Balance.",
  payee: "Choose who the payment was paid to.",
  amount: "Enter an amount above 0.",
  paidOn: "Enter the date the payment was made.",
  paidOnFuture: "The payment date can't be in the future.",
  rateInr: "Enter an INR rate above 0.",
  mode: "Enter the payment mode.",
  modeTooLong: "Use 100 characters or fewer for the mode.",
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

/** `today` is the date in India (YYYY-MM-DD): a payment can't be dated after it. */
export const recordPaymentSchema = (today: string) =>
  z.object({
    orderId: z.string().min(1, M.order),
    kind: z.string().pipe(z.enum(["Deposit", "Balance"], { error: M.kind })),
    payee: z.string().min(1, M.payee),
    amountCny: decimal(M.amount, 0.01, 999_999_999_999),
    paidOn: z.iso.date({ error: M.paidOn }).refine((day) => day <= today, M.paidOnFuture),
    rateInr: decimal(M.rateInr, 0.0001, 99_999_999),
    mode: z.string().trim().min(1, M.mode).max(100, M.modeTooLong),
  });
export type RecordPaymentInput = z.input<ReturnType<typeof recordPaymentSchema>>;
export type RecordPaymentValues = z.output<ReturnType<typeof recordPaymentSchema>>;

export const emptyPayment = (orderId: string, today: string): RecordPaymentInput => ({
  orderId,
  kind: "",
  payee: SUPPLIER_PAYEE,
  amountCny: "",
  paidOn: today,
  rateInr: "",
  mode: "",
});

export function toCreatePaymentBody({ payee, ...values }: RecordPaymentValues): CreatePaymentBody {
  const supplier = payee === SUPPLIER_PAYEE;
  return { ...values, payeeRole: supplier ? "supplier" : "agent", agentId: supplier ? null : payee };
}

/** PAY-2 422 field → the form field it belongs under. Fields the form doesn't have are shown as a toast instead. */
export const FORM_FIELD: Record<string, keyof RecordPaymentInput> = {
  orderId: "orderId",
  kind: "kind",
  payeeRole: "payee",
  agentId: "payee",
  amountCny: "amountCny",
  paidOn: "paidOn",
  rateInr: "rateInr",
  mode: "mode",
};
