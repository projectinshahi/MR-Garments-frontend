import type { OrderPayment } from "@/features/order-detail/data/queries";
import { DeleteRecordButton, RecordFacts } from "@/features/order-detail/shared/delete-record";
import { formatDate, formatINR, formatMoney, formatRate } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

/** The order the payment belongs to, with the figures a delete changes (all in its currency). */
export type PaymentOrderFacts = { po: string; supplier: string; currency: Currency; paidCny: number; balanceCny: number };

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * PAY-3: a deposit or a balance payment, paid or due, with its confirmation (Deposits & Payments, the order's payments
 * tab). The dialog names the record and what changes: a paid one lowers "paid so far" and raises the balance by its
 * amount (the supplier's or the sea-freight figures follow); a due one changes nothing paid. Proposed wording.
 */
export function DeletePaymentButton({ payment, order }: { payment: OrderPayment; order: PaymentOrderFacts }) {
  const deposit = payment.kind === "Deposit";
  const paid = payment.status === "paid";
  const money = (value: number) => formatMoney(value, order.currency);
  const amount = money(payment.amountCny);
  const date = paid ? payment.paidOn : payment.dueDate;
  const inr = paid && payment.rateInr !== null ? round2(payment.amountCny * payment.rateInr) : null;
  const agent = payment.payeeRole === "agent";

  return (
    <DeleteRecordButton
      path={`/payments/${payment.id}`}
      noun={deposit ? "deposit" : "payment"}
      label={`Delete ${deposit ? "deposit" : "payment"} of ${date ? formatDate(date) : "no date"}, ${amount}`}
      title={deposit ? "Delete Deposit?" : "Delete Payment?"}
      description={
        <>
          <p>
            Are you sure you want to delete this {deposit ? "deposit" : "payment"} of <strong className="whitespace-nowrap text-foreground">{order.po}</strong>?
            This can&apos;t be undone.
          </p>
          <RecordFacts
            facts={[
              ["Type", deposit ? "Deposit" : "Balance payment"],
              ["Reference", <span key="id" className="font-normal break-all">{payment.id}</span>],
              ["Order", `${order.po} · ${order.supplier}`],
              ["Paid to", agent ? `${payment.payee} (shipping agent)` : payment.payee],
              ["Amount", inr === null ? amount : `${amount} · ${formatINR(inr)} at ${formatRate(payment.rateInr!)}`],
              [paid ? "Paid on" : "Due on", date ? formatDate(date) : "–"],
              ...(paid ? [["Mode", payment.mode ?? "–"] satisfies [string, string]] : []),
              ["Status", paid ? "Paid" : "Due"],
            ]}
          />
          <p className="font-bold text-foreground">
            {paid
              ? `Paid so far for ${order.po} goes from ${money(order.paidCny)} to ${money(round2(order.paidCny - payment.amountCny))}, and the balance to pay from ${money(order.balanceCny)} to ${money(round2(order.balanceCny + payment.amountCny))}.`
              : `Nothing paid changes: ${amount} due ${date ? formatDate(date) : ""} leaves the order's next due date and the due totals.`}
          </p>
          <p>
            {paid
              ? agent
                ? "The order's sea freight cost follows; the supplier's paid and outstanding figures don't change. "
                : "The supplier's paid and outstanding figures and the order's goods cost in INR follow. "
              : ""}
            The order and its other payments stay; other payments keep their own rates.
          </p>
        </>
      }
    />
  );
}
