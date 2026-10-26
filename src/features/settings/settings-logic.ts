import { z } from "zod";

import type { ItemRow } from "@/lib/api/types";
import { MESSAGES } from "@/lib/feedback";
import { formatINR, formatNumber } from "@/lib/formatters";
import type { RecordStatus } from "@/types/domain";

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

/** Add supplier dialog (53_17.4), the MD-2 body. Only the supplier name is required; currency is yuan only (Q8). */
export const supplierSchema = z.object({
  name: z.string().trim().min(1, MESSAGES.supplierNameEmpty),
  city: z.string().trim(),
  contactPerson: z.string().trim(),
  phone: z.string().trim(),
  currency: z.enum(["CNY"]),
  address: z.string().trim(),
  notes: z.string().trim(),
});
export type SupplierDraft = z.infer<typeof supplierSchema>;

/** Teams "Average per piece": "–" until the team holds stock (B6.2, 5.6). */
export const averagePerPieceText = (value: number | null) => (value === null ? "–" : formatINR(value, 2));

/** Items "Pieces per bundle": the bundle label ("Roll") when set, otherwise the number (MD-19 sets exactly one). */
export const perBundleText = ({ perBundle, bundleLabel }: Pick<ItemRow, "perBundle" | "bundleLabel">) =>
  bundleLabel ?? formatNumber(perBundle ?? 0);
