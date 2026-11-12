import { z } from "zod";

import type { CreateSupplierBody } from "@/lib/api/types";
import { MESSAGES } from "@/lib/feedback";
import { formatINR, formatNumber, formatRateInr } from "@/lib/formatters";
import type { Currency, RecordStatus } from "@/types/domain";

export type StatusFilter = RecordStatus | "All";

// Case- and space-insensitive, so "+86138" finds "+86 138 0013 2244" and "guangzhou textile" finds the name.
const squash = (text: string) => text.toLowerCase().replace(/\s+/g, "");

/** Search (name or phone, or the closest visible columns) and the Active / Inactive / All chips. */
export function filterRecords<T extends { status: RecordStatus }>(
  rows: T[],
  { query, status }: { query: string; status: StatusFilter },
  searchText: (row: T) => string[],
) {
  const needle = squash(query);
  return rows.filter(
    (row) => (status === "All" || row.status === status) && searchText(row).some((text) => squash(text).includes(needle)),
  );
}

const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// At least five digits, whatever surrounds them: "+86 138 0013 2244", "WeChat 13800132244" (the API's rule too).
const hasPhoneDigits = (phone: string) => (phone.match(/\d/g)?.length ?? 0) >= 5;

// The rate as typed: up to 8 digits and at most 4 decimals (the API's numeric(12,4)); "0" and "0.0000" fail the > 0 rule.
const RATE = /^\d{1,8}(\.\d{1,4})?$/;

/**
 * Add / Edit supplier (53_17.4, and the Suppliers page), the fields of the MD-2 body. The code and the name are
 * required (the code is offered as the next SUP-nnn); the currency (CNY, USD or INR) is the one currency of the
 * supplier's new orders and deposits, and the exchange rate (INR per 1 unit of it) is required unless the currency is
 * INR, whose rate is fixed at 1 (checkExchangeRate); email and phone are checked for shape when given. The API applies
 * the same rules (backend docs/suppliers.md, docs/supplier-currency.md).
 */
export const supplierFields = z.object({
  code: z.string().trim().regex(CODE, MESSAGES.supplierCode).transform((code) => code.toUpperCase()),
  name: z.string().trim().min(1, MESSAGES.supplierNameEmpty),
  country: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  postalCode: z.string().trim(),
  contactPerson: z.string().trim(),
  email: z.string().trim().refine((email) => email === "" || EMAIL.test(email), MESSAGES.emailInvalid),
  phone: z.string().trim().refine((phone) => phone === "" || hasPhoneDigits(phone), MESSAGES.phoneInvalid),
  currency: z.string().regex(/^[A-Z]{3}$/, MESSAGES.currency),
  /** INR per 1 unit of `currency`, as typed; "" while never set. Read-only "1" for an INR supplier. */
  exchangeRate: z.string().trim(),
  address: z.string().trim(),
  paymentTerms: z.string().trim(),
  taxNumber: z.string().trim(),
  notes: z.string().trim(),
});
export type SupplierDraft = z.infer<typeof supplierFields>;

/** What is wrong with the rate for `currency`, or null: INR takes any (it is stored as 1); the rest need 0 < rate with at most 4 decimals. */
export const exchangeRateProblem = (currency: Currency, exchangeRate: string) =>
  currency === "INR" || (RATE.test(exchangeRate) && Number(exchangeRate) > 0) ? null : MESSAGES.exchangeRate;
/** The rate rule as a refinement, for the fields or a form that extends them. */
export const checkExchangeRate = (values: { currency: Currency; exchangeRate: string }, ctx: { addIssue: (issue: { code: "custom"; path: string[]; message: string }) => void }) => {
  const message = exchangeRateProblem(values.currency, values.exchangeRate);
  if (message) ctx.addIssue({ code: "custom", path: ["exchangeRate"], message });
};
export const supplierSchema = supplierFields.superRefine(checkExchangeRate);

/** The MD-2 body: the rate as a number, 1 for an INR supplier whatever its field says. */
export const toSupplierBody = ({ exchangeRate, ...values }: SupplierDraft): CreateSupplierBody => ({
  ...values,
  exchangeRate: values.currency === "INR" ? 1 : Number(exchangeRate),
});

/** A list's "Exchange rate" cell: "₹12.50" (INR per 1 unit), "1.00" for an INR supplier, "Not set" while there is none. */
export const exchangeRateText = (currency: Currency, exchangeRate: number | null) =>
  exchangeRate === null ? "Not set" : currency === "INR" ? "1.00" : formatRateInr(exchangeRate);

/** The code the Add dialog offers: the highest SUP-nnn in the list plus one (SUP-001 for an empty list). */
export function suggestSupplierCode(rows: { code: string }[]) {
  const highest = Math.max(0, ...rows.map((row) => Number(/^SUP-(\d{1,9})$/.exec(row.code)?.[1] ?? 0)));
  return `SUP-${String(highest + 1).padStart(3, "0")}`;
}

/** Teams "Average per piece": "–" until the team holds stock (B6.2, 5.6). */
export const averagePerPieceText = (value: number | null) => (value === null ? "–" : formatINR(value, 2));

/** Items "Item price": the default rate per unit to 2 decimals, or "–" while none is set. */
export const itemPriceText = (price: number | null | undefined) => (price == null ? "–" : formatNumber(price, 2));
