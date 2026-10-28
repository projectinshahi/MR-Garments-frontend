import { PageContainer } from "@/components/layout/page-header";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import type { OrderPayment, OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatCNY, formatINR, formatRate } from "@/lib/formatters";

import { PaymentsTable, type PaymentRow } from "./payments-table";

/**
 * Order detail, tab c (08_3.1.c_Deposits_&_payments.jpeg) from ORD-4: KPIs, the order's payments (oldest first) and
 * the INR working. The "Balance rule" card is left out: no approved rule reduces a balance yet.
 */
export function PaymentsScreen({ order, payments }: { order: OrderView; payments: OrderPayment[] }) {
  // INR is amountCny * rateInr rounded to 2 decimals, per payment (contracts, Conventions).
  const rows: PaymentRow[] = payments.map((p) => ({ ...p, inr: p.rateInr === null ? null : Math.round(p.amountCny * p.rateInr * 100) / 100 }));
  const paid = rows.filter((p) => p.status === "paid");

  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={`Order value ${formatCNY(order.orderValueCny)}`} />
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Order value" value={formatCNY(order.orderValueCny)} />
        <KpiCard size="xs" label="Paid so far" value={formatCNY(order.paidCny)} sub={`${paid.length} ${paid.length === 1 ? "payment" : "payments"}`} />
        <KpiCard size="xs" label="Balance to pay" value={formatCNY(order.balanceCny)} sub={order.balanceCny <= 0 ? "Fully paid" : undefined} />
      </KpiRow>

      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <SectionCard title="Deposits and payments" bottomGap="tight" className="min-w-0">
          <PaymentsTable rows={rows} totals={{ paidCny: order.paidCny, paidInr: order.paidInr }} />
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="How the INR figure is found" titleGap="none">
            <Callout size="sm" className="mt-3.5">
              Each payment is changed to INR at the rate on the day it was paid. A later change in rate does not change an
              old payment.
            </Callout>
            <KeyValueList
              size="sm"
              className="mt-3"
              boldValues
              items={paid.map((p) => ({ label: `${formatCNY(p.amountCny)} × ${formatRate(p.rateInr ?? 0)}`, value: formatINR(p.inr ?? 0) }))}
              total={{ label: "Goods cost in INR", value: formatINR(order.paidInr) }}
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
