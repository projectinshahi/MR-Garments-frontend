import { PageContainer } from "@/components/layout/page-header";
import { Callout, CardNote, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { Button } from "@/components/ui/button";
import type { OrderPayment, OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { SupplierAccountCard } from "@/features/order-detail/shared/order-money";
import { HELD_MESSAGE, MILESTONE_STATUS, moneyOrDash, PAYMENT_STATUS } from "@/features/payments/money";
import { RecordPaymentDialog, RecordSeaFreightDialog, type SupplierChoice } from "@/features/payments/record-payment-dialog";
import type { OrderOptions } from "@/lib/api/types";
import { formatINR, formatMoney } from "@/lib/formatters";

import { PaymentsTable, SlicesTable } from "./payments-table";

/**
 * Order detail, tab c (08_3.1.c, unified supplier ledger) from ORD-4: the order's value, what the supplier's account
 * settled of it (FIFO, oldest order first) and how ("Settled by", each credit at its own rate), what is outstanding, the
 * Deposit Required milestone, the supplier's signed balance, and the payments recorded against this PO (legacy supplier
 * ones as a memo, sea freight to agents). Record payment (the supplier's, prefilled) and Record sea freight payment for
 * payments Enter; Void for payments Full.
 */
export function PaymentsScreen({
  order,
  payments,
  canVoid = false,
  supplier = null,
  agents = null,
}: {
  order: OrderView;
  payments: OrderPayment[];
  canVoid?: boolean;
  /** This order's supplier from ADV-5 (payments Enter and the supplier active): Record payment. */
  supplier?: SupplierChoice | null;
  /** ORD-2's shipping agents (payments Enter): Record sea freight payment. */
  agents?: OrderOptions["agents"] | null;
}) {
  const money = (value: number | null) => moneyOrDash(value, (v) => formatMoney(v, order.currency, { decimals: 2 }));
  const status = order.held ? "Pending review" : order.paymentStatus ? PAYMENT_STATUS[order.paymentStatus].label : undefined;

  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={`Order value ${money(order.orderValueCny)}`} />
      {order.held ? (
        <Callout tone="warning" size="sm" role="status">
          {HELD_MESSAGE} This order&apos;s figures are not shown until the review is done.
        </Callout>
      ) : null}
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Order value" value={money(order.orderValueCny)} />
        <KpiCard size="xs" label="Settled" value={money(order.settledCny)} sub="from the supplier account" />
        <KpiCard size="xs" label="Outstanding" value={money(order.outstandingCny)} sub={status} />
        {order.depositRequiredCny == null ? null : (
          <KpiCard
            size="xs"
            label="Deposit required"
            value={money(order.depositRequiredCny)}
            sub={order.depositStatus ? `${MILESTONE_STATUS[order.depositStatus].label} · ${money(order.depositPendingCny)} pending` : undefined}
          />
        )}
        {order.agentPaidCny ? <KpiCard size="xs" label="Sea freight" value={money(order.agentPaidCny)} sub={`${moneyOrDash(order.agentPaidInr, formatINR)} to agents`} /> : null}
      </KpiRow>

      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="Settled by" aside={<CardNote size="sm">Oldest first · each at its own rate</CardNote>} bottomGap="tight" className="min-w-0">
            <SlicesTable slices={order.slices ?? []} currency={order.currency} settledCny={order.settledCny} settledInr={order.settledInr} />
          </SectionCard>
          <SectionCard title={`Recorded against ${order.po}`} bottomGap="tight" className="min-w-0">
            <PaymentsTable rows={payments} canVoid={canVoid} />
            {payments.some((p) => p.payeeRole === "supplier") ? (
              <CardNote size="sm" className="mt-3 mb-3 block">
                Supplier payments here were recorded against this PO before the supplier ledger. They are on the supplier&apos;s account and settle its orders
                oldest first.
              </CardNote>
            ) : null}
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SupplierAccountCard order={order} />
          <SectionCard title="How the INR figure is found" titleGap="none">
            <Callout size="sm" className="mt-3.5">
              Each credit that settled the order keeps the rate of the day it was paid; the goods INR adds them up. Sea freight is paid to agents at its own rates.
            </Callout>
            <p className="mt-3 flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Paid (INR), goods + sea freight</span>
              <strong>{moneyOrDash(order.paidInr, formatINR)}</strong>
            </p>
          </SectionCard>
          {supplier || agents ? (
            <div className="flex flex-col gap-2">
              {supplier ? (
                <RecordPaymentDialog suppliers={[supplier]} supplierId={supplier.id}>
                  <Button type="button" className="h-auto min-h-11 w-full rounded-[10px] py-2 text-[15px] whitespace-normal">
                    + Record payment for {supplier.name}
                  </Button>
                </RecordPaymentDialog>
              ) : null}
              {agents ? (
                <RecordSeaFreightDialog order={{ orderId: order.id, po: order.po, currency: order.currency, exchangeRate: order.exchangeRate }} agents={agents}>
                  <Button type="button" variant="outline" className="h-auto min-h-11 w-full rounded-[10px] py-2 text-[15px] whitespace-normal">
                    + Record sea freight payment
                  </Button>
                </RecordSeaFreightDialog>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
