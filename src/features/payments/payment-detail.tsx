import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import { formatCNY, formatDate, formatINR, formatRate, formatShortDate } from "@/lib/formatters";

import type { OrderPaymentDetail, ScheduledPayment } from "./data/queries";
import { PrototypeButton } from "./prototype-button";

const spacedCNY = (value: number) => formatCNY(value, { spaced: true });

/** Right card: the selected order's payment schedule, each payment at its own rate, and the INR total. */
export function PaymentDetailCard({ detail }: { detail: OrderPaymentDetail }) {
  const { po, supplier, payments } = detail;
  const totalInr = payments.reduce((sum, p) => sum + p.amount * p.rate, 0);
  const totalCny = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <SectionCard
      title={`${po} payments`}
      aside={<CardNote size="sm">{supplier}</CardNote>}
      titleGap="none"
      className="pt-3.5 pb-[18px]"
    >
      <ol className="mt-3.5 flex flex-col gap-3">
        {payments.map((payment, index) => (
          <li key={payment.kind}>
            <PaymentBlock number={index + 1} payment={payment} />
          </li>
        ))}
      </ol>

      <div className="mt-3 flex items-start justify-between gap-4 border-t-2 border-navy pt-2.5">
        <div>
          <p className="text-[15px] leading-5 font-bold">Total for this order</p>
          <p className="text-[12.5px] leading-4 text-muted-foreground">{spacedCNY(totalCny)}</p>
        </div>
        <p className="text-[15.5px] leading-5 font-bold">{formatINR(totalInr)}</p>
      </div>

      <Callout size="sm" className="mt-[13px]">
        Each payment is changed to INR at the rate of its own date, then added up.
      </Callout>

      <PrototypeButton action={`Record payment for ${po}`} className="mt-3.5 h-11 w-full rounded-[10px] text-[15px]">
        + Record payment for {po}
      </PrototypeButton>
    </SectionCard>
  );
}

function PaymentBlock({ number, payment }: { number: number; payment: ScheduledPayment }) {
  const paid = payment.status === "paid";
  const facts = [
    { label: paid ? "Paid on" : "Due date", value: formatDate(payment.date) },
    { label: "Amount", value: spacedCNY(payment.amount) },
    { label: paid ? "Rate on that day" : "Expected rate", value: formatRate(payment.rate) },
    paid
      ? { label: "Mode", value: payment.mode }
      : { label: "Short-receipt deduction", value: payment.shortReceiptDeduction },
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
          <StatusPill tone="warning">Due {formatShortDate(payment.date)}</StatusPill>
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
      <div className="mt-3 flex h-[43px] items-center justify-between gap-3 rounded-lg border border-dashed border-placeholder/60 bg-card px-3">
        <span className="text-[13.5px] text-label">
          {spacedCNY(payment.amount)} × {formatRate(payment.rate)}
        </span>
        <span className="text-[16.5px] font-bold">{formatINR(payment.amount * payment.rate)}</span>
      </div>
    </article>
  );
}
