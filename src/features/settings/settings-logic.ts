import { z } from "zod";

import { MESSAGES } from "@/lib/feedback";
import { formatINR, formatNumber } from "@/lib/formatters";
import { CURRENCIES, type RecordStatus } from "@/types/domain";

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

/**
 * Add / Edit supplier (53_17.4, and the Suppliers page), the MD-2 body. The code and the name are required (the code
 * is offered as the next SUP-nnn); the currency (CNY, USD or INR) is the default for the supplier's new orders; email
 * and phone are checked for shape when given. The API applies the same rules (backend docs/suppliers.md).
 */
export const supplierSchema = z.object({
  code: z.string().trim().regex(CODE, MESSAGES.supplierCode).transform((code) => code.toUpperCase()),
  name: z.string().trim().min(1, MESSAGES.supplierNameEmpty),
  country: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  postalCode: z.string().trim(),
  contactPerson: z.string().trim(),
  email: z.string().trim().refine((email) => email === "" || EMAIL.test(email), MESSAGES.emailInvalid),
  phone: z.string().trim().refine((phone) => phone === "" || hasPhoneDigits(phone), MESSAGES.phoneInvalid),
  currency: z.enum(CURRENCIES),
  address: z.string().trim(),
  paymentTerms: z.string().trim(),
  taxNumber: z.string().trim(),
  notes: z.string().trim(),
});
export type SupplierDraft = z.infer<typeof supplierSchema>;

/** The code the Add dialog offers: the highest SUP-nnn in the list plus one (SUP-001 for an empty list). */
export function suggestSupplierCode(rows: { code: string }[]) {
  const highest = Math.max(0, ...rows.map((row) => Number(/^SUP-(\d{1,9})$/.exec(row.code)?.[1] ?? 0)));
  return `SUP-${String(highest + 1).padStart(3, "0")}`;
}

/** Teams "Average per piece": "–" until the team holds stock (B6.2, 5.6). */
export const averagePerPieceText = (value: number | null) => (value === null ? "–" : formatINR(value, 2));

/** Items "Item price": the default rate per unit to 2 decimals, or "–" while none is set. */
export const itemPriceText = (price: number | null | undefined) => (price == null ? "–" : formatNumber(price, 2));
