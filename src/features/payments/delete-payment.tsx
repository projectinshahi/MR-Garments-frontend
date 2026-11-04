"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRef, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { OrderPayment } from "@/features/order-detail/data/queries";
import { DeleteRecordButton, RecordFacts } from "@/features/order-detail/shared/delete-record";
import { rowActionClass } from "@/features/orders/delete-order";
import { formatDate, formatINR, formatMoney, formatRate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/domain";

/** The order the payment belongs to, with the figures a delete changes (all in its currency). */
export type PaymentOrderFacts = { po: string; supplier: string; currency: Currency; paidCny: number; balanceCny: number };

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * PAY-3: a deposit or a balance payment, paid or due, with its confirmation (Deposits & Payments, the order's payments
 * tab). The dialog names the record and what changes: a paid one lowers "paid so far" and raises the balance by its
 * amount (the supplier's or the sea-freight figures follow); a due one changes nothing paid. Proposed wording.
 */
export function DeletePaymentButton({
  payment,
  order,
  opened,
  onClosed,
}: {
  payment: OrderPayment;
  order: PaymentOrderFacts;
  /** Mounted already asking, without its own button (DeletePaymentMenu picked it); `onClosed` when the dialog closes. */
  opened?: boolean;
  onClosed?: () => void;
}) {
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
      opened={opened}
      onClosed={onClosed}
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

/** "Deposit · 4 Nov 2026 · ¥300", "Balance · due 12 Nov 2026 · ¥15,000": one payment in DeletePaymentMenu. */
export const paymentChoice = (payment: OrderPayment, currency: Currency) => {
  const paid = payment.status === "paid";
  const date = paid ? payment.paidOn : payment.dueDate;
  return `${payment.kind} · ${paid ? "" : "due "}${date ? formatDate(date) : "no date"} · ${formatMoney(payment.amountCny, currency)}`;
};

/**
 * An order row's Delete (Payments by order): a menu of that order's payments; the one picked opens its usual PAY-3
 * confirmation (DeletePaymentButton, mounted already asking). None without payments. The menu isn't modal, so the
 * dialog it opens takes over cleanly; clicks never reach the row (which would select the order). The dialog opens once
 * the menu has closed and focus is back on the trigger, so closing the dialog returns focus there.
 */
export function DeletePaymentMenu({ payments, order }: { payments: OrderPayment[]; order: PaymentOrderFacts }) {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = useRef<string | null>(null);
  const payment = payments.find((p) => p.id === picked);
  if (payments.length === 0) return null;
  return (
    <span onClick={(event) => event.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Delete a payment of ${order.po}`} className={cn(rowActionClass, "inline-flex items-center gap-0.5 text-danger")}>
            Delete
            <ChevronDownIcon aria-hidden className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-56"
          // Runs as the menu closes, before Radix focuses the trigger; the dialog then mounts with the trigger as its opener.
          onCloseAutoFocus={() => {
            if (chosen.current) setPicked(chosen.current);
            chosen.current = null;
          }}
        >
          {payments.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => (chosen.current = p.id)}>
              {paymentChoice(p, order.currency)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {payment ? <DeletePaymentButton key={payment.id} payment={payment} order={order} opened onClosed={() => setPicked(null)} /> : null}
    </span>
  );
}
