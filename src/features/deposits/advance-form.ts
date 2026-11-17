import { z } from "zod";

import type { CreateAdvanceBody } from "@/lib/api/deposits-types";

// Add advance (ADV-2, backend docs/supplier-advance.md): what the inputs hold (strings, as typed), the checks mirroring
// the API, and the body. Messages are the API's own (backend advances.routes.ts MESSAGES). No order is chosen.

export const MESSAGES = {
  amount: "Enter an amount above 0, with at most 2 decimals.",
  paidOn: "Enter the date the advance was paid.",
  future: "The date can't be in the future.",
  rateInr: "Enter an INR rate above 0.",
  mode: "Enter the payment mode.",
  modeTooLong: "Use 100 characters or fewer for the mode.",
  referenceTooLong: "Use 100 characters or fewer for the reference.",
  notesTooLong: "Use 1,000 characters or fewer for the notes.",
};
const M = MESSAGES;

/** "2,345.50" → 2345.5; anything unreadable is NaN. */
const toNumber = (text: string) => Number(text.replace(/,/g, "").trim());
const decimal = (message: string, min: number, max: number, places: number) =>
  z
    .string()
    .transform(toNumber)
    .pipe(z.number({ error: message }).min(min, message).max(max, message).refine((value) => Number(value.toFixed(places)) === value, message));

/** `today` is the date in India: an advance can't be paid after it. An INR supplier takes no rate (the API stores 1). */
export const advanceSchema = (today: string, currency: string) =>
  z.object({
    amount: decimal(M.amount, 0.01, 999_999_999_999, 2),
    paidOn: z.iso.date({ error: M.paidOn }).refine((day) => day <= today, M.future),
    rateInr: currency === "INR" ? z.string().transform(() => undefined) : decimal(M.rateInr, 0.0001, 99_999_999, 4),
    mode: z.string().trim().min(1, M.mode).max(100, M.modeTooLong),
    reference: z.string().trim().max(100, M.referenceTooLong),
    notes: z.string().trim().max(1000, M.notesTooLong),
  });
export type AdvanceInput = z.input<ReturnType<typeof advanceSchema>>;
export type AdvanceValues = z.output<ReturnType<typeof advanceSchema>>;

/** Opens with today and the supplier's saved rate (empty while it has none), as on Record payment. */
export const emptyAdvance = (today: string, rate: number | null): AdvanceInput => ({ amount: "", paidOn: today, rateInr: rate === null ? "" : String(rate), mode: "", reference: "", notes: "" });

/** The ADV-2 body: no rate for INR; an empty reference or notes left out (the API stores ""). */
export const toAdvanceBody = ({ rateInr, reference, notes, ...values }: AdvanceValues): CreateAdvanceBody => ({
  ...values,
  ...(rateInr === undefined ? {} : { rateInr }),
  ...(reference ? { reference } : {}),
  ...(notes ? { notes } : {}),
});
