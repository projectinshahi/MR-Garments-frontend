"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Callout } from "@/components/shared/cards";
import { RequiredMark } from "@/components/shared/form";
import { dialogFooterButtonClass } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FinalApprovalDialog, needsFinalApproval } from "@/features/receiving/final-approval-dialog";
import { rowActionClass } from "@/features/orders/delete-order";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { PaymentRow, PaymentSettlement } from "@/lib/api/ledger-types";
import type { EditPaymentResponse } from "@/lib/api/types";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { currencySymbol, formatDate, formatMoney, rateText } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/domain";

import { balanceText, HELD_MESSAGE, money2, paymentType, settlementText, usedByText } from "./money";
import { Footer, InrLine, MoneyFields, newRequestId, showErrors } from "./record-payment-dialog";
import { editSchemaFor, editStart, type EditPaymentInput, type EditPaymentValues, minAmountText, moneyChanged, toEditPaymentBody, toNumber } from "./record-payment-form";

// PAY-4 Edit payment (payments Full, as Void). A current supplier payment (orderless) or a shipping agent's: mode,
// reference and notes change on the payment itself; a new amount, date or rate is a correction (the API voids the
// payment and records the corrected one, both stay listed), so it needs a reason. A legacy supplier row (Deposit or
// Balance, or recorded against a PO; owner decision, option A): every change is a correction that keeps its order and
// kind, always with a reason. Its `settlement` (the API's, never the Paid label) decides what may change: unused, all
// of it; partly used, not the date or rate and an amount of at least what it paid; fully used, nothing. Proposed wording.

export const EDIT_TEXT = {
  updated: "Payment updated",
  blockedTitle: "Can't edit this payment",
  legacyNext: "Void is next to Edit on this payment, and + Record payment is at the top of the Payments page.",
  heldNext: "Payments of an account under review can't change until the review is done.",
  noSettlement: "How much of this payment paid orders isn't known, so it can't be edited. Refresh the page and try again.",
  noRate: "Part of this payment already paid orders and it has no saved INR rate, which can't be added now, so it can't be edited.",
  legacyIntro: "Any change voids this payment and records the corrected copy on the same order and type; both stay listed.",
};

/** "Fully used: ¥5,000.00 paid PO-11218, so it can't be edited." */
export const fullyUsedText = (s: PaymentSettlement, currency: Currency) => `Fully used: ${money2(s.usedCny, currency)} paid ${usedByText(s)}, so it can't be edited.`;
/** "Locked: ¥3,000.00 of this payment already paid PO-11218." */
export const lockedText = (s: PaymentSettlement, currency: Currency) => `Locked: ${money2(s.usedCny, currency)} of this payment already paid ${usedByText(s)}.`;

/** The facts Edit needs; a PAY-1 or ORD-4 payment row. `held`: its account is pending review (D4). */
export type EditablePayment = Pick<
  PaymentRow,
  "id" | "po" | "supplier" | "currency" | "kind" | "payee" | "payeeRole" | "amountCny" | "status" | "paidOn" | "rateInr" | "mode" | "reference" | "notes" | "voided" | "settlement"
> & { held?: boolean };

/** A legacy supplier row (Deposit or Balance on an order, before the ledger): every edit is a correction. */
const isLegacy = (p: EditablePayment) => p.payeeRole === "supplier" && (p.kind !== "Payment" || p.po !== null);

type Blocked = { reason: string; next: string; usedBy?: PaymentSettlement["usedBy"] };

/** Why a payment can't be edited (the API would refuse it), or null: a held account, a legacy row fully used or without its settlement. */
function blockedFor(payment: EditablePayment): Blocked | null {
  if (payment.held) return { reason: HELD_MESSAGE, next: EDIT_TEXT.heldNext };
  if (!isLegacy(payment)) return null;
  const settlement = payment.settlement ?? null;
  if (!settlement) return { reason: EDIT_TEXT.noSettlement, next: EDIT_TEXT.legacyNext };
  if (settlement.state === "settled") return { reason: fullyUsedText(settlement, payment.currency), next: EDIT_TEXT.legacyNext, usedBy: settlement.usedBy };
  // Partly used keeps its saved rate; with none saved (a foreign-currency payment) there is nothing valid to keep.
  if (settlement.state === "partly" && payment.rateInr === null && payment.currency !== "INR")
    return { reason: EDIT_TEXT.noRate, next: EDIT_TEXT.legacyNext, usedBy: settlement.usedBy };
  return null;
}

