import type { Tone } from "@/types/domain";

// Order-detail header shared by tabs a–i (references 6–14). Orchestrator-owned; tab agents read it via queries.ts.

export type OrderDetailHeader = {
  po: string;
  item: string;
  supplier: string;
  status: { label: string; tone: Tone };
};

export const orderDetailHeaders: OrderDetailHeader[] = [
  { po: "PO-2028", item: "Denim jeans", supplier: "Guangzhou Textile Co.", status: { label: "Received in warehouse", tone: "success" } },
];
