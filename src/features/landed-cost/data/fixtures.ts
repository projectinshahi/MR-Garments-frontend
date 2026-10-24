import type { Terms } from "@/types/domain";

// Landed Cost (31_12_Landed_Cost.jpeg), transcribed exactly (D1). Only PO-2028's breakdown is designed.

export type OrderCostRow = {
  po: string;
  item: string;
  qty: number;
  /** Goods cost in INR (each payment at its own date's rate). */
  purchase: number;
  /** CNF: sea freight is in the supplier price ("In price (CNF)"). */
  terms: Terms;
  /** INR; 0 for CNF orders. */
  seaFreight: number;
  /** INR; null while still waiting for the bill ("Waiting"). */
  duty: number | null;
  transport: number | null;
};

export type CostPartKey = "goods" | "duty" | "transport";

export type OrderBreakdown = {
  po: string;
  item: string;
  parts: { key: CostPartKey; label: string; qualifier?: string; value: number }[];
  /** Muted row under the legend: costs that add nothing to this order. */
  excluded: { label: string; value: number };
};

export type GoodsPayment = { label: string; date: string; amountCny: number; rate: number };

export const orders: OrderCostRow[] = [
  { po: "PO-2028", item: "Denim jeans", qty: 2500, purchase: 980000, terms: "CNF", seaFreight: 0, duty: 370500, transport: 26500 },
  { po: "PO-2019", item: "Track pants", qty: 3000, purchase: 490000, terms: "FOB", seaFreight: 38000, duty: 160000, transport: 21000 },
  { po: "PO-2024", item: "Silk sarees", qty: 900, purchase: 830000, terms: "CNF", seaFreight: 0, duty: null, transport: null },
];

/** "Still an estimate" sub-line reason, as shown. */
export const estimateReason = "waiting for duty";

export const breakdown: OrderBreakdown = {
  po: "PO-2028",
  item: "Denim jeans",
  parts: [
    { key: "goods", label: "Goods", qualifier: "paid to supplier, in INR", value: 980000 },
    { key: "duty", label: "Duty, taxes and clearing", value: 370500 },
    { key: "transport", label: "Transport in India", value: 26500 },
  ],
  excluded: { label: "Sea freight and short-receipt deduction", value: 0 },
};

export const goodsPayments: GoodsPayment[] = [
  { label: "Deposit", date: "2026-08-05", amountCny: 70000, rate: 12 },
  { label: "Balance", date: "2026-08-26", amountCny: 10000, rate: 14 },
];
