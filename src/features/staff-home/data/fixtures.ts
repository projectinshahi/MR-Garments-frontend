import type { Tone } from "@/types/domain";

// Screenshot-faithful records from 39_14_Staff_home.jpeg (D1). Read only through ./queries.ts (D2).
// The waiting orders agree with Orders (05) but the Calendar shows other items for PO-2038, 2041, 2044, 2047 and
// 2049 (inventory §9). The PO-2035 receipts (460 + 500 pcs) differ from the Record receipt form (21). Both kept.

/** An order not yet received in China, waiting for the staff member to record a receipt. */
export type WaitingOrder = {
  po: string;
  item: string;
  supplier: string;
  ordered: number;
  unit: string;
  /** ISO date */
  due: string;
  /** Shown as "26 Sep · late". Stored as in the screenshot (D1). */
  late: boolean;
  dueTone: Tone;
};

/** A receipt this staff member saved recently. */
export type RecentReceipt = {
  id: string;
  po: string;
  item: string;
  received: number;
  unit: string;
  bundles: number;
  /** ISO date */
  savedOn: string;
};

/** Stored as shown, not computed from a clock (the reference was taken in the afternoon). */
export const salutation = "Good afternoon";

export const waitingOrders: WaitingOrder[] = [
  { po: "PO-2041", item: "Cotton fabric rolls", supplier: "Guangzhou Textile Co.", ordered: 5_000, unit: "m", due: "2026-09-26", late: true, dueTone: "danger" },
  { po: "PO-2038", item: "Buttons and zips", supplier: "Yiwu Trims Ltd.", ordered: 40_000, unit: "pcs", due: "2026-09-27", late: true, dueTone: "danger" },
  { po: "PO-2044", item: "Ladies kurtis", supplier: "Shenzhen Apparel", ordered: 3_200, unit: "pcs", due: "2026-09-29", late: true, dueTone: "danger" },
  { po: "PO-2047", item: "Polo shirts", supplier: "Guangzhou Textile Co.", ordered: 1_800, unit: "pcs", due: "2026-10-01", late: false, dueTone: "warning" },
  { po: "PO-2049", item: "Cotton denim fabric", supplier: "Foshan Fabrics", ordered: 2_400, unit: "m", due: "2026-10-03", late: false, dueTone: "success" },
];

export const recentReceipts: RecentReceipt[] = [
  { id: "rcpt-2035-jackets", po: "PO-2035", item: "Men's jackets", received: 460, unit: "pcs", bundles: 9, savedOn: "2026-09-24" },
  { id: "rcpt-2035-labels", po: "PO-2035", item: "Care labels", received: 500, unit: "pcs", bundles: 9, savedOn: "2026-09-24" },
];

/** "What you can do": the entry-only China staff permissions. */
export const allowedActions = [
  "Record goods received in China",
  "Add bundles, office, who received, and a short remark",
  "Change a receipt you entered",
];

/** "Not shown to your account". */
export const hiddenAreas = [
  "Payments, deposits and exchange rates",
  "Cost and landed cost",
  "Reports and the management dashboard",
  "Other stages such as containers, clearing and transport",
];
