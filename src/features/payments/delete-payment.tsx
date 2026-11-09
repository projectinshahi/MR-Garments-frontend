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

import { DASH, round2 } from "./money";

/**
 * The order the payment belongs to, with the figures a delete changes (all in its currency): paid to the supplier and
 * the balance the supplier is still owed (phase 2 fixes, 1).
 */
export type PaymentOrderFacts = { po: string; supplier: string; currency: Currency; supplierPaidCny: number | null; balanceCny: number | null };
/** A PAY-1 or ORD-4 payment, with the API's `amountInr` (null while due, or from an older API). */
export type DeletablePayment = OrderPayment;

/**
 * PAY-3: a deposit or a balance payment, paid or due, with its confirmation (Deposits & Payments, the order's payments
 * tab). The dialog names the record and what changes: a paid supplier payment lowers "paid to supplier" and raises the
 * balance by its amount; a paid agent payment moves only the sea freight and the INR total; a due one changes nothing
 * paid. Proposed wording.
 */
export function DeletePaymentButton({
  payment,
  order,
  opened,
  onClosed,
}: {
  payment: DeletablePayment;
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
  const inr = paid ? (payment.amountInr ?? null) : null;
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
            {!paid
              ? `Nothing paid changes: ${amount} due ${date ? formatDate(date) : ""} leaves the order's next due date and the due totals.`
              : order.supplierPaidCny == null || order.balanceCny == null
                ? `The supplier's paid and balance figures for ${order.po} follow (${DASH}: not sent by this API yet).`
                : agent
                  ? `Paid to supplier for ${order.po} stays at ${money(order.supplierPaidCny)} and the balance to supplier at ${money(order.balanceCny)}.`
                  : `Paid to supplier for ${order.po} goes from ${money(order.supplierPaidCny)} to ${money(round2(order.supplierPaidCny - payment.amountCny))}, and the balance to supplier from ${money(order.balanceCny)} to ${money(round2(order.balanceCny + payment.amountCny))}.`}
          </p>
          <p>
            {paid
              ? agent
                ? "The order's sea freight cost and the INR total paid follow; the supplier's paid and outstanding figures don't change. "
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
export const paymentChoice = (payment: DeletablePayment, currency: Currency) => {
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
export function DeletePaymentMenu({ payments, order }: { payments: DeletablePayment[]; order: PaymentOrderFacts }) {
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
