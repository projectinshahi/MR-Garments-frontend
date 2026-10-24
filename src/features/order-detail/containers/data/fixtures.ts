import type { Terms } from "@/types/domain";

// Screenshot-faithful records from 10_3.1.e_Containers.jpeg (D1). Read only through ./queries.ts (D2).

export type OrderContainerFixture = {
  number: string;
  terms: Terms;
  shippingAgent: string;
  /** China port, sea, Kochi port; `date` is ISO. */
  route: { place: string; event: string; date: string }[];
  seal: string;
  billOfLading: string;
  /** This order's goods in the container. */
  goods: { item: string; pieces: number; bundles: number };
  /** Share of this order in the container, in percent. */
  sharePercent: number;
};

export const containersByPO: Record<string, OrderContainerFixture[]> = {
  "PO-2028": [
    {
      number: "CAIU 2298076",
      terms: "CNF",
      shippingAgent: "Sino Freight",
      route: [
        { place: "Guangzhou (Nansha)", event: "Loaded", date: "2026-09-09" },
        { place: "On the sea", event: "Sailed", date: "2026-09-12" },
        { place: "Kochi port", event: "Arrived", date: "2026-09-28" },
      ],
      seal: "SL-830417",
      billOfLading: "SFL-2208-114",
      goods: { item: "Denim jeans", pieces: 2500, bundles: 50 },
      sharePercent: 100,
    },
  ],
};
