import type { Tone } from "@/types/domain";

// Screenshot-faithful records from 16_5_Deposits_&_Payments.jpeg (D1). Read only through ./queries.ts (D2).
// The PO-2041 rates (20.00 paid, 30.00 expected) are unusual but shown, so they are kept (inventory §9).

export type PaymentsKpis = {
  /** INR */
  paidSoFar: number;
  openOrders: number;
  /** INR */
  dueNext7Days: number;
  dueNext7Count: number;
  /** The one payment named in the 7-day sub-line ("PO-2041 on 5 Oct"). */
  dueNext7First: { po: string; due: string };
  /** INR */
  dueNext30Days: number;
  dueNext30Count: number;
};

export type OrderPaymentRow = {
  po: string;
  supplier: string;
  /** CNY */
  orderValue: number;
  /** CNY */
  paid: number;
  /** INR, each payment at the rate of its own date */
  paidInr: number;
  /** CNY */
  balance: number;
  /** ISO date; null shows "Not yet due". */
  nextDue: string | null;
  /** Pill tone for a due date the screenshot highlights. */
  nextDueTone?: Tone;
};

type PaymentBase = { kind: "Deposit" | "Balance"; /** ISO date */ date: string; /** CNY */ amount: number; rate: number };

export type ScheduledPayment =
  | (PaymentBase & { status: "paid"; mode: string })
  | (PaymentBase & { status: "due"; shortReceiptDeduction: string });

export type OrderPaymentDetail = {
  po: string;
  supplier: string;
  payments: ScheduledPayment[];
};

export const kpis: PaymentsKpis = {
  paidSoFar: 2_515_000,
  openOrders: 5,
  dueNext7Days: 1_500_000,
  dueNext7Count: 1,
  dueNext7First: { po: "PO-2041", due: "2026-10-05" },
  dueNext30Days: 4_260_000,
  dueNext30Count: 4,
};

export const orders: OrderPaymentRow[] = [
  { po: "PO-2049", supplier: "Foshan Fabrics", orderValue: 141_000, paid: 47_000, paidInr: 470_000, balance: 94_000, nextDue: "2026-10-15" },
  { po: "PO-2047", supplier: "Guangzhou Textile Co.", orderValue: 60_000, paid: 20_000, paidInr: 310_000, balance: 40_000, nextDue: null },
  { po: "PO-2044", supplier: "Shenzhen Apparel", orderValue: 120_000, paid: 40_000, paidInr: 560_000, balance: 80_000, nextDue: "2026-10-12" },
  {
    po: "PO-2041",
    supplier: "Guangzhou Textile Co.",
    orderValue: 100_000,
    paid: 50_000,
    paidInr: 1_000_000,
    balance: 50_000,
    nextDue: "2026-10-05",
    nextDueTone: "warning",
  },
  { po: "PO-2038", supplier: "Yiwu Trims Ltd.", orderValue: 70_000, paid: 14_000, paidInr: 175_000, balance: 56_000, nextDue: "2026-10-22" },
];

/** Only PO-2041 has a designed detail panel. */
export const selectedDetail: OrderPaymentDetail = {
  po: "PO-2041",
  supplier: "Guangzhou Textile Co.",
  payments: [
    { kind: "Deposit", status: "paid", date: "2026-09-12", amount: 50_000, rate: 20, mode: "Bank transfer" },
    { kind: "Balance", status: "due", date: "2026-10-05", amount: 50_000, rate: 30, shortReceiptDeduction: "None" },
  ],
};
