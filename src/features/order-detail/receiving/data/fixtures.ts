// Screenshot-faithful records from 09_3.1.d_Receiving.jpeg (D1). Read only through ./queries.ts (D2).

export type ReceivingFixture = {
  /** ISO date */
  receivedOn: string;
  office: string;
  receivedBy: string;
  ordered: { pieces: number; bundles: number };
  received: { pieces: number; bundles: number };
  /** KPI sub-line under "Short", as shown. */
  shortNote: string;
  lines: { item: string; ordered: number; received: number }[];
  remark: string;
  /** Photos and papers, as named in the reference. */
  files: string[];
  /** Receiving history, newest first, labels as shown. */
  history: { title: string; detail: string }[];
};

export const receivingByPO: Record<string, ReceivingFixture> = {
  "PO-2028": {
    receivedOn: "2026-08-26",
    office: "Guangzhou office",
    receivedBy: "Wang Fang",
    ordered: { pieces: 2500, bundles: 50 },
    received: { pieces: 2500, bundles: 50 },
    shortNote: "Nothing missing",
    lines: [{ item: "Denim jeans", ordered: 2500, received: 2500 }],
    remark: "All bundles checked against the packing list. Good condition.",
    files: ["Packing list.jpg", "Bundles at office.jpg"],
    history: [
      { title: "Received, no shortage", detail: "26 Aug 11:05 · Wang Fang" },
      { title: "Supplier said goods are ready", detail: "24 Aug · noted by Procurement" },
    ],
  },
};
