import type { MoneyTotal } from "@/types/domain";

// The Suppliers page's own endpoints (backend docs/suppliers.md). Money is one total per order currency, never
// added across currencies. Coordinator-owned.

/** SUP-1 GET /api/v1/suppliers/summary: the five KPI cards. */
export type SuppliersSummary = {
  suppliers: { total: number; active: number; inactive: number };
  /** Orders not closed (phase 2 §1) and their order value. */
  openPos: { count: number; value: MoneyTotal[] };
  /** Orders at stages 3-5 (left China, not yet stocked); the nearest ETA of their containers not yet arrived. */
  inTransit: { orders: number; nextEta: string | null; arrivingNext7: number };
  /** Positive supplier balances only, and how many suppliers owe. */
  unpaid: { amount: MoneyTotal[]; suppliers: number };
  /** Due supplier payments, today to today + 6. */
  upcomingPayments: { windowDays: number; count: number; amount: MoneyTotal[] };
};

/** Order, delivery (first China receipt) and completion (closed) figures; rates are whole percentages, null without data. */
export type SupplierStats = {
  orders: number;
  completed: number;
  completionRate: number | null;
  delivered: number;
  onTime: number;
  onTimeRate: number | null;
  delayed: number;
  averageDeliveryDays: number | null;
};

export type SupplierInsightRow = SupplierStats & {
  supplierId: string;
  code: string;
  name: string;
  country: string;
  value: MoneyTotal[];
  balance: MoneyTotal[];
};

/** SUP-2 GET /api/v1/suppliers/insights?from&to&supplierId: the Performance and Analytics tabs. */
export type SuppliersInsights = {
  filter: { from: string | null; to: string | null; supplier: string | null };
  suppliers: { total: number; active: number };
  summary: SupplierStats;
  /** Biggest order value first. */
  bySupplier: SupplierInsightRow[];
  /** Up to 5: the best on-time rate among suppliers that delivered, then the most completed. */
  top: SupplierInsightRow[];
  /** Every supplier, any status; "" when the country was never set. */
  byCountry: { country: string; suppliers: number }[];
  /** From `from` (else 11 months back) to `to` (else today): order value placed and supplier payments paid in the month. */
  monthly: { month: string; value: MoneyTotal[]; paid: MoneyTotal[]; paidInr: number }[];
};
