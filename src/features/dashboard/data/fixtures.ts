import type { StageNumber, Terms, Tone } from "@/types/domain";

// Screenshot-faithful records from 04_2_Dashboard.jpeg (D1). Read only through ./queries.ts (D2).
// Calendar screens show other items for some of these POs (inventory §9); the dashboard keeps its own values.

export type DashboardKpis = {
  activeOrders: number;
  stageCount: number;
  dueNext7Days: number;
  dueSupplierCount: number;
  lateDeliveries: number;
  containersOnTheWay: number;
  containersArrivingThisWeek: number;
  /** INR */
  paymentsDue: number;
  paymentsWindowDays: number;
};

export type StageCount = { stage: StageNumber; count: number };

export type DeliveryRow = {
  po: string;
  supplier: string;
  /** ISO date */
  due: string;
  /** Label as shown ("Late 4 days"), stored rather than computed (D1). */
  status: string;
  tone: Tone;
};

export type PaymentDueRow = {
  supplier: string;
  po: string;
  payment: "Deposit" | "Balance";
  /** ISO date */
  due: string;
  /** INR */
  amount: number;
};

export type ContainerRow = {
  container: string;
  agent: string;
  terms: Terms;
  /** ISO date */
  etaIndia: string;
};

export const kpis: DashboardKpis = {
  activeOrders: 50,
  stageCount: 6,
  dueNext7Days: 8,
  dueSupplierCount: 5,
  lateDeliveries: 3,
  containersOnTheWay: 6,
  containersArrivingThisWeek: 2,
  paymentsDue: 4_260_000,
  paymentsWindowDays: 30,
};

export const ordersByStage: StageCount[] = [
  { stage: 1, count: 14 },
  { stage: 2, count: 9 },
  { stage: 3, count: 11 },
  { stage: 4, count: 5 },
  { stage: 5, count: 4 },
  { stage: 6, count: 7 },
];

export const deliveries: DeliveryRow[] = [
  { po: "PO-2041", supplier: "Guangzhou Textile Co.", due: "2026-09-26", status: "Late 4 days", tone: "danger" },
  { po: "PO-2038", supplier: "Yiwu Trims Ltd.", due: "2026-09-27", status: "Late 3 days", tone: "danger" },
  { po: "PO-2044", supplier: "Shenzhen Apparel", due: "2026-09-29", status: "Late 1 day", tone: "danger" },
  { po: "PO-2047", supplier: "Guangzhou Textile Co.", due: "2026-10-01", status: "Due in 1 day", tone: "warning" },
  { po: "PO-2049", supplier: "Foshan Fabrics", due: "2026-10-03", status: "On track", tone: "success" },
];

export const paymentsDue: PaymentDueRow[] = [
  { supplier: "Guangzhou Textile Co.", po: "PO-2041", payment: "Balance", due: "2026-10-05", amount: 1_500_000 },
  { supplier: "Shenzhen Apparel", po: "PO-2044", payment: "Balance", due: "2026-10-12", amount: 1_120_000 },
  { supplier: "Foshan Fabrics", po: "PO-2049", payment: "Deposit", due: "2026-10-15", amount: 940_000 },
  { supplier: "Yiwu Trims Ltd.", po: "PO-2038", payment: "Balance", due: "2026-10-22", amount: 700_000 },
];

export const containersOnTheWay: ContainerRow[] = [
  { container: "MSKU 4471203", agent: "Sino Freight", terms: "FOB", etaIndia: "2026-10-02" },
  { container: "TGHU 8820156", agent: "Sino Freight", terms: "CNF", etaIndia: "2026-10-04" },
  { container: "CAIU 3305871", agent: "Dragon Cargo", terms: "FOB", etaIndia: "2026-10-11" },
  { container: "OOLU 6094412", agent: "Dragon Cargo", terms: "CNF", etaIndia: "2026-10-18" },
];
