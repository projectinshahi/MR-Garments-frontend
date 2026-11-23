"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { dialogFooterButtonClass } from "@/components/shared/confirm-dialog";
import { RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseNumber } from "@/features/order-form/order-totals";
import { FinalApprovalDialog, needsFinalApproval } from "@/features/receiving/final-approval-dialog";
import { balanceText } from "@/features/payments/money";
import { apiClient } from "@/lib/api/client";
import type { OrderDetail } from "@/lib/api/types";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { formatMoney, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/domain";

// ORD-8 POST /orders/:po/rate-corrections (backend docs/unified-ledger.md, owner rule of 2026-11-23, 7): once goods are
// received, a line's rate is corrected only by Management with a reason. The API posts received quantity x the rate
// change to the supplier's account (one adjustment, with the reason, the actor and the time); receipts and payments
// never change.

export const RATE_CORRECTION_TEXT = {
  title: "Correct rates",
  description: "Correct the rate of a line whose goods are received. The supplier's account changes by the received quantity × the rate change.",
  reason: "Enter the reason for this rate correction.",
  rate: "Enter a rate of 0 or more.",
  unchanged: "Change the rate of at least one line.",
  saved: (before: number, after: number, currency: Currency) => `Rates corrected. Supplier balance: ${balanceText(before, currency)} → ${balanceText(after, currency)}`,
  final: (pos: string[]) => `This changes the settlement of ${pos.join(", ")}, whose landed cost was final.`,
};

type CorrectableOrder = Pick<OrderDetail, "po" | "currency" | "lines">;
type Response = { ledger: { currency: Currency; changeCny: number; balanceBefore: number; balanceAfter: number; finalOrders: string[] } };

/** Only lines with goods received are listed; others change on Edit order before any goods arrive. */
export const correctableLines = (order: CorrectableOrder) => order.lines.filter((line) => line.received > 0);

/** The Items tab's "Correct rates" (Management, goods received, account not held) and its dialog. */
export function CorrectRatesButton({ order }: { order: CorrectableOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Correct rates
      </Button>
      <RateCorrectionDialog order={order} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RateCorrectionDialog({ order, open, onClose }: { order: CorrectableOrder; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="gap-0 pb-[26px] sm:max-w-[560px]">{open ? <CorrectionForm order={order} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function CorrectionForm({ order, onClose }: { order: CorrectableOrder; onClose: () => void }) {
  const router = useRouter();
  const lines = correctableLines(order);
  const [rates, setRates] = useState(() => Object.fromEntries(lines.map((line) => [line.id, String(line.rateCny)])));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ lines?: string; reason?: string }>({});
  const [pending, setPending] = useState(false);
  // The API's 409 while a protected final landed cost needs the Management approval's reason (owner review 2026-11-23).
  const [approval, setApproval] = useState<string | null>(null);
  const money = (value: number) => formatMoney(value, order.currency, { decimals: 2 });
  const changed = lines
    .filter((line) => rates[line.id]!.trim() !== "" && Math.round(parseNumber(rates[line.id]!) * 10_000) !== Math.round(line.rateCny * 10_000))
    .map((line) => ({ id: line.id, rateCny: parseNumber(rates[line.id]!), line }));
  const change = Math.round(changed.reduce((sum, entry) => sum + entry.line.received * (entry.rateCny - entry.line.rateCny), 0) * 100) / 100;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const problems: { lines?: string; reason?: string } = {};
    if (lines.some((line) => rates[line.id]!.trim() === "" || !(parseNumber(rates[line.id]!) >= 0))) problems.lines = RATE_CORRECTION_TEXT.rate;
    else if (changed.length === 0) problems.lines = RATE_CORRECTION_TEXT.unchanged;
    if (!reason.trim()) problems.reason = RATE_CORRECTION_TEXT.reason;
    setErrors(problems);
    if (problems.lines || problems.reason) return;
    await send();
  }

  async function send(approvalReason?: string) {
    setPending(true);
    try {
      const response = await apiClient.post<Response>(`/orders/${encodeURIComponent(order.po)}/rate-corrections`, {
        lines: changed.map(({ id, rateCny }) => ({ id, rateCny })),
        reason: reason.trim(),
        ...(approvalReason ? { finalSettlementApproval: { reason: approvalReason } } : {}),
      });
      setApproval(null);
      const { ledger } = response;
      notifySuccess(
        [RATE_CORRECTION_TEXT.saved(ledger.balanceBefore, ledger.balanceAfter, ledger.currency), ledger.finalOrders.length ? RATE_CORRECTION_TEXT.final(ledger.finalOrders) : null].filter(Boolean).join(" "),
      );
      onClose();
      router.refresh();
    } catch (error) {
      const final = needsFinalApproval(error);
      if (final && !approvalReason) return setApproval(final);
      const fields = handleApiError(error) ?? {};
      setErrors({ lines: fields.lines, reason: fields.reason });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form noValidate onSubmit={submit}>
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[26px]">{RATE_CORRECTION_TEXT.title}</DialogTitle>
          <DialogDescription className="text-sm leading-5">{RATE_CORRECTION_TEXT.description}</DialogDescription>
        </DialogHeader>
        <Field className="mt-4 gap-[5px]" data-invalid={!!errors.lines}>
          <ul className="flex flex-col gap-2.5">
            {lines.map((line) => (
              <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-3">
                <span className="text-sm leading-5">
                  <span className="font-bold">{line.item.name}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {formatNumber(line.received)} {line.unit} received · now {money(line.rateCny)}
                  </span>
                </span>
                <Input
                  aria-label={`Rate, ${line.item.name}`}
                  inputMode="decimal"
                  className="text-right"
                  aria-invalid={!!errors.lines}
                  value={rates[line.id]}
                  onChange={(event) => {
                    setRates({ ...rates, [line.id]: event.target.value });
                    setErrors({ ...errors, lines: undefined });
                  }}
                />
              </li>
            ))}
          </ul>
          <FieldError errors={errors.lines ? [{ message: errors.lines }] : []} />
        </Field>
        <p className="mt-3 text-sm leading-5" aria-live="polite">
          {changed.length === 0
            ? "No rate changed yet."
            : change === 0
              ? "No change on the supplier's account."
              : `${change > 0 ? "More" : "Less"} payable to the supplier by ${money(Math.abs(change))}.`}
        </p>
        <Field className="mt-4 gap-[5px]" data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="rate-correction-reason" className="gap-0.5 text-[12.5px] leading-[15px] font-bold text-label">
            Reason <RequiredMark />
          </FieldLabel>
          <Textarea
            id="rate-correction-reason"
            required
            maxLength={500}
            className="min-h-[70px] text-sm"
            aria-invalid={!!errors.reason}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setErrors({ ...errors, reason: undefined });
            }}
          />
          <FieldError errors={errors.reason ? [{ message: errors.reason }] : []} />
        </Field>
        <DialogFooter className="mt-5 pt-4">
          <Button type="button" variant="outline" className={cn(dialogFooterButtonClass, "border-input")} onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" className={dialogFooterButtonClass} disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Save correction"}
          </Button>
        </DialogFooter>
      </form>
      {/* Outside the form: React bubbles a portal's submit to its React parents. */}
      <FinalApprovalDialog message={approval} onCancel={() => setApproval(null)} onApprove={(approvalReason) => send(approvalReason)} />
    </>
  );
}
