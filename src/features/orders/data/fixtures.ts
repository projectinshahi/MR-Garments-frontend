import type { StageNumber, Tone } from "@/types/domain";

// Screenshot-faithful records from 05_3_Orders_list.jpeg (D1): page 1 of 5 of the 50 orders. Read only through
// ./queries.ts (D2). PO-2028 is "4. Clearing in India / In clearing" here although its detail screens show it received
// (inventory §9); PO-2024's supplier "Hangzhou Silk House" is not in the supplier master. Both are kept as shown.

export type OrderListRow = {
  po: string;
  item: string;
  supplier: string;
  quantity: number;
  unit: "m" | "pcs";
  /** ISO date */
  deliveryDate: string;
  stage: StageNumber;
  /** Label as shown ("Late 4 days"), stored rather than computed (D1). */
  status: string;
  tone: Tone;
  /** INR */
  paidSoFar: number;
};

/** Counts on the filter chips and the pager, as shown (only page 1 is designed). */
export type OrderCounts = { all: number; late: number; dueSoon: number; shortReceived: number };

export const counts: OrderCounts = { all: 50, late: 3, dueSoon: 5, shortReceived: 2 };

export const orders: OrderListRow[] = [
  { po: "PO-2049", item: "Cotton denim fabric", supplier: "Foshan Fabrics", quantity: 2_400, unit: "m", deliveryDate: "2026-10-03", stage: 1, status: "On track", tone: "success", paidSoFar: 470_000 },
  { po: "PO-2047", item: "Polo shirts", supplier: "Guangzhou Textile Co.", quantity: 1_800, unit: "pcs", deliveryDate: "2026-10-01", stage: 1, status: "Due in 1 day", tone: "warning", paidSoFar: 310_000 },
  { po: "PO-2044", item: "Ladies kurtis", supplier: "Shenzhen Apparel", quantity: 3_200, unit: "pcs", deliveryDate: "2026-09-29", stage: 2, status: "Late 1 day", tone: "danger", paidSoFar: 560_000 },
  { po: "PO-2041", item: "Cotton fabric rolls", supplier: "Guangzhou Textile Co.", quantity: 5_000, unit: "m", deliveryDate: "2026-09-26", stage: 2, status: "Late 4 days", tone: "danger", paidSoFar: 1_000_000 },
  { po: "PO-2038", item: "Buttons and zips", supplier: "Yiwu Trims Ltd.", quantity: 40_000, unit: "pcs", deliveryDate: "2026-09-27", stage: 2, status: "Late 3 days", tone: "danger", paidSoFar: 175_000 },
  { po: "PO-2035", item: "Men's jackets", supplier: "Shenzhen Apparel", quantity: 1_200, unit: "pcs", deliveryDate: "2026-09-12", stage: 3, status: "Short by 40 pcs", tone: "warning", paidSoFar: 620_000 },
  { po: "PO-2031", item: "Kids t-shirts", supplier: "Foshan Fabrics", quantity: 6_000, unit: "pcs", deliveryDate: "2026-09-05", stage: 3, status: "On track", tone: "success", paidSoFar: 745_000 },
  { po: "PO-2028", item: "Denim jeans", supplier: "Guangzhou Textile Co.", quantity: 2_500, unit: "pcs", deliveryDate: "2026-08-28", stage: 4, status: "In clearing", tone: "info", paidSoFar: 980_000 },
  { po: "PO-2024", item: "Silk sarees", supplier: "Hangzhou Silk House", quantity: 900, unit: "pcs", deliveryDate: "2026-08-20", stage: 5, status: "On the road", tone: "info", paidSoFar: 830_000 },
  { po: "PO-2019", item: "Track pants", supplier: "Shenzhen Apparel", quantity: 3_000, unit: "pcs", deliveryDate: "2026-08-10", stage: 6, status: "Received", tone: "success", paidSoFar: 490_000 },
];
