import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import type { OrderOptions } from "@/lib/api/types";
import { formatCNY, formatDate, formatINR, formatRate, formatShortDate } from "@/lib/formatters";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { RecordPaymentDialog } from "./record-payment-dialog";

const spacedCNY = (value: number) => formatCNY(value, { spaced: true });
const date = (value: string | null) => (value ? formatDate(value) : "–");

type PaymentDetailCardProps = {
  order: OrderPaymentRow;
  payments: Payment[];
  /** Shipping agents to offer as payees, or null when the user can't record payments (no button). */
  agents: OrderOptions["agents"] | null;
  /** The PO links to its order page (canOpen(me, "/orders")). */
  linkPo: boolean;
};

/** Right card: the selected order's payments, each paid one at its own rate, and the totals. Records only. */
export function PaymentDetailCard({ order, payments, agents, linkPo }: PaymentDetailCardProps) {
  const { po, supplier } = order;
  const totalCny = payments.reduce((sum, p) => sum + p.amountCny, 0);
  // A due payment has no rate yet (PAY-1 gives one only once paid), so the INR total covers paid payments only.
  const totalInr = payments.reduce((sum, p) => sum + p.amountCny * (p.rateInr ?? 0), 0);
  const allPriced = payments.every((p) => p.rateInr !== null);

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
      {payments.length === 0 ? (
        <p className="mt-3.5 text-[13.5px] text-muted-foreground">No payments recorded for {po} yet.</p>
      ) : (
        <>
          <ol className="mt-3.5 flex flex-col gap-3">
            {payments.map((payment, index) => (
              <li key={payment.id}>
                <PaymentBlock number={index + 1} payment={payment} />
              </li>
            ))}
          </ol>

          <div className="mt-3 flex items-start justify-between gap-4 border-t-2 border-navy pt-2.5">
            <div>
              <p className="text-[15px] leading-5 font-bold">Total for this order</p>
              <p className="text-[12.5px] leading-4 text-muted-foreground">
                {spacedCNY(totalCny)}
                {allPriced ? null : " · INR covers paid payments only"}
              </p>
            </div>
            <p className="text-[15.5px] leading-5 font-bold">{formatINR(totalInr)}</p>
          </div>

          <Callout size="sm" className="mt-[13px]">
            Each payment is changed to INR at the rate of its own date, then added up.
          </Callout>
        </>
      )}

      {agents ? (
        <RecordPaymentDialog orders={[order]} fixed agents={agents}>
          <Button type="button" className="mt-3.5 h-11 w-full rounded-[10px] text-[15px]">
            + Record payment for {po}
          </Button>
        </RecordPaymentDialog>
      ) : null}
    </SectionCard>
  );
}

function PaymentBlock({ number, payment }: { number: number; payment: Payment }) {
  const paid = payment.status === "paid";
  const facts = paid
    ? [
        { label: "Paid on", value: date(payment.paidOn) },
        { label: "Amount", value: spacedCNY(payment.amountCny) },
        { label: "Rate on that day", value: payment.rateInr === null ? "–" : formatRate(payment.rateInr) },
        { label: "Mode", value: payment.mode ?? "–" },
      ]
    : [
        { label: "Due date", value: date(payment.dueDate) },
        { label: "Amount", value: spacedCNY(payment.amountCny) },
      ];

  return (
    <article className="rounded-[10px] border bg-input-background px-4 py-[13px]">
      <div className="flex h-5 items-center justify-between gap-3">
        <h3 className="text-[14.5px] leading-[17px] font-bold">
          {number}. {payment.kind}
        </h3>
        {paid ? (
          <StatusPill tone="success">Paid</StatusPill>
        ) : (
          <StatusPill tone="warning">{payment.dueDate ? `Due ${formatShortDate(payment.dueDate)}` : "Due"}</StatusPill>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[12.5px] leading-[15px] text-muted-foreground">{fact.label}</dt>
            <dd className="text-[14.5px] leading-[17px] font-bold">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {payment.rateInr === null ? null : (
        <div className="mt-3 flex h-[43px] items-center justify-between gap-3 rounded-lg border border-dashed border-placeholder/60 bg-card px-3">
          <span className="text-[13.5px] text-label">
            {spacedCNY(payment.amountCny)} × {formatRate(payment.rateInr)}
          </span>
          <span className="text-[16.5px] font-bold">{formatINR(payment.amountCny * payment.rateInr)}</span>
        </div>
      )}
    </article>
  );
}
