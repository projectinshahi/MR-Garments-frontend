"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Callout } from "@/components/shared/cards";
import { dialogFooterButtonClass } from "@/components/shared/confirm-dialog";
import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { balanceText, round2 } from "@/features/payments/money";
import { toNumber } from "@/features/payments/record-payment-form";
import { apiClient } from "@/lib/api/client";
import type { CreateAdjustmentBody, CreateAdjustmentResponse } from "@/lib/api/ledger-types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { currencySymbol, rateText } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/domain";

// Management adjustment (LED-3, D13, payments Full): a signed correction of one supplier account with a reason. It is
// not a supplier payment. The sign is chosen explicitly (increase or decrease), the idempotency key is made once per
// opened dialog, and the API's balance before and after is shown once it is saved. Proposed wording.

export const ADJUSTMENT_NOTICE = "An adjustment changes the supplier's account balance. It is not a supplier payment.";
export const ADJUSTMENT_MESSAGES = {
  direction: "Choose increase or decrease.",
  amount: "Enter an amount above 0, with at most 2 decimals.",
  currency: "Choose one of this supplier's currencies.",
  entryDate: "Enter the date of the adjustment.",
  future: "The date can't be in the future.",
  rateInr: "Enter an INR rate above 0.",
  reason: "Enter the reason for the adjustment.",
  reasonTooLong: "Use 1,000 characters or fewer for the reason.",
};
const M = ADJUSTMENT_MESSAGES;

export const adjustmentSchema = (today: string, options: Currency[], currency: Currency) =>
  z.object({
    // Typed as text (it starts ""); no radio chosen reads as null. Either is refused with the message.
    direction: z.custom<string>().pipe(z.enum(["increase", "decrease"], { error: M.direction })),
    amount: z
      .string()
      .refine((text) => /^\d{1,12}(\.\d{1,2})?$/.test(text.replace(/,/g, "").trim()), M.amount)
      .transform(toNumber)
      .pipe(z.number().gt(0, M.amount)),
    currency: z.string().refine((code) => options.includes(code), M.currency),
    entryDate: z.iso.date({ error: M.entryDate }).refine((day) => day <= today, M.future),
    rateInr: currency === "INR" ? z.string().transform(() => undefined) : z.string().transform(toNumber).pipe(z.number({ error: M.rateInr }).min(0.0001, M.rateInr).max(99_999_999, M.rateInr)),
    reason: z.string().trim().min(1, M.reason).max(1000, M.reasonTooLong),
  });
export type AdjustmentInput = z.input<ReturnType<typeof adjustmentSchema>>;
export type AdjustmentValues = z.output<ReturnType<typeof adjustmentSchema>>;

/** The LED-3 body: a decrease is sent negative; INR takes no rate. */
export const toAdjustmentBody = ({ direction, amount, currency, entryDate, rateInr, reason }: AdjustmentValues, idempotencyKey: string): CreateAdjustmentBody => ({
  currency,
  amount: direction === "decrease" ? -amount : amount,
  entryDate,
  ...(rateInr === undefined ? {} : { rateInr }),
  reason,
  idempotencyKey,
});

export type AdjustmentSupplier = { id: string; name: string; currency: Currency; exchangeRate: number | null; currencyOptions: Currency[]; balances: { currency: Currency; balanceCny: number }[] };

const rateFor = (supplier: AdjustmentSupplier, currency: Currency) => (currency === "INR" || currency !== supplier.currency || supplier.exchangeRate === null ? "" : String(supplier.exchangeRate));
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";

