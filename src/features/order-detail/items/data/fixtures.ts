import type { Terms } from "@/types/domain";

// Screenshot-faithful records from 07_3.1.b_Items.jpeg (D1). Read only through ./queries.ts (D2).

export type ItemLine = {
  item: string;
  style: string;
  pieces: number;
  bundles: number;
  /** CNY per piece */
  pricePerPiece: number;
};

export type ItemsFixture = {
  lines: ItemLine[];
  sizes: { size: string; pieces: number }[];
  piecesPerBundle: number;
  supplier: string;
  contact: string;
  terms: Terms;
  /** ISO dates */
  orderDate: string;
  deliveryDate: string;
  /** Label as shown */
  currency: string;
  notes: string;
};

export const itemsByPO: Record<string, ItemsFixture> = {
  "PO-2028": {
    lines: [{ item: "Denim jeans", style: "Blue, straight fit", pieces: 2500, bundles: 50, pricePerPiece: 32 }],
    sizes: [
      { size: "28", pieces: 300 },
      { size: "30", pieces: 600 },
      { size: "32", pieces: 800 },
      { size: "34", pieces: 500 },
      { size: "36", pieces: 300 },
    ],
    piecesPerBundle: 50,
    supplier: "Guangzhou Textile Co.",
    contact: "Mr. Zhao Lin",
    terms: "CNF",
    orderDate: "2026-08-05",
    deliveryDate: "2026-08-28",
    currency: "¥ Chinese yuan",
    notes: "Brand label on the inside neck. Pack 50 pieces per bundle. Supplier to send the packing list with photos.",
  },
};
