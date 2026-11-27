"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { RequiredMark } from "@/components/shared/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FinalApprovalDialog, needsFinalApproval } from "@/features/receiving/final-approval-dialog";
import { rowActionClass } from "@/features/orders/delete-order";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { PaymentRow } from "@/lib/api/ledger-types";
import type { EditPaymentResponse } from "@/lib/api/types";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { currencySymbol, formatDate, formatMoney, rateText } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";

import { balanceText, HELD_MESSAGE } from "./money";
import { Footer, InrLine, MoneyFields, newRequestId, showErrors } from "./record-payment-dialog";
import { editSchemaFor, editStart, type EditPaymentInput, type EditPaymentValues, moneyChanged, toEditPaymentBody, toNumber } from "./record-payment-form";

// PAY-4 Edit payment (payments Full, as Void). Mode, reference and notes change on the payment itself. A new amount,
// date or rate is a correction: the API voids the payment and records the corrected one (both stay listed), so it needs
// a reason. Only a current supplier payment (orderless) or a shipping agent's can be edited. Proposed wording.

export const EDIT_TEXT = {
  updated: "Payment updated",
  legacy: "Recorded against an order before the supplier ledger: void it and record a new payment instead.",
};

/** The facts Edit needs; a PAY-1 or ORD-4 payment row. `held`: its account is pending review (D4). */
export type EditablePayment = Pick<
  PaymentRow,
  "id" | "po" | "supplier" | "currency" | "kind" | "payee" | "payeeRole" | "amountCny" | "status" | "paidOn" | "rateInr" | "mode" | "reference" | "notes" | "voided"
> & { held?: boolean };

/** A legacy supplier row (Deposit or Balance on an order, before the ledger): read-only, Void still works. */
const isLegacy = (p: EditablePayment) => p.payeeRole === "supplier" && (p.kind !== "Payment" || p.po !== null);

/**
 * "Edit" in a row's Actions, and its dialog. Nothing for a voided or due payment; disabled with the reason for a legacy
 * supplier row or a held account (the API refuses both with 409). Saving refreshes the page (the row and the KPIs).
 */
