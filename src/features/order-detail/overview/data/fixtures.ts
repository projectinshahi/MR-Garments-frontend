import type { StageNumber, Terms } from "@/types/domain";

// Screenshot-faithful records from 06_3.1.a_Overview.jpeg (D1). Read only through ./queries.ts (D2).
// Item, supplier and status come from the shared order-detail header.

export type OverviewFixture = {
  contact: string;
  /** ISO dates */
  orderDate: string;
  deliveryDate: string;
  pieces: number;
  bundles: number;
  terms: Terms;
  enteredBy: string;
  /** One step per stage; `date` is ISO, `detail` is the line under it as shown. */
  journey: { stage: StageNumber; date: string; detail: string }[];
  /** "Money" card rows in INR; the total is the landed cost. */
  money: { label: string; inr: number }[];
  /** "Given to teams" card, in pieces. */
  teams: { team: string; pieces: number }[];
  /** "Latest activity", newest first, labels as shown. */
  activity: { title: string; detail: string }[];
};

export const overviews: Record<string, OverviewFixture> = {
  "PO-2028": {
    contact: "Mr. Zhao Lin",
    orderDate: "2026-08-05",
    deliveryDate: "2026-08-28",
    pieces: 2500,
    bundles: 50,
    terms: "CNF",
    enteredBy: "Procurement",
    journey: [
      { stage: 1, date: "2026-08-05", detail: "¥70,000 deposit paid" },
      { stage: 2, date: "2026-08-26", detail: "Guangzhou office · 50 bundles" },
      { stage: 3, date: "2026-09-09", detail: "CAIU 2298076 · Sino Freight" },
      { stage: 4, date: "2026-10-01", detail: "Kochi Clearing Services" },
      { stage: 5, date: "2026-10-01", detail: "LR-558214 · KL 07 CD 4821" },
      { stage: 6, date: "2026-10-03", detail: "Received by Joseph M" },
    ],
    money: [
      { label: "Goods, paid ¥80,000", inr: 980_000 },
      { label: "Duty, taxes and clearing", inr: 370_500 },
      { label: "Transport in India", inr: 26_500 },
    ],
    teams: [
      { team: "Retail team", pieces: 1000 },
      { team: "Wholesale team", pieces: 1000 },
      { team: "Online team", pieces: 500 },
    ],
    activity: [
      { title: "Received in warehouse", detail: "3 Oct · Joseph M · 50 bundles" },
      { title: "Loaded on vehicle", detail: "1 Oct · KL 07 CD 4821" },
      { title: "Duty calculated", detail: "30 Sep · ₹3,70,500" },
    ],
  },
};
