import { z } from "zod";

import type { CreateDepositTransactionBody, CreateSupplierDepositBody } from "@/lib/api/deposits-types";
import { CURRENCIES } from "@/types/domain";

// New deposit (SD-2) and Record payment / receipt (SD-3): what the inputs hold (strings, as typed), the client-side
// checks mirroring the API, and the bodies. Messages are the API's own (backend deposits.routes.ts MESSAGES).

export const MESSAGES = {
  direction: "Choose Give or Receive.",
  amount: "Enter an amount above 0.",
  currency: "Choose CNY, USD or INR.",
  openedOn: "Enter the date the deposit was agreed.",
  paidOn: "Enter the date of the payment or receipt.",
  future: "The date can't be in the future.",
  mode: "Enter the payment mode.",
  modeTooLong: "Use 100 characters or fewer for the mode.",
  referenceTooLong: "Use 100 characters or fewer for the reference.",
  notesTooLong: "Use 1,000 characters or fewer for the notes.",
};
const M = MESSAGES;

/** "2,345.50" → 2345.5; blank is 0, anything else unreadable is NaN. */
const toNumber = (text: string) => Number(text.replace(/,/g, "").trim());
// 0.01 .. 999,999,999,999 with at most 2 decimals, as the API takes it.
const amount = z
  .string()
  .transform(toNumber)
  .pipe(z.number({ error: M.amount }).min(0.01, M.amount).max(999_999_999_999, M.amount).refine((value) => Number(value.toFixed(2)) === value, M.amount));
const notAfter = (today: string, missing: string) => z.iso.date({ error: missing }).refine((day) => day <= today, M.future);
const reference = z.string().trim().max(100, M.referenceTooLong);
const notes = z.string().trim().max(1000, M.notesTooLong);

/** `today` is the date in India (YYYY-MM-DD): a deposit can't be agreed after it. */
export const newDepositSchema = (today: string) =>
  z.object({
    direction: z.string().pipe(z.enum(["give", "receive"], { error: M.direction })),
    amount,
    currency: z.string().pipe(z.enum(CURRENCIES, { error: M.currency })),
    openedOn: notAfter(today, M.openedOn),
    reference,
    notes,
  });
export type NewDepositInput = z.input<ReturnType<typeof newDepositSchema>>;
export type NewDepositValues = z.output<ReturnType<typeof newDepositSchema>>;

export const emptyDeposit = (currency: string, today: string): NewDepositInput => ({ direction: "", amount: "", currency, openedOn: today, reference: "", notes: "" });

/** The SD-2 body: an empty reference or notes are left out (the API stores ""). */
export const toCreateDepositBody = ({ reference, notes, ...values }: NewDepositValues): CreateSupplierDepositBody => ({
  ...values,
  ...(reference ? { reference } : {}),
  ...(notes ? { notes } : {}),
});

export const settlementSchema = (today: string) =>
  z.object({
    paidOn: notAfter(today, M.paidOn),
    amount,
    mode: z.string().trim().min(1, M.mode).max(100, M.modeTooLong),
    reference,
    notes,
  });
export type SettlementInput = z.input<ReturnType<typeof settlementSchema>>;
export type SettlementValues = z.output<ReturnType<typeof settlementSchema>>;

/** Opens with today and the deposit's pending amount filled in, as typed: "700" or "1,234.5" stays readable. */
export const emptySettlement = (pending: number, today: string): SettlementInput => ({ paidOn: today, amount: String(pending), mode: "", reference: "", notes: "" });

export const toSettlementBody = ({ reference, notes, ...values }: SettlementValues): CreateDepositTransactionBody => ({
  ...values,
  ...(reference ? { reference } : {}),
  ...(notes ? { notes } : {}),
});
