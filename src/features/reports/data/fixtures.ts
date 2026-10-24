// Screenshot-faithful fixtures for the Reports hub and the six reports (D1, D2). Each block reproduces its own
// reference exactly, even where another screen shows different values. Read only through ./queries.ts.

// ---- 32_13_Reports.jpeg ----------------------------------------------------------------------------------------

export type ReportCard = { category: string; title: string; description: string; stat: string; href: string };

export const reportCards: ReportCard[] = [
  {
    category: "Orders",
    title: "Order status",
    description: "See which of the six stages every order is in.",
    stat: "50 orders · 14 waiting at stage 1",
    href: "/reports/order-status",
  },
  {
    category: "Deliveries",
    title: "Deliveries due by date",
    description: "What is due each day, with late ones marked in red.",
    stat: "8 due in next 7 days · 3 late",
    href: "/reports/deliveries-per-day",
  },
  {
    category: "Receiving",
    title: "Ordered against received",
    description: "Shortages and remarks for every order received in China.",
    stat: "2 orders short · 40 pcs missing",
    href: "/reports/ordered-vs-received",
  },
  {
    category: "Shipping",
    title: "Containers and arrival dates",
    description: "What is inside each container, its agent and when it arrives.",
    stat: "6 on the way · 2 arrive this week",
    href: "/reports/containers-timeline",
  },
  {
    category: "Payments",
    title: "Payments and balance due",
    description: "Paid and due amounts for each supplier, in INR.",
    stat: "₹42,60,000 due in next 30 days",
    href: "/reports/payments-per-supplier",
  },
  {
    category: "Cost",
    title: "Landed cost",
    description: "Final cost per item, per order and per team.",
    stat: "2 orders finished · ₹20,86,000",
    href: "/reports/landed-cost-by-month",
  },
];

export type RecentDownload = { id: string; report: string; period: string; format: "Excel" | "PDF"; by: string; when: string };

// "When" labels are stored as shown (12-hour times have no shared formatter).
export const recentDownloads: RecentDownload[] = [
  { id: "dl-1", report: "Landed cost", period: "1 Sep – 30 Sep", format: "Excel", by: "Management", when: "29 Sep, 5:40 pm" },
  { id: "dl-2", report: "Payments and balance due", period: "This month", format: "PDF", by: "Management", when: "28 Sep, 11:15 am" },
  { id: "dl-3", report: "Ordered against received", period: "Last 7 days", format: "Excel", by: "Management", when: "26 Sep, 4:05 pm" },
];

export const reportPeriods = [{ value: "2026-09", label: "1 Sep – 30 Sep 2026" }];

// ---- 33_13.1_Order_status.jpeg ---------------------------------------------------------------------------------

export const orderStatus = {
  kpis: { active: 50, late: 3, finishedThisMonth: 6, averageDays: 38 },
  /** Orders in stages 1–6. */
  stageCounts: [14, 9, 11, 5, 4, 7],
  lateOrders: [
    { po: "PO-2041", supplier: "Guangzhou Textile Co.", due: "2026-09-26", lateBy: "4 days" },
    { po: "PO-2038", supplier: "Yiwu Trims Ltd.", due: "2026-09-27", lateBy: "3 days" },
    { po: "PO-2044", supplier: "Shenzhen Apparel", due: "2026-09-29", lateBy: "1 day" },
  ],
};

export type LateOrder = (typeof orderStatus.lateOrders)[number];

// ---- 34_13.2_Deliveries_per_day.jpeg ---------------------------------------------------------------------------

// KPIs as shown. "Days with none" says 6 although the chart has seven zero days; kept as in the reference (D1).
export const deliveriesPerDay = {
  kpis: {
    dueNext7: 8,
    suppliers: 5,
    dueNext14: 9,
    range: "1 Oct to 14 Oct",
    busiest: "Thu 1 · Sat 3",
    busiestCount: 2,
    daysWithNone: 6,
  },
  subtitle: "Next 14 days, 1 Oct to 14 Oct 2026",
  days: [
    { label: "Thu 1", value: 2 },
    { label: "Fri 2", value: 1 },
    { label: "Sat 3", value: 2 },
    { label: "Sun 4", value: 0 },
    { label: "Mon 5", value: 1 },
    { label: "Tue 6", value: 1 },
    { label: "Wed 7", value: 1 },
    { label: "Thu 8", value: 0 },
    { label: "Fri 9", value: 0 },
    { label: "Sat 10", value: 0 },
    { label: "Sun 11", value: 0 },
    { label: "Mon 12", value: 1 },
    { label: "Tue 13", value: 0 },
    { label: "Wed 14", value: 0 },
  ],
  lateCount: 3,
};

// ---- 35_13.3_Ordered_vs_received.jpeg --------------------------------------------------------------------------

export type ReceivedLine = {
  po: string;
  supplier: string;
  item: string;
  unit: "pcs" | "m";
  ordered: number;
  received: number;
  /** ¥ taken off the supplier payment, or null when nothing is short. */
  shortValue: number | null;
  payment: "Reduced" | "Full";
};

