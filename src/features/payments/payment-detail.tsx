import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { PoLink } from "@/components/shared/po-link";
import { Button } from "@/components/ui/button";
import type { OrderOptions } from "@/lib/api/types";
import { formatDate, formatINR, formatMoney, formatRate } from "@/lib/formatters";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { HELD_MESSAGE, MilestonePill, moneyOrDash, PaymentStatus, PaymentStatusPill, paymentType } from "./money";
import { RecordPaymentDialog, RecordSeaFreightDialog, type SupplierChoice } from "./record-payment-dialog";
import { VoidPaymentButton } from "./void-payment";

const date = (value: string | null) => (value ? formatDate(value) : "–");

type PaymentDetailCardProps = {
  order: OrderPaymentRow;
  /** The payments recorded against this PO: legacy supplier ones (a memo) and shipping-agent ones (sea freight). */
  payments: Payment[];
  suppliers: SupplierChoice[] | null;
  agents: OrderOptions["agents"] | null;
  linkPo: boolean;
  canVoid?: boolean;
};

/**
 * Right card: the selected order's figures as the API projects them (value, settled from the supplier's account,
 * outstanding, status, the Deposit Required milestone, sea freight paid to agents, INR), the payments recorded against
 * its PO, Record payment (the supplier's, prefilled) and Record sea freight payment. Records only.
 */
export function PaymentDetailCard({ order, payments, suppliers, agents, linkPo, canVoid = false }: PaymentDetailCardProps) {
  const { po, supplier, currency } = order;
  const money = (value: number | null) => moneyOrDash(value, (v) => formatMoney(v, currency, { decimals: 2, spaced: true }));
  const payable = suppliers?.find((s) => s.id === order.supplierId);

  return (
    <SectionCard
      title={
        <>
          <PoLink po={po} linked={linkPo} /> payments
        </>
      }
      aside={<CardNote size="sm">{supplier}</CardNote>}
      titleGap="none"
      className="pt-3.5 pb-[18px]"
    >
      {order.held ? (
        <Callout tone="warning" size="sm" role="status" className="mt-3">
          {HELD_MESSAGE}
        </Callout>
      ) : null}
      <KeyValueList
        size="sm"
        className="mt-3"
        boldValues
        items={[
          { label: "Order value", value: money(order.orderValueCny) },
          { label: "Settled from supplier account", value: money(order.settledCny) },
          ...(order.agentPaidCny ? [{ label: "Paid to agents (sea freight)", value: money(order.agentPaidCny), muted: true }] : []),
          { label: "Paid (INR), goods + sea freight", value: moneyOrDash(order.paidInr, formatINR) },
          { label: "Status", value: <PaymentStatusPill status={order.paymentStatus} held={order.held} /> },
        ]}
        total={{ label: "Outstanding", value: money(order.outstandingCny) }}
      />
      {order.depositRequiredCny == null ? null : (
        <KeyValueList
          size="sm"
          className="mt-3"
          boldValues
          items={[
            { label: "Deposit required", value: money(order.depositRequiredCny) },
            { label: "Settled toward it", value: money(order.depositSettledCny) },
            {
              label: (
                <>
                  Deposit pending <MilestonePill status={order.depositStatus} className="ml-1 align-middle" />
                </>
              ),
              value: money(order.depositPendingCny),
            },
          ]}
        />
      )}

      <h3 className="mt-4 text-[14.5px] font-bold">Recorded against {po}</h3>
      {payments.length === 0 ? (
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">No payment names this PO. Supplier payments are on the supplier&apos;s account.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-3">
          {payments.map((payment, index) => (
            <li key={payment.id}>
              <PaymentBlock number={index + 1} payment={payment} remove={canVoid ? <VoidPaymentButton payment={payment} voided={payment.voided} /> : null} />
            </li>
          ))}
        </ol>
      )}
      {payments.some((p) => p.payeeRole === "supplier") ? (
        <Callout size="sm" className="mt-3">
          Supplier payments listed here were recorded against this PO before the supplier ledger. They are on the supplier&apos;s account and settle its orders
          oldest first.
        </Callout>
      ) : null}

      {payable || agents ? (
        <div className="mt-3.5 flex flex-col gap-2">
          {payable ? (
            <RecordPaymentDialog suppliers={suppliers!} supplierId={payable.id}>
              <Button type="button" className="h-auto min-h-11 w-full rounded-[10px] py-2 text-[15px] whitespace-normal">
                + Record payment for {supplier}
              </Button>
            </RecordPaymentDialog>
          ) : null}
          {agents ? (
            <RecordSeaFreightDialog order={{ orderId: order.orderId, po, currency, exchangeRate: order.supplierRate }} agents={agents}>
              <Button type="button" variant="outline" className="h-auto min-h-11 w-full rounded-[10px] py-2 text-[15px] whitespace-normal">
                + Record sea freight payment
              </Button>
            </RecordSeaFreightDialog>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

function PaymentBlock({ number, payment, remove }: { number: number; payment: Payment; remove: React.ReactNode }) {
  const { currency } = payment;
  const spaced = (value: number) => formatMoney(value, currency, { spaced: true, decimals: 2 });
  const paid = payment.status === "paid";
  const facts = [
    { label: paid ? "Paid on" : "Due date", value: date(paid ? payment.paidOn : payment.dueDate) },
    { label: "Amount", value: spaced(payment.amountCny) },
    { label: "Paid to", value: payment.payee },
    ...(paid ? [{ label: "Rate on that day", value: payment.rateInr === null || currency === "INR" ? "–" : formatRate(payment.rateInr) }] : []),
    ...(paid ? [{ label: "In INR", value: moneyOrDash(payment.amountInr, formatINR) }] : []),
    ...(payment.mode ? [{ label: "Mode", value: payment.mode }] : []),
    ...(payment.reference ? [{ label: "Reference", value: payment.reference }] : []),
  ];
  return (
    <article className="rounded-[10px] border bg-input-background px-4 py-[13px]" aria-label={`${number}. ${paymentType(payment)}${payment.voided ? " (voided)" : ""}`}>
      <div className="flex min-h-5 items-center justify-between gap-3">
        <h4 className={payment.voided ? "text-[14.5px] leading-[17px] font-bold line-through" : "text-[14.5px] leading-[17px] font-bold"}>
          {number}. {paymentType(payment)}
        </h4>
        <div className="flex items-center gap-3">
          <PaymentStatus payment={payment} />
          {remove}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[12.5px] leading-[15px] text-muted-foreground">{fact.label}</dt>
            <dd className="text-[14.5px] leading-[17px] font-bold [overflow-wrap:anywhere]">{fact.value}</dd>
          </div>
        ))}
        {payment.voided ? (
          <div className="col-span-2">
            <dt className="text-[12.5px] leading-[15px] text-muted-foreground">Voided{payment.voidedBy ? ` by ${payment.voidedBy}` : ""}</dt>
            <dd className="text-[14.5px] leading-[17px] font-bold [overflow-wrap:anywhere]">{payment.voidReason || "–"}</dd>
          </div>
        ) : null}
        {payment.notes ? (
          <div className="col-span-2">
            <dt className="text-[12.5px] leading-[15px] text-muted-foreground">Notes</dt>
            <dd className="text-[14.5px] leading-[17px] font-bold [overflow-wrap:anywhere]">{payment.notes}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
