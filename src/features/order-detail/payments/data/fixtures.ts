// Screenshot-faithful records from 08_3.1.c_Deposits_&_payments.jpeg (D1). Read only through ./queries.ts (D2).

export type PaymentFixture = {
  /** ISO date */
  date: string;
  type: "Deposit" | "Balance";
  paidTo: string;
  /** CNY */
  amount: number;
  /** INR per CNY on the day of payment */
  rate: number;
};

export type PaymentsFixture = {
  pieces: number;
  /** CNY per piece */
  pricePerPiece: number;
  payments: PaymentFixture[];
  /** KPI sub-line under "Balance to pay", as shown. */
  balanceNote: string;
  /** "Balance rule" card text for this order, as shown. */
  balanceRule: string;
};

export const paymentsByPO: Record<string, PaymentsFixture> = {
  "PO-2028": {
    pieces: 2500,
    pricePerPiece: 32,
    payments: [
      { date: "2026-08-05", type: "Deposit", paidTo: "Guangzhou Textile Co.", amount: 70_000, rate: 12 },
      { date: "2026-08-26", type: "Balance", paidTo: "Guangzhou Textile Co.", amount: 10_000, rate: 14 },
    ],
    balanceNote: "Fully paid",
    balanceRule:
      "If goods arrive short in China, the balance payment can be reduced by the value of the missing pieces. No shortage on this order, so the balance was paid in full.",
  },
};
