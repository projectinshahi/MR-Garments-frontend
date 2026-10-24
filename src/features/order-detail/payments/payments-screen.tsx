import { PageContainer } from "@/components/layout/page-header";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatCNY, formatINR, formatQty, formatRate } from "@/lib/formatters";

import type { OrderPayments } from "./data/queries";
import { PaymentsTable } from "./payments-table";

/** Order detail, tab c (08_3.1.c_Deposits_&_payments.jpeg): KPIs, payments table, INR working and balance rule. */
export function PaymentsScreen({ po, data }: { po: string; data: OrderPayments }) {
  const count = data.payments.length;

  return (
    <PageContainer>
      <OrderContextStrip po={po} fact={`Order value ${formatCNY(data.orderValue)}`} />
      <KpiRow gap="sm">
        <KpiCard size="xs"
          label="Order value"
          value={formatCNY(data.orderValue)}
          sub={`${formatQty(data.pieces, "pcs")} × ${formatCNY(data.pricePerPiece)}`}
        />
        <KpiCard size="xs" label="Paid so far" value={formatCNY(data.paid)} sub={`${count} ${count === 1 ? "payment" : "payments"}`} />
        <KpiCard size="xs" label="Balance to pay" value={formatCNY(data.balance)} sub={data.balanceNote} />
      </KpiRow>

      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <SectionCard title="Deposits and payments" bottomGap="tight" className="min-w-0">
          <PaymentsTable rows={data.payments} totals={{ paid: data.paid, paidInr: data.paidInr }} />
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="How the INR figure is found" titleGap="none">
            <Callout size="sm" className="mt-3.5">
              Each payment is changed to INR at the rate on the day it was paid. A later change in rate does not change an
              old payment.
            </Callout>
            <KeyValueList size="sm"
              className="mt-3"
              boldValues
              items={data.payments.map((p) => ({
                label: `${formatCNY(p.amount)} × ${formatRate(p.rate)}`,
                value: formatINR(p.inr),
              }))}
              total={{ label: "Goods cost in INR", value: formatINR(data.paidInr) }}
            />
          </SectionCard>
          <SectionCard title="Balance rule" titleGap="none">
            <p className="mt-3 text-[13.5px] leading-[21.5px] text-muted-foreground">{data.balanceRule}</p>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