/**
 * "Edit" in a row's Actions, and its dialog. Nothing for a voided or due payment. A held account, or a legacy row fully
 * used (or without its settlement), opens the reason and what to do instead, never the form. Saving refreshes the page
 * (the row and the KPIs).
 */
export function EditPaymentButton({ payment }: { payment: EditablePayment }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const legacy = isLegacy(payment);
  // A due row is never editable (the API answers 409 not_editable), legacy or not.
  if (payment.voided || payment.status !== "paid") return null;
  const blocked = blockedFor(payment);
  const settlement = legacy ? (payment.settlement ?? null) : null;
  return (
    <>
      {/* Always clickable: on a payment that can't be edited it opens the reason (a disabled button gave no answer to a
          click, and its tooltip never shows on a phone). */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={blocked ? `Edit unavailable: ${blocked.reason}` : `Edit payment of ${payment.paidOn ? formatDate(payment.paidOn) : "no date"}, ${formatMoney(payment.amountCny, payment.currency)}`}
        title={blocked?.reason}
        className={cn(rowActionClass, blocked && "text-muted-foreground")}
        onClick={(event) => {
          // A row click would select its order.
          event.stopPropagation();
          setOpen(true);
        }}
      >
        Edit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 pb-[26px]" onClick={(event) => event.stopPropagation()}>
          {blocked ? (
            <>
              <DialogHeader className="gap-[7px]">
                <DialogTitle className="text-[21px] leading-[26px]">{EDIT_TEXT.blockedTitle}</DialogTitle>
                <DialogDescription className="text-sm leading-5 [overflow-wrap:anywhere]">{blocked.reason}</DialogDescription>
              </DialogHeader>
              {blocked.usedBy?.length ? (
                <ul aria-label="What this payment paid" className="mt-3 flex flex-col gap-1 text-sm leading-5">
                  {blocked.usedBy.map((used, index) => (
                    <li key={`${used.po}-${index}`} className="flex justify-between gap-3">
                      <span>{used.po ?? "Ledger adjustment"}</span>
                      <strong>{money2(used.amountCny, payment.currency)}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-sm leading-5">{blocked.next}</p>
              <DialogFooter className="mt-5 pt-4">
                <Button type="button" className={dialogFooterButtonClass} onClick={() => setOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="gap-[7px]">
                <DialogTitle className="text-[21px] leading-[26px]">Edit payment</DialogTitle>
                <DialogDescription className="text-sm leading-5 [overflow-wrap:anywhere]">
                  {legacy ? (
                    <>
                      {paymentType(payment)} paid to {payment.supplier}&apos;s {payment.currency} account. {EDIT_TEXT.legacyIntro}
                    </>
                  ) : (
                    <>
                      {payment.payeeRole === "agent" ? `Sea freight paid to ${payment.payee} for ${payment.po}.` : `Paid to ${payment.supplier}'s ${payment.currency} account.`} Mode,
                      reference and notes change on this payment. A new amount, date or rate voids it and records the corrected payment; both stay listed.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              {settlement ? (
                <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm leading-5">
                  <dt className="text-muted-foreground">Order</dt>
                  <dd className="font-bold">{payment.po ?? "None"}</dd>
                  <dt className="text-muted-foreground">Settlement</dt>
                  <dd className="font-bold [overflow-wrap:anywhere]">
                    {settlementText(settlement, payment.currency)}
                    {settlement.state === "partly" ? `, paid ${usedByText(settlement)}` : ""}
                  </dd>
                </dl>
              ) : null}
              <EditForm
                payment={payment}
                legacy={legacy}
                settlement={settlement}
                onClose={() => setOpen(false)}
                onSaved={(message) => {
                  if (message) notifySuccess(message);
                  setOpen(false);
                  router.refresh();
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type EditFormProps = {
  payment: EditablePayment;
  /** Every change is a correction with a reason. */
  legacy: boolean;
  /** A legacy row's settlement (unused or partly used here); null otherwise. */
  settlement: PaymentSettlement | null;
  onClose: () => void;
  onSaved: (message: string | null) => void;
};

// Inside DialogContent, which unmounts on close: every open starts from the saved payment with a new request id, kept
// across this open's retries so a lost answer never records the correction twice.
function EditForm({ payment, legacy, settlement, onClose, onSaved }: EditFormProps) {
  const router = useRouter();
  const [today] = useState(() => todayInIndia());
  const [requestId] = useState(newRequestId);
  const [approval, setApproval] = useState<{ message: string; values: EditPaymentValues } | null>(null);
  // 409 settled_payment (fully used meanwhile: nothing left to save) or settlement_change (the change would alter what paid an order).
  const [conflict, setConflict] = useState<{ message: string; final: boolean } | null>(null);
  const partly = settlement?.state === "partly" ? settlement : null;
  const { register, handleSubmit, setError, control, formState } = useForm<EditPaymentInput, unknown, EditPaymentValues>({
    resolver: zodResolver(editSchemaFor(today, payment, { reasonAlways: legacy, minAmount: partly?.usedCny })),
    defaultValues: editStart(payment),
  });
  const { errors } = formState;
  const inr = payment.currency === "INR";
  const [amount, paidOn, rateInr] = useWatch({ control, name: ["amount", "paidOn", "rateInr"] });
  const correction = legacy || moneyChanged(payment, { amount: toNumber(amount), paidOn, rateInr: inr ? undefined : toNumber(rateInr) });
  // A reason alone changes nothing on the payment.
  const changed = Object.keys(formState.dirtyFields).some((field) => field !== "reason");

  async function save(values: EditPaymentValues, approvalReason?: string) {
    setConflict(null);
    let response: EditPaymentResponse;
    try {
      response = await apiClient.patch<EditPaymentResponse>(`/payments/${encodeURIComponent(payment.id)}`, {
        ...toEditPaymentBody(payment, values, requestId, legacy),
        ...(approvalReason ? { finalSettlementApproval: { reason: approvalReason } } : {}),
      });
    } catch (error) {
      // Voided or gone already: say so and show the page as it is now.
      if (error instanceof ApiError && ((error.status === 409 && error.code === "already_voided") || error.status === 404)) {
        notifyError(error.message);
        onSaved(null);
        return;
      }
      if (error instanceof ApiError && error.status === 409 && (error.code === "settled_payment" || error.code === "settlement_change")) {
        setApproval(null);
        const final = error.code === "settled_payment";
        setConflict({ message: error.message, final });
        // Fully used now: the refreshed row says so (and this dialog turns into its explanation).
        if (final) router.refresh();
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
            locked={partly ? lockedText(partly, payment.currency) : undefined}
            amountHint={partly ? `${minAmountText(partly.usedCny, payment.currency)}.` : undefined}
          />
          {correction ? (
            <Field className="gap-[5px] sm:col-span-2" data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="edit-reason" className="gap-0.5 text-[12.5px] leading-[15px] font-bold text-label">
                Reason for the correction <RequiredMark />
              </FieldLabel>
              <Textarea id="edit-reason" required maxLength={1000} className="min-h-[60px] text-sm" aria-invalid={!!errors.reason} {...register("reason")} />
              <FieldDescription className="text-xs">
                {legacy
                  ? "The payment is voided with this reason and the corrected copy is recorded on the same order."
                  : "The payment is voided with this reason and the corrected one is recorded."}
              </FieldDescription>
              <FieldError errors={[errors.reason]} />
            </Field>
          ) : null}
        </div>
        <InrLine amount={amount} rateInr={inr ? "1" : rateInr} />
        {conflict ? (
          <Callout tone="warning" size="sm" role="alert" className="mt-[14px] [overflow-wrap:anywhere]">
            {conflict.message}
          </Callout>
        ) : null}
        {/* Disabled while the request runs (one click, one correction), until something changed, and once it is fully used. */}
        <Footer onCancel={onClose} pending={formState.isSubmitting} disabled={!changed || !!conflict?.final} label={formState.isSubmitting ? "Saving…" : "Save changes"} />
      </form>
      {/* Outside the form: React bubbles a portal's submit to its React parents. */}
      <FinalApprovalDialog message={approval?.message ?? null} onCancel={() => setApproval(null)} onApprove={(reason) => save(approval!.values, reason)} />
    </>
  );
}
