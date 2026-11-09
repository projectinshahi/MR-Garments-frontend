import { PageContainer } from "@/components/layout/page-header";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import type { OrderPayment, OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { agentPaid, DepositStatusPill, moneyOrDash } from "@/features/payments/money";
import { formatINR, formatMoney, formatRate } from "@/lib/formatters";

import { PaymentsTable } from "./payments-table";

/**
 * Order detail, tab c (08_3.1.c_Deposits_&_payments.jpeg) from ORD-4: KPIs, the order's payments (oldest first) and
 * the INR working. The figures follow the API's payee rules (phase 2 fixes, 1 and 2): paid to the supplier and the
 * balance the supplier is still owed; agent payments are sea freight, shown apart; the deposit KPI only when the
 * supplier asked for one. The "Balance rule" card is left out: no approved rule reduces a balance yet.
 */
export function PaymentsScreen({ order, payments, canDelete = false }: { order: OrderView; payments: OrderPayment[]; canDelete?: boolean }) {
  const paid = payments.filter((p) => p.status === "paid");
  const toSupplier = paid.filter((p) => p.payeeRole === "supplier");
  const toAgents = paid.filter((p) => p.payeeRole === "agent");
  // An older API (before the migrated backend) sends none of the supplier figures: they show as a dash, never as the
  // all-payee numbers under the new labels.
  const supplierPaid = order.supplierPaidCny ?? null;
  const balance = supplierPaid == null ? null : order.balanceCny;
  const agentsCny = agentPaid(order.paidCny, supplierPaid);
  const money = (value: number | null) => moneyOrDash(value, (v) => formatMoney(v, order.currency));
  const count = (n: number) => `${n} ${n === 1 ? "payment" : "payments"}`;
  // INR per payment is the API's `amountInr` (rounded in SQL like every total), never recomputed here.
  const working = (p: OrderPayment) => ({ label: `${money(p.amountCny)} × ${formatRate(p.rateInr ?? 0)}`, value: moneyOrDash(p.amountInr, formatINR) });

  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={`Order value ${money(order.orderValueCny)}`} />
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Order value" value={money(order.orderValueCny)} />
        <KpiCard size="xs" label="Paid to supplier" value={money(supplierPaid)} sub={`${count(toSupplier.length)}${agentsCny !== null && agentsCny > 0 ? ` · agents ${money(agentsCny)}` : ""}`} />
        <KpiCard size="xs" label="Balance to supplier" value={money(balance)} sub={balance !== null && balance <= 0 ? "Fully paid" : undefined} />
        {order.depositRequiredCny == null ? null : (
          <KpiCard
            size="xs"
            label="Deposit"
            value={money(order.depositPendingCny ?? 0)}
            sub={
              <>
                {money(order.depositPaidCny)} of {money(order.depositRequiredCny)} <DepositStatusPill status={order.depositStatus} className="ml-1 align-middle" />
              </>
            }
          />
        )}
      </KpiRow>

      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <SectionCard title="Deposits and payments" bottomGap="tight" className="min-w-0">
          <PaymentsTable
            rows={payments}
            totals={{ paidCny: order.paidCny, paidInr: order.paidInr, currency: order.currency }}
            // PAY-3: each payment's Delete, with the figures it changes.
            remove={
              canDelete
                ? { po: order.po, supplier: order.supplier.name, currency: order.currency, supplierPaidCny: supplierPaid, balanceCny: balance }
                : null
            }
          />
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="How the INR figure is found" titleGap="none">
            <Callout size="sm" className="mt-3.5">
              Each payment is changed to INR at the rate on the day it was paid. A later change in rate does not change an
              old payment.
            </Callout>
            <KeyValueList size="sm" className="mt-3" boldValues items={toSupplier.map(working)} total={{ label: "Paid to supplier in INR", value: moneyOrDash(order.supplierPaidInr, formatINR) }} />
            {toAgents.length ? (
              <KeyValueList
                size="sm"
                className="mt-3"
                boldValues
                items={toAgents.map((p) => ({ ...working(p), label: `${working(p).label} · ${p.payee}` }))}
                total={{ label: "Paid to agents (sea freight) in INR", value: moneyOrDash(agentPaid(order.paidInr, order.supplierPaidInr), formatINR) }}
              />
            ) : null}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
