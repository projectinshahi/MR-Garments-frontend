// Screenshot-faithful records from 14_3.1.i_History.jpeg (D1), newest first. Read only through ./queries.ts (D2).

export type HistoryEvent = {
  /** ISO date-time */
  at: string;
  who: string;
  team: string;
  title: string;
  detail: string;
};

export const orderHistory: Record<string, HistoryEvent[]> = {
  "PO-2028": [
    {
      at: "2026-10-03T16:10",
      who: "Joseph M",
      team: "Warehouse",
      title: "Received in warehouse",
      detail: "50 of 50 bundles. Given to teams: Retail 1,000 · Wholesale 1,000 · Online 500",
    },
    { at: "2026-10-01T14:25", who: "Ravi K", team: "Transport", title: "Loaded on vehicle", detail: "KL 07 CD 4821 · LR-558214 · Kerala Roadways" },
    {
      at: "2026-10-01T10:00",
      who: "Anil Sharma",
      team: "India office",
      title: "Cleared from port, handed to transport",
      detail: "Kochi Clearing Services · BE-7710482",
    },
    { at: "2026-09-30T17:35", who: "Anil Sharma", team: "India office", title: "Duty calculated", detail: "Total clearing cost ₹3,70,500" },
    { at: "2026-09-29T11:20", who: "Anil Sharma", team: "India office", title: "Handed to clearing agent", detail: "Kochi Clearing Services" },
    { at: "2026-09-28T09:40", who: "Anil Sharma", team: "India office", title: "Container arrived at Kochi port", detail: "CAIU 2298076" },
    { at: "2026-09-09T15:05", who: "Li Wei", team: "China office", title: "Loaded into container", detail: "CAIU 2298076 · Sino Freight · CNF" },
    { at: "2026-08-26T16:20", who: "Accounts", team: "Accounts", title: "Balance payment recorded", detail: "¥10,000 at 14.00 = ₹1,40,000" },
    { at: "2026-08-26T11:05", who: "Wang Fang", team: "China office", title: "Received in China", detail: "50 bundles, 2,500 pcs, no shortage" },
    {
      at: "2026-08-12T12:30",
      who: "Procurement",
      team: "Procurement",
      title: "Delivery date changed",
      detail: "25 Aug 2026 → 28 Aug 2026 · asked by supplier",
    },
    { at: "2026-08-05T15:40", who: "Accounts", team: "Accounts", title: "Deposit recorded", detail: "¥70,000 at 12.00 = ₹8,40,000" },
    { at: "2026-08-05T10:12", who: "Procurement", team: "Procurement", title: "Order created", detail: "2,500 pcs Denim jeans · ¥80,000 · CNF" },
  ],
};
