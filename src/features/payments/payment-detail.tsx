import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import type { OrderOptions } from "@/lib/api/types";
import { formatDate, formatINR, formatMoney, formatRate, formatShortDate } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { DeletePaymentButton, type PaymentOrderFacts } from "./delete-payment";
import { RecordPaymentDialog } from "./record-payment-dialog";

const spacedMoney = (value: number, currency: Currency) => formatMoney(value, currency, { spaced: true });
/** A paid payment in INR: amount × its rate, rounded to the paisa per payment, as the API does (DEF-13). */
const inrOf = (payment: Payment) => Math.round(payment.amountCny * (payment.rateInr ?? 0) * 100) / 100;
const date = (value: string | null) => (value ? formatDate(value) : "–");

type PaymentDetailCardProps = {
  order: OrderPaymentRow;
  payments: Payment[];
  /** Shipping agents to offer as payees, or null when the user can't record payments (no button). */
  agents: OrderOptions["agents"] | null;
  /** The PO links to its order page (canOpen(me, "/orders")). */
  linkPo: boolean;
  /** Each payment has Delete (PAY-3, payments Full). */
  canDelete?: boolean;
};

/** Right card: the selected order's payments, each paid one at its own rate, and the totals. Records only. */
export function PaymentDetailCard({ order, payments, agents, linkPo, canDelete = false }: PaymentDetailCardProps) {
  const { po, supplier, currency } = order;
  const facts: PaymentOrderFacts = { po, supplier, currency, paidCny: order.paid, balanceCny: order.balance };
  const totalCny = payments.reduce((sum, p) => sum + p.amountCny, 0);
  // A due payment has no rate yet (PAY-1 gives one only once paid), so the INR total covers paid payments only.
  const totalInr = payments.reduce((sum, p) => sum + inrOf(p), 0);
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
                <PaymentBlock number={index + 1} payment={payment} currency={currency} remove={canDelete ? <DeletePaymentButton payment={payment} order={facts} /> : null} />
              </li>
            ))}
          </ol>

          <div className="mt-3 flex items-start justify-between gap-4 border-t-2 border-navy pt-2.5">
            <div>
              <p className="text-[15px] leading-5 font-bold">Total for this order</p>
              <p className="text-[12.5px] leading-4 text-muted-foreground">
                {spacedMoney(totalCny, currency)}
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

function PaymentBlock({ number, payment, currency, remove }: { number: number; payment: Payment; currency: Currency; remove: React.ReactNode }) {
  const paid = payment.status === "paid";
  const facts = paid
    ? [
        { label: "Paid on", value: date(payment.paidOn) },
        { label: "Amount", value: spacedMoney(payment.amountCny, currency) },
        { label: "Rate on that day", value: payment.rateInr === null ? "–" : formatRate(payment.rateInr) },
        { label: "Mode", value: payment.mode ?? "–" },
      ]
    : [
        { label: "Due date", value: date(payment.dueDate) },
        { label: "Amount", value: spacedMoney(payment.amountCny, currency) },
      ];
  // Reference and notes (migration 0008) show only when recorded; the notes take the whole row.
  const extras = [
    ...(payment.reference ? [{ label: "Reference", value: payment.reference, wide: false }] : []),
    ...(payment.notes ? [{ label: "Notes", value: payment.notes, wide: true }] : []),
  ];

  return (
    <article className="rounded-[10px] border bg-input-background px-4 py-[13px]">
      <div className="flex h-5 items-center justify-between gap-3">
        <h3 className="text-[14.5px] leading-[17px] font-bold">
          {number}. {payment.kind}
        </h3>
        <div className="flex items-center gap-3">
          {paid ? (
            <StatusPill tone="success">Paid</StatusPill>
          ) : (
            <StatusPill tone="warning">{payment.dueDate ? `Due ${formatShortDate(payment.dueDate)}` : "Due"}</StatusPill>
          )}
          {remove}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[12.5px] leading-[15px] text-muted-foreground">{fact.label}</dt>
            <dd className="text-[14.5px] leading-[17px] font-bold">{fact.value}</dd>
          </div>
        ))}
        {extras.map((fact) => (
          <div key={fact.label} className={fact.wide ? "col-span-2" : undefined}>
            <dt className="text-[12.5px] leading-[15px] text-muted-foreground">{fact.label}</dt>
            <dd className="text-[14.5px] leading-[17px] font-bold [overflow-wrap:anywhere]">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {/* An INR payment needs no change to INR (its rate is 1). */}
      {payment.rateInr === null || currency === "INR" ? null : (
        <div className="mt-3 flex h-[43px] items-center justify-between gap-3 rounded-lg border border-dashed border-placeholder/60 bg-card px-3">
          <span className="text-[13.5px] text-label">
            {spacedMoney(payment.amountCny, currency)} × {formatRate(payment.rateInr)}
          </span>
          <span className="text-[16.5px] font-bold">{formatINR(inrOf(payment))}</span>
        </div>
      )}
    </article>
  );
}
