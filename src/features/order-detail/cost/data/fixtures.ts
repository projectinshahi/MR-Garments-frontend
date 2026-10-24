// Screenshot-faithful records from 13_3.1.h_Cost.jpeg (D1). Read only through ./queries.ts (D2).

export type CostGroup = "goods" | "duty" | "transport";

export type CostLine = {
  part: string;
  detail: string;
  /** INR */
  amount: number;
  /** "Where the money goes" segment */
  group: CostGroup;
};

export type OrderCost = { pieces: number; lines: CostLine[] };

export const orderCosts: Record<string, OrderCost> = {
  "PO-2028": {
    pieces: 2_500,
    lines: [
      { part: "Goods", detail: "¥70,000 deposit at 12.00", amount: 840_000, group: "goods" },
      { part: "Goods", detail: "¥10,000 balance at 14.00", amount: 140_000, group: "goods" },
      { part: "Sea freight", detail: "In supplier price (CNF)", amount: 0, group: "goods" },
      { part: "Duty and taxes", detail: "Customs duty", amount: 196_000, group: "duty" },
      { part: "Duty and taxes", detail: "Other duties and taxes", amount: 142_000, group: "duty" },
      { part: "Clearing", detail: "Agent charges", amount: 18_000, group: "duty" },
      { part: "Clearing", detail: "Port and terminal charges", amount: 14_500, group: "duty" },
      { part: "Transport", detail: "Freight, Kerala Roadways", amount: 22_000, group: "transport" },
      { part: "Transport", detail: "Loading and unloading", amount: 4_500, group: "transport" },
    ],
  },
};
