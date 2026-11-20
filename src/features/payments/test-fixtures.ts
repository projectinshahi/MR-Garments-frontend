import type { PaymentRow } from "@/lib/api/ledger-types";
import type { MilestoneFields, PaymentsResponse, SettlementFields } from "@/lib/api/types";

// Builders for the unit tests of the screens that read the unified ledger (PAY-1, ORD-1, ORD-4, LED-1). Test-only.

/** A settled order's ledger figures: nothing outstanding, no deposit required. */
export const SETTLED: SettlementFields & MilestoneFields = {
  held: false,
  settledCny: 0,
  outstandingCny: 0,
  paymentStatus: "paid",
  settledInr: 0,
  depositRequiredCny: null,
  depositSettledCny: 0,
  depositPendingCny: null,
  depositStatus: "none",
};

/** A held account's order (D4): no figures. */
export const HELD: SettlementFields & MilestoneFields = {
  held: true,
  settledCny: null,
  outstandingCny: null,
  paymentStatus: null,
  settledInr: null,
  depositRequiredCny: null,
  depositSettledCny: null,
  depositPendingCny: null,
  depositStatus: null,
};

/** An orderless supplier payment (kind "Payment"), paid, not voided. */
export const paymentRow = (id: string, over: Partial<PaymentRow> = {}): PaymentRow => ({
  id,
  orderId: null,
  po: null,
  supplierId: "s1",
  supplier: "Hangzhou Silk",
  currency: "CNY",
  kind: "Payment",
  payee: "Hangzhou Silk",
  payeeRole: "supplier",
  amountCny: 5_000,
  status: "paid",
  paidOn: "2026-11-01",
  dueDate: null,
  rateInr: 12,
  amountInr: 60_000,
  mode: "Bank transfer",
  reference: "",
  notes: "",
  recordedAt: "2026-11-01T05:00:00Z",
  voided: false,
  voidedAt: null,
  voidedBy: null,
  voidReason: "",
  held: false,
  ...over,
});

export type PaymentOrder = PaymentsResponse["orders"][number];
/** A PAY-1 order row. */
export const paymentOrder = (po: string, over: Partial<PaymentOrder> = {}): PaymentOrder => ({
  orderId: `o-${po}`,
  po,
  supplierId: "s1",
  supplier: "Hangzhou Silk",
  currency: "CNY",
  supplierRate: 12,
  orderValueCny: 10_000,
  ...SETTLED,
  settledCny: 4_000,
  outstandingCny: 6_000,
  paymentStatus: "partly",
  settledInr: 48_000,
  agentPaidCny: 0,
  agentPaidInr: 0,
  paidInr: 48_000,
  nextDue: null,
  ...over,
});
