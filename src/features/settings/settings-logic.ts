import { z } from "zod";

import type { RecordStatus, Supplier } from "@/types/domain";

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

/** Add supplier dialog (53_17.4). Only the supplier name is required; currency is yuan only (Q8). */
export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Enter the supplier name."),
  city: z.string().trim(),
  contactPerson: z.string().trim(),
  phone: z.string().trim(),
  currency: z.enum(["CNY"]),
  address: z.string().trim(),
  notes: z.string().trim(),
});
export type SupplierDraft = z.infer<typeof supplierSchema>;

/** A saved supplier joins the table as Active with no open orders. */
export function addSupplier(rows: Supplier[], draft: SupplierDraft): Supplier[] {
  const { name, contactPerson, phone, city, currency } = draft;
  return [...rows, { id: `sup-new-${rows.length + 1}`, name, contactPerson, phone, city, currency, openOrders: 0, status: "Active" }];
}
