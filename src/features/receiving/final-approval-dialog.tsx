"use client";

import { useState } from "react";

import { dialogFooterButtonClass } from "@/components/shared/confirm-dialog";
import { RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

// REC-3 / REC-4 (backend docs/unified-ledger.md "Order value"): a receipt changes its order's value (received quantity x
// rate), and when that re-settles an order whose landed cost is final the API answers 409 final_settlement_approval.
// A Management user (payments Full) approves it here with a reason, kept on the ledger posting with their name and the
// time; anyone else sees the API's message only.

export const FINAL_APPROVAL_TEXT = {
  title: "Approve a change to a final landed cost?",
  reason: "Enter the reason for approving this change.",
  ask: "Ask a Management user to record this receipt change: it needs their approval.",
};

/** The API's 409 that asks for the approval, or null. */
export const needsFinalApproval = (error: unknown) => (error instanceof ApiError && error.status === 409 && error.code === "final_settlement_approval" ? error.message : null);

/**
 * The approval dialog: `message` is the API's (which final orders it changes); `onApprove` resubmits with the reason and
 * resolves once done (the dialog closes), or rejects (the dialog stays open, the caller toasts).
 */
export function FinalApprovalDialog({ message, onApprove, onCancel }: { message: string | null; onApprove: (reason: string) => Promise<void>; onCancel: () => void }) {
  return (
    <Dialog open={message !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="gap-0 pb-[26px] sm:max-w-[500px]">{message !== null ? <ApprovalForm message={message} onApprove={onApprove} onCancel={onCancel} /> : null}</DialogContent>
    </Dialog>
  );
}

function ApprovalForm({ message, onApprove, onCancel }: { message: string; onApprove: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!reason.trim()) return setError(FINAL_APPROVAL_TEXT.reason);
    setPending(true);
    try {
      await onApprove(reason.trim());
    } finally {
      setPending(false);
    }
  }
  return (
    <form noValidate onSubmit={submit}>
      <DialogHeader className="gap-[7px]">
        <DialogTitle className="text-[21px] leading-[26px]">{FINAL_APPROVAL_TEXT.title}</DialogTitle>
        <DialogDescription className="text-sm leading-5 [overflow-wrap:anywhere]">
          {message} Your name, the time and this reason are kept on the supplier ledger entry.
        </DialogDescription>
      </DialogHeader>
      <Field className="mt-4 gap-[5px]" data-invalid={!!error}>
        <FieldLabel htmlFor="final-approval-reason" className="gap-0.5 text-[12.5px] leading-[15px] font-bold text-label">
          Reason <RequiredMark />
        </FieldLabel>
        <Textarea
          id="final-approval-reason"
          required
          maxLength={500}
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
        <Button type="button" variant="outline" className={cn(dialogFooterButtonClass, "border-input")} onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" className={dialogFooterButtonClass} disabled={pending} aria-busy={pending}>
          {pending ? "Approving…" : "Approve and save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