export function AdjustmentDialog({ supplier, children }: { supplier: AdjustmentSupplier; children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <AdjustmentForm supplier={supplier} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Inside DialogContent, which unmounts on close: a new open starts empty with a new idempotency key.
function AdjustmentForm({ supplier, onClose }: { supplier: AdjustmentSupplier; onClose: () => void }) {
  const router = useRouter();
  const [today] = useState(() => todayInIndia());
  const [key] = useState(() => crypto.randomUUID());
  const [done, setDone] = useState<CreateAdjustmentResponse | null>(null);
  const first = supplier.currencyOptions.includes(supplier.currency) ? supplier.currency : (supplier.currencyOptions[0] ?? "");
  const { register, handleSubmit, setError, setValue, getValues, control, formState } = useForm<AdjustmentInput, unknown, AdjustmentValues>({
    resolver: (values, context, options) => zodResolver(adjustmentSchema(today, supplier.currencyOptions, values.currency))(values, context, options),
    defaultValues: { direction: "", amount: "", currency: first, entryDate: today, rateInr: rateFor(supplier, first), reason: "" },
  });
  const { errors } = formState;
  const [direction, amount, currency] = useWatch({ control, name: ["direction", "amount", "currency"] });
  const symbol = currencySymbol(currency || "CNY");
  const now = supplier.balances.find((b) => b.currency === currency)?.balanceCny ?? 0;
  const typed = toNumber(amount);
  const change = Number.isFinite(typed) && direction ? (direction === "decrease" ? -typed : typed) : 0;

  async function save(values: AdjustmentValues) {
    let response: CreateAdjustmentResponse;
    try {
      response = await apiClient.post<CreateAdjustmentResponse>(`/suppliers/${encodeURIComponent(supplier.id)}/ledger/adjustments`, toAdjustmentBody(values, key));
    } catch (error) {
      Object.entries(handleApiError(error) ?? {}).forEach(([field, message], index) => {
        if (field === "amount" || field === "currency" || field === "entryDate" || field === "rateInr" || field === "reason") setError(field, { message }, { shouldFocus: index === 0 });
        else notifyError(message);
      });
      return;
    }
    setDone(response);
    notifySuccess("Adjustment recorded");
    router.refresh();
  }

  if (done) {
    const c = done.entry.currency;
    return (
      <>
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[26px]">Adjustment recorded</DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {supplier.name}&apos;s {c} account: {balanceText(done.balanceBefore, c)} before, {balanceText(done.balanceAfter, c)} after.
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
    <form noValidate onSubmit={handleSubmit(save)}>
      <DialogHeader className="gap-[7px]">
        <DialogTitle className="text-[21px] leading-[19px]">Adjust {supplier.name}&apos;s account</DialogTitle>
        <DialogDescription className="text-sm leading-5">A Management correction of one currency account, with the reason.</DialogDescription>
      </DialogHeader>
      <Callout tone="warning" size="sm" role="note" className="mt-3.5">
        {ADJUSTMENT_NOTICE}
      </Callout>
      <div className="mt-[14px] grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        <fieldset className="flex flex-col gap-[5px] sm:col-span-2" aria-invalid={!!errors.direction}>
          <legend className="text-[12.5px] leading-[15px] font-bold text-label">
            Direction <RequiredMark />
          </legend>
          <div className="mt-[5px] flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" value="increase" {...register("direction")} />
              Increase (more available with supplier)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="decrease" {...register("direction")} />
              Decrease (more payable to supplier)
            </label>
          </div>
          <FieldError errors={[errors.direction]} />
        </fieldset>
        <Field className="gap-[5px]" data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="adjustment-amount" className={labelClass}>
            Amount ({symbol}) <RequiredMark />
          </FieldLabel>
          <Input id="adjustment-amount" required inputMode="decimal" size="sm" aria-invalid={!!errors.amount} {...register("amount")} />
          <FieldError errors={[errors.amount]} />
        </Field>
        <Field className="gap-[5px]" data-invalid={!!errors.currency}>
          <FieldLabel htmlFor="adjustment-currency" className={labelClass}>
            Currency <RequiredMark />
          </FieldLabel>
          <NativeSelect
            size="sm"
            id="adjustment-currency"
            required
            aria-invalid={!!errors.currency}
            {...register("currency", {
              onChange: (event: { target: { value: string } }) => {
                const rate = getValues("rateInr");
                if (rate === "" || rate === rateFor(supplier, currency)) setValue("rateInr", rateFor(supplier, event.target.value));
              },
            })}
          >
            {supplier.currencyOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.currency]} />
        </Field>
        <Field className="gap-[5px]" data-invalid={!!errors.entryDate}>
          <FieldLabel htmlFor="adjustment-date" className={labelClass}>
            Date <RequiredMark />
          </FieldLabel>
          <Input id="adjustment-date" required type="date" max={today} size="sm" aria-invalid={!!errors.entryDate} {...register("entryDate")} />
          <FieldError errors={[errors.entryDate]} />
        </Field>
        {currency === "INR" ? null : (
          <Field className="gap-[5px]" data-invalid={!!errors.rateInr}>
            <FieldLabel htmlFor="adjustment-rate" className={labelClass}>
              Rate (₹ per {symbol}) <RequiredMark />
            </FieldLabel>
            <Input id="adjustment-rate" required inputMode="decimal" size="sm" aria-invalid={!!errors.rateInr} {...register("rateInr")} />
            <FieldDescription className="text-xs">
              {currency === supplier.currency && supplier.exchangeRate !== null ? `Supplier rate now: ${rateText(currency, supplier.exchangeRate)}.` : `No saved rate for ${currency}: enter one.`}
            </FieldDescription>
            <FieldError errors={[errors.rateInr]} />
          </Field>
        )}
        <Field className="gap-[5px] sm:col-span-2" data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="adjustment-reason" className={labelClass}>
            Reason <RequiredMark />
          </FieldLabel>
          <Textarea id="adjustment-reason" required maxLength={1000} className="min-h-[60px] text-sm" aria-invalid={!!errors.reason} {...register("reason")} />
          <FieldError errors={[errors.reason]} />
        </Field>
      </div>
      {currency ? (
        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-dashed pt-[7px]">
          <span className="text-[13px] leading-5 text-muted-foreground">Balance ({currency})</span>
          <output aria-label="Balance now and after" className="text-[13.5px] leading-5 font-bold">
            {balanceText(now, currency)} → {balanceText(round2(now + change), currency)}
          </output>
        </div>
      ) : null}
      <DialogFooter className="mt-5 pt-4">
        <Button type="button" variant="outline" className={cn(dialogFooterButtonClass, "border-input")} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className={dialogFooterButtonClass} disabled={formState.isSubmitting || supplier.currencyOptions.length === 0}>
          Record adjustment
        </Button>
      </DialogFooter>
    </form>
  );
}