export function EditPaymentButton({ payment }: { payment: EditablePayment }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const legacy = isLegacy(payment);
  if (payment.voided || (!legacy && payment.status !== "paid")) return null;
  const blocked = legacy ? EDIT_TEXT.legacy : payment.held ? HELD_MESSAGE : null;
  return (
    <>
      {blocked ? (
        <button type="button" disabled title={blocked} aria-label={`Edit unavailable: ${blocked}`} className={cn(rowActionClass, "cursor-not-allowed text-muted-foreground")}>
          Edit
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Edit payment of ${payment.paidOn ? formatDate(payment.paidOn) : "no date"}, ${formatMoney(payment.amountCny, payment.currency)}`}
          className={rowActionClass}
          onClick={(event) => {
            // A row click would select its order.
            event.stopPropagation();
            setOpen(true);
          }}
        >
          Edit
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 pb-[26px]" onClick={(event) => event.stopPropagation()}>
          <DialogHeader className="gap-[7px]">
            <DialogTitle className="text-[21px] leading-[26px]">Edit payment</DialogTitle>
            <DialogDescription className="text-sm leading-5 [overflow-wrap:anywhere]">
              {payment.payeeRole === "agent" ? `Sea freight paid to ${payment.payee} for ${payment.po}.` : `Paid to ${payment.supplier}'s ${payment.currency} account.`} Mode, reference
              and notes change on this payment. A new amount, date or rate voids it and records the corrected payment; both stay listed.
            </DialogDescription>
          </DialogHeader>
          <EditForm
            payment={payment}
            onClose={() => setOpen(false)}
            onSaved={(message) => {
              if (message) notifySuccess(message);
              setOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Inside DialogContent, which unmounts on close: every open starts from the saved payment with a new request id, kept
// across this open's retries so a lost answer never records the correction twice.
function EditForm({ payment, onClose, onSaved }: { payment: EditablePayment; onClose: () => void; onSaved: (message: string | null) => void }) {
  const [today] = useState(() => todayInIndia());
  const [requestId] = useState(newRequestId);
  const [approval, setApproval] = useState<{ message: string; values: EditPaymentValues } | null>(null);
  const { register, handleSubmit, setError, control, formState } = useForm<EditPaymentInput, unknown, EditPaymentValues>({
    resolver: zodResolver(editSchemaFor(today, payment)),
    defaultValues: editStart(payment),
  });
  const { errors } = formState;
  const inr = payment.currency === "INR";
  const [amount, paidOn, rateInr] = useWatch({ control, name: ["amount", "paidOn", "rateInr"] });
  const correction = moneyChanged(payment, { amount: toNumber(amount), paidOn, rateInr: inr ? undefined : toNumber(rateInr) });

  async function save(values: EditPaymentValues, approvalReason?: string) {
    let response: EditPaymentResponse;
    try {
      response = await apiClient.patch<EditPaymentResponse>(`/payments/${encodeURIComponent(payment.id)}`, {
        ...toEditPaymentBody(payment, values, requestId),
        ...(approvalReason ? { finalSettlementApproval: { reason: approvalReason } } : {}),
      });
    } catch (error) {
      // Voided or gone already: say so and show the page as it is now.
      if (error instanceof ApiError && ((error.status === 409 && error.code === "already_voided") || error.status === 404)) {
        notifyError(error.message);
        onSaved(null);
        return;
      }
      // Editing is Management's (payments Full), who can approve a change to a final landed cost.
      const final = needsFinalApproval(error);
      if (final && !approvalReason) return setApproval({ message: final, values });
      showErrors(error, setError, (field) => field in values);
      return;
    }
    setApproval(null);
    const { ledger, replaced } = response;
    onSaved(
      ledger
        ? `Payment corrected. Balance: ${balanceText(ledger.balanceBefore, ledger.currency)} → ${balanceText(ledger.balanceAfter, ledger.currency)}`
        : replaced
          ? "Payment corrected"
          : EDIT_TEXT.updated,
    );
  }

  return (
    <>
      <form noValidate onSubmit={handleSubmit((values) => save(values))} className="mt-[14px]">
        <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
          <MoneyFields
            register={(field) => register(field)}
            errors={errors}
            today={today}
            symbol={currencySymbol(payment.currency)}
            inr={inr}
            rateHint={payment.rateInr !== null && !inr ? `Saved: ${rateText(payment.currency, payment.rateInr)}.` : "Enter this payment's rate."}
          />
          {correction ? (
            <Field className="gap-[5px] sm:col-span-2" data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="edit-reason" className="gap-0.5 text-[12.5px] leading-[15px] font-bold text-label">
                Reason for the correction <RequiredMark />
              </FieldLabel>
              <Textarea id="edit-reason" required maxLength={1000} className="min-h-[60px] text-sm" aria-invalid={!!errors.reason} {...register("reason")} />
              <FieldDescription className="text-xs">The payment is voided with this reason and the corrected one is recorded.</FieldDescription>
              <FieldError errors={[errors.reason]} />
            </Field>
          ) : null}
        </div>
        <InrLine amount={amount} rateInr={inr ? "1" : rateInr} />
        {/* Disabled while the request runs (one click, one correction) and until something changed. */}
        <Footer onCancel={onClose} pending={formState.isSubmitting} disabled={!formState.isDirty} label={formState.isSubmitting ? "Saving…" : "Save changes"} />
      </form>
      {/* Outside the form: React bubbles a portal's submit to its React parents. */}
      <FinalApprovalDialog message={approval?.message ?? null} onCancel={() => setApproval(null)} onApprove={(reason) => save(approval!.values, reason)} />
    </>
  );
}
