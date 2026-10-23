import type { StageNumber, Tone } from "@/types/domain";

// Sample rows for /preview, copied from references 4 (dashboard) and 5 (orders list). Preview only.

export const previewStages = [
  { label: "1. Order and deposit", value: 14 },
  { label: "2. Receiving in China", value: 9 },
  { label: "3. Container loading", value: 11 },
  { label: "4. Clearing in India", value: 5 },
  { label: "5. Transport", value: 4 },
  { label: "6. India warehouse", value: 7 },
];

export type PreviewDelivery = { po: string; supplier: string; due: string; status: string; tone: Tone };
export const previewDeliveries: PreviewDelivery[] = [
  { po: "PO-2041", supplier: "Guangzhou Textile Co.", due: "2026-09-26", status: "Late 4 days", tone: "danger" },
  { po: "PO-2038", supplier: "Yiwu Trims Ltd.", due: "2026-09-27", status: "Late 3 days", tone: "danger" },
  { po: "PO-2044", supplier: "Shenzhen Apparel", due: "2026-09-29", status: "Late 1 day", tone: "danger" },
  { po: "PO-2047", supplier: "Guangzhou Textile Co.", due: "2026-10-01", status: "Due in 1 day", tone: "warning" },
  { po: "PO-2049", supplier: "Foshan Fabrics", due: "2026-10-03", status: "On track", tone: "success" },
];

export type PreviewOrder = { po: string; item: string; supplier: string; qty: number; unit: string; stage: StageNumber; status: string; tone: Tone; paidInr: number };
export const previewOrders: PreviewOrder[] = [
  { po: "PO-2049", item: "Cotton denim fabric", supplier: "Foshan Fabrics", qty: 2400, unit: "m", stage: 1, status: "On track", tone: "success", paidInr: 470000 },
  { po: "PO-2047", item: "Polo shirts", supplier: "Guangzhou Textile Co.", qty: 1800, unit: "pcs", stage: 1, status: "Due in 1 day", tone: "warning", paidInr: 310000 },
  { po: "PO-2044", item: "Ladies kurtis", supplier: "Shenzhen Apparel", qty: 3200, unit: "pcs", stage: 2, status: "Late 1 day", tone: "danger", paidInr: 560000 },
  { po: "PO-2028", item: "Denim jeans", supplier: "Guangzhou Textile Co.", qty: 2500, unit: "pcs", stage: 4, status: "In clearing", tone: "info", paidInr: 980000 },
  { po: "PO-2019", item: "Track pants", supplier: "Shenzhen Apparel", qty: 3000, unit: "pcs", stage: 6, status: "Received", tone: "success", paidInr: 490000 },
];

export const previewDeliveriesPerDay = [
  { label: "Thu 1", value: 2 },
  { label: "Fri 2", value: 1 },
  { label: "Sat 3", value: 2 },
  { label: "Sun 4", value: 0 },
  { label: "Mon 5", value: 1 },
  { label: "Tue 6", value: 1 },
  { label: "Wed 7", value: 1 },
];