export const orderedVsReceived: ReceivedLine[] = [
  { po: "PO-2035", supplier: "Shenzhen Apparel", item: "Men's jackets", unit: "pcs", ordered: 1200, received: 1160, shortValue: 2400, payment: "Reduced" },
  { po: "PO-2027", supplier: "Foshan Fabrics", item: "Cotton fabric", unit: "m", ordered: 1200, received: 1188, shortValue: 540, payment: "Reduced" },
  { po: "PO-2034", supplier: "Shenzhen Apparel", item: "Men's shorts", unit: "pcs", ordered: 1500, received: 1500, shortValue: null, payment: "Full" },
  { po: "PO-2028", supplier: "Guangzhou Textile Co.", item: "Denim jeans", unit: "pcs", ordered: 2500, received: 2500, shortValue: null, payment: "Full" },
  { po: "PO-2033", supplier: "Hangzhou Knits", item: "Polo shirts", unit: "pcs", ordered: 2000, received: 2000, shortValue: null, payment: "Full" },
  { po: "PO-2032", supplier: "Guangzhou Textile Co.", item: "Ladies kurtis", unit: "pcs", ordered: 2800, received: 2800, shortValue: null, payment: "Full" },
  { po: "PO-2030", supplier: "Hangzhou Knits", item: "Track pants", unit: "pcs", ordered: 3000, received: 3000, shortValue: null, payment: "Full" },
  { po: "PO-2029", supplier: "Shenzhen Apparel", item: "Kids t-shirts", unit: "pcs", ordered: 4000, received: 4000, shortValue: null, payment: "Full" },
];

// ---- 36_13.4_Containers_timeline.jpeg --------------------------------------------------------------------------

export type ContainerState = "sea" | "loading" | "arrived";

export type TimelineContainer = {
  container: string;
  state: ContainerState;
  /** Day of loading. */
  loaded: string;
  /** Arrival (arrived), ETA (on the sea) or estimated arrival (loading). */
  arrival: string;
};

export const containersTimeline = {
  kpis: {
    arrivingIn7Days: ["2026-10-02", "2026-10-04"],
    averageSeaDays: 19,
    nextArrival: { date: "2026-10-02", container: "MSKU 4471203" },
  },
  /** Axis range: dates map linearly onto the timeline width, start inclusive to end exclusive. */
  axis: { start: "2026-09-05", end: "2026-10-25", ticks: ["2026-09-05", "2026-09-15", "2026-09-25", "2026-10-05", "2026-10-15", "2026-10-24"] },
  containers: [
    { container: "CAIU 2298076", state: "arrived", loaded: "2026-09-09", arrival: "2026-09-28" },
    { container: "MSKU 4471203", state: "sea", loaded: "2026-09-14", arrival: "2026-10-02" },
    { container: "TGHU 8820156", state: "sea", loaded: "2026-09-16", arrival: "2026-10-04" },
    { container: "CAIU 3305871", state: "sea", loaded: "2026-09-22", arrival: "2026-10-11" },
    { container: "OOLU 6094412", state: "sea", loaded: "2026-09-29", arrival: "2026-10-18" },
    { container: "FCIU 5527310", state: "loading", loaded: "2026-09-26", arrival: "2026-10-24" },
  ] satisfies TimelineContainer[],
};

// ---- 37_13.5_Payments_per_supplier.jpeg ------------------------------------------------------------------------

export type SupplierPayment = {
  supplier: string;
  orders: string[];
  /** ¥ */
  orderValue: number;
  /** ¥ */
  paid: number;
  /** ₹ at payment-day rates */
  paidInr: number;
};

export const paymentsPerSupplier = {
  /** ₹ estimate shown under "Balance to pay". */
  dueNext30DaysInr: 4260000,
  finishedOrders: ["PO-2028", "PO-2035"],
  suppliers: [
    { supplier: "Guangzhou Textile Co.", orders: ["PO-2047", "PO-2041"], orderValue: 160000, paid: 70000, paidInr: 1310000 },
    { supplier: "Foshan Fabrics", orders: ["PO-2049"], orderValue: 141000, paid: 47000, paidInr: 470000 },
    { supplier: "Shenzhen Apparel", orders: ["PO-2044"], orderValue: 120000, paid: 40000, paidInr: 560000 },
    { supplier: "Yiwu Trims Ltd.", orders: ["PO-2038"], orderValue: 70000, paid: 14000, paidInr: 175000 },
  ] satisfies SupplierPayment[],
};

// ---- 38_13.6_Landed_cost_by_month.jpeg -------------------------------------------------------------------------

export type MonthCost = {
  /** Chart label ("Sep 2026"); the table adds " (so far)" for the running month. */
  month: string;
  soFar?: boolean;
  pieces: number;
  /** ₹ */
  landedCost: number;
  /**
   * ₹ per piece as shown, null for "–". Stored, not computed: the reference shows ₹213.87 for September although
   * 28,44,560 / 13,300 = 213.877 rounds to ₹213.88 (D1).
   */
  perPiece: number | null;
};

export const landedCostByMonth = {
  biggestMonth: "September",
  months: [
    { month: "Aug 2026", pieces: 0, landedCost: 0, perPiece: null },
    { month: "Sep 2026", pieces: 13300, landedCost: 2844560, perPiece: 213.87 },
    { month: "Oct 2026", soFar: true, pieces: 2500, landedCost: 1377000, perPiece: 550.8 },
  ] satisfies MonthCost[],
};
