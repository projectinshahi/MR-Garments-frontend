"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { dialogFooterButtonClass } from "@/components/shared/confirm-dialog";
import { RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { RecordFacts } from "@/features/order-detail/shared/delete-record";
import { FinalApprovalDialog, needsFinalApproval } from "@/features/receiving/final-approval-dialog";
import { rowActionClass } from "@/features/orders/delete-order";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { LedgerChange, PaymentRow } from "@/lib/api/ledger-types";
import type { VoidPaymentResponse } from "@/lib/api/types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate, formatINR, formatMoney, formatRate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { balanceText, HELD_MESSAGE } from "./money";

// PAY-3 after the unified ledger: a payment is never deleted, only voided with a reason (payments Full). The row stays,
// marked voided, and leaves every total; a posted supplier payment also gets a void entry on its account, whose balance
// before and after the API answers. Proposed wording.

export const VOID_TEXT = {
  reason: "Enter the reason for voiding this payment.",
  voided: "Payment voided",
};

/** The facts a void shows; a PAY-1, ORD-4 or ledger payment row. `held`: its account is pending review (D4). */
export type VoidablePayment = Pick<PaymentRow, "id" | "po" | "supplier" | "currency" | "kind" | "payee" | "payeeRole" | "amountCny" | "status" | "paidOn" | "dueDate" | "rateInr" | "amountInr" | "mode" | "reference"> & {
  held?: boolean;
};

const dateOf = (p: VoidablePayment) => (p.status === "paid" ? p.paidOn : p.dueDate);

/**
 * "Void" in a row's Actions, and its dialog: the reason, then the API's balance before and after. `voided`: no Void
 * button, but an open dialog stays: the refresh after a void marks the row voided while its result is still showing.
 * A held account's payment (D4): the API refuses every write to it (409), so Void is shown disabled with the reason.
 */
export function VoidPaymentButton({ payment, voided = false }: { payment: VoidablePayment; voided?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The page is refreshed when the dialog closes, never while the "Payment voided" result is shown: a refresh under an
  // open result could replace the row (or the page) that holds it, and the result would vanish before it is read.
  const changed = useRef(false);
  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next && changed.current) {
      changed.current = false;
      router.refresh();
    }
  };
  const date = dateOf(payment);
  return (
    <>
      {voided ? null : payment.held ? (
        <button type="button" disabled title={HELD_MESSAGE} aria-label={`Void unavailable: ${HELD_MESSAGE}`} className={cn(rowActionClass, "cursor-not-allowed text-muted-foreground")}>
          Void
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Void payment of ${date ? formatDate(date) : "no date"}, ${formatMoney(payment.amountCny, payment.currency)}`}
          className={cn(rowActionClass, "text-danger")}
          onClick={(event) => {
            // A row click would select its order.
            event.stopPropagation();
            setOpen(true);
          }}
        >
          Void
        </button>
      )}
      <Dialog open={open} onOpenChange={openChange}>
        <DialogContent className="gap-0 pb-[26px] sm:max-w-[500px]" onClick={(event) => event.stopPropagation()}>
          <VoidForm payment={payment} onClose={() => openChange(false)} onChanged={() => (changed.current = true)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Inside DialogContent, which unmounts on close: every open starts at the reason.
function VoidForm({ payment, onClose, onChanged }: { payment: VoidablePayment; onClose: () => void; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Done: the API's answer (`ledger` null when the payment was never posted, an agent's or a due one). */
  const [done, setDone] = useState<{ ledger: LedgerChange | null } | null>(null);
  const agent = payment.payeeRole === "agent";
  const paid = payment.status === "paid";
  const amount = formatMoney(payment.amountCny, payment.currency, { decimals: 2 });
  const date = dateOf(payment);

  // The API's 409 while the Management user gives the approval's reason (owner review of 2026-11-23).
  const [approval, setApproval] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!reason.trim()) return setError(VOID_TEXT.reason);
    await send();
  }

  async function send(approvalReason?: string) {
    setPending(true);
    try {
      const response = await apiClient.delete<VoidPaymentResponse>(`/payments/${encodeURIComponent(payment.id)}`, {
        reason: reason.trim(),
        ...(approvalReason ? { finalSettlementApproval: { reason: approvalReason } } : {}),
      });
      setApproval(null);
      setDone({ ledger: response?.ledger ?? null });
      notifySuccess(VOID_TEXT.voided);
      onChanged();
    } catch (failure) {
      // Voided or gone already: say so and show the page as it is now.
      if (failure instanceof ApiError && ((failure.status === 409 && failure.code === "already_voided") || failure.status === 404)) {
        notifyError(failure.message);
        onChanged();
        onClose();
        return;
      }
      // Voiding is Management's (payments Full), who can approve a change to a final landed cost.
      const final = needsFinalApproval(failure);
      if (final && !approvalReason) return setApproval(final);
      const fields = handleApiError(failure) ?? {};
      if (fields.reason) setError(fields.reason);
      Object.entries(fields)
        .filter(([key]) => key !== "reason")
        .forEach(([, message]) => notifyError(message));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <>
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[26px]">Payment voided</DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {done.ledger
              ? `${payment.supplier}'s ${done.ledger.currency} account: ${balanceText(done.ledger.balanceBefore, done.ledger.currency)} before, ${balanceText(done.ledger.balanceAfter, done.ledger.currency)} after.`
              : agent
                ? "The order's sea freight and the INR total no longer count it. The supplier's account doesn't change."
                : "It was not on the supplier's account, so the balance doesn't change."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 pt-4">
          <Button type="button" className={dialogFooterButtonClass} onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <form noValidate onSubmit={submit}>
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[26px]">Void payment?</DialogTitle>
          <DialogDescription asChild className="flex flex-col gap-2 text-sm leading-5 [overflow-wrap:anywhere]">
            <div>
              <p>
                The payment stays listed, marked voided, and leaves every total.{" "}
                {agent
                  ? "It is a sea freight payment, so the supplier's account doesn't change."
                  : paid
                    ? `A void entry takes ${amount} off ${payment.supplier}'s ${payment.currency} account; its orders settle again from what is left.`
                    : "Nothing was paid, so no balance changes."}{" "}
                This can&apos;t be undone.
              </p>
              <RecordFacts
                facts={[
                  ["Paid to", agent ? `${payment.payee} (shipping agent)` : payment.payee],
                  ["Order", payment.po ?? "None (supplier account)"],
                  ["Type", payment.kind],
                  ["Amount", paid && payment.amountInr !== null && payment.rateInr !== null ? `${amount} · ${formatINR(payment.amountInr)} at ${formatRate(payment.rateInr)}` : amount],
                  [paid ? "Paid on" : "Due on", date ? formatDate(date) : "–"],
                  ...(payment.mode ? [["Mode", payment.mode] satisfies [string, string]] : []),
                  ...(payment.reference ? [["Reference", payment.reference] satisfies [string, string]] : []),
                ]}
              />
            </div>
          </DialogDescription>
        </DialogHeader>
        <Field className="mt-4 gap-[5px]" data-invalid={!!error}>
          <FieldLabel htmlFor="void-reason" className="gap-0.5 text-[12.5px] leading-[15px] font-bold text-label">
            Reason <RequiredMark />
          </FieldLabel>
          <Textarea
            id="void-reason"
            required
            maxLength={1000}
            className="min-h-[70px] text-sm"
            aria-invalid={!!error}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
          />
          <FieldError errors={error ? [{ message: error }] : []} />
        </Field>
        <DialogFooter className="mt-5 pt-4">
          <Button type="button" variant="outline" className={cn(dialogFooterButtonClass, "border-input")} onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" className={cn(dialogFooterButtonClass, "bg-destructive text-white hover:bg-danger")} disabled={pending} aria-busy={pending}>
            {pending ? "Voiding…" : "Void payment"}
          </Button>
        </DialogFooter>
      </form>
      {/* Outside the form: React bubbles a portal's submit to its React parents. */}
      <FinalApprovalDialog message={approval} onCancel={() => setApproval(null)} onApprove={(approvalReason) => send(approvalReason)} />
    </>
  );
}
