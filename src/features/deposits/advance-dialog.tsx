"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DeleteRecordButton, RecordFacts } from "@/features/order-detail/shared/delete-record";
import { paymentINR } from "@/features/payments/record-payment-form";
import { apiClient } from "@/lib/api/client";
import type { AdvanceEntry, SupplierAdvanceResponse } from "@/lib/api/deposits-types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { currencyLabel, currencySymbol, formatDate, formatINR, rateText } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";

import { advanceSchema, type AdvanceInput, type AdvanceValues, emptyAdvance, toAdvanceBody } from "./advance-form";
import { amountText } from "./deposits-logic";

// Add advance (ADV-2) and Delete advance (ADV-3), built like Record payment and the deposit dialogs. A record of money
// the client already paid the supplier; orders draw on it automatically, so no order is chosen here.

const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const footerButtonClass = "h-[42px] px-[17px]";
const FIELDS = ["amount", "paidOn", "rateInr", "mode", "reference", "notes"] as const;

type Supplier = SupplierAdvanceResponse["supplier"];

export function AddAdvanceDialog({ supplier, children }: { supplier: Supplier; children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">Add advance for {supplier.name}</DialogTitle>
          <DialogDescription className="text-sm leading-5">
            Money already paid to the supplier before any order. New orders for this supplier use it automatically; an existing order takes it
            when you apply it.
          </DialogDescription>
        </DialogHeader>
        <AdvanceForm
          supplier={supplier}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            notifySuccess("Advance added");
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// Rendered inside DialogContent, which unmounts on close, so the form opens fresh every time.
export function AdvanceForm({ supplier, onCancel, onSaved }: { supplier: Supplier; onCancel: () => void; onSaved: () => void }) {
  const [today] = useState(() => todayInIndia());
  const inr = supplier.currency === "INR";
  const form = useForm<AdvanceInput, unknown, AdvanceValues>({
    resolver: zodResolver(advanceSchema(today, supplier.currency)),
    defaultValues: emptyAdvance(today, inr ? null : supplier.exchangeRate),
  });
  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;
  const [amount, rateInr] = useWatch({ control, name: ["amount", "rateInr"] });
  const symbol = currencySymbol(supplier.currency);

  async function save(values: AdvanceValues) {
    try {
      await apiClient.post(`/suppliers/${encodeURIComponent(supplier.id)}/advances`, toAdvanceBody(values));
    } catch (error) {
      Object.entries(handleApiError(error) ?? {}).forEach(([key, message], index) => {
        if ((FIELDS as readonly string[]).includes(key)) form.setError(key as (typeof FIELDS)[number], { message }, { shouldFocus: index === 0 });
        else notifyError(message);
      });
      return;
    }
    onSaved();
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        <Field className={fieldClass}>
          <FieldLabel htmlFor="advance-currency" className={labelClass}>
            Currency
          </FieldLabel>
          {/* The supplier's (docs/supplier-currency.md): shown, not chosen. */}
          <Input id="advance-currency" readOnly value={currencyLabel(supplier.currency)} size="sm" />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="advance-amount" className={labelClass}>
            Amount ({symbol}) <RequiredMark />
          </FieldLabel>
          <Input id="advance-amount" required inputMode="decimal" size="sm" aria-invalid={!!errors.amount} {...register("amount")} />
          <FieldError errors={[errors.amount]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.paidOn}>
          <FieldLabel htmlFor="advance-paid-on" className={labelClass}>
            Paid on <RequiredMark />
          </FieldLabel>
          <Input id="advance-paid-on" required type="date" max={today} size="sm" aria-invalid={!!errors.paidOn} {...register("paidOn")} />
          <FieldError errors={[errors.paidOn]} />
        </Field>
        {inr ? null : (
          <Field className={fieldClass} data-invalid={!!errors.rateInr}>
            <FieldLabel htmlFor="advance-rate" className={labelClass}>
              Rate (₹ per {symbol}) <RequiredMark />
            </FieldLabel>
            <Input id="advance-rate" required inputMode="decimal" size="sm" aria-invalid={!!errors.rateInr} {...register("rateInr")} />
            <FieldDescription className="text-xs">
              {supplier.exchangeRate != null
                ? `Supplier rate now: ${rateText(supplier.currency, supplier.exchangeRate)}. Change it if this advance used another.`
                : "No rate set on the supplier: enter this advance's."}
            </FieldDescription>
            <FieldError errors={[errors.rateInr]} />
          </Field>
        )}
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.mode}>
          <FieldLabel htmlFor="advance-mode" className={labelClass}>
            Payment mode <RequiredMark />
          </FieldLabel>
          <Input id="advance-mode" required maxLength={100} size="sm" placeholder="Bank transfer, cash…" aria-invalid={!!errors.mode} {...register("mode")} />
          <FieldError errors={[errors.mode]} />
        </Field>
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.reference}>
          <FieldLabel htmlFor="advance-reference" className={labelClass}>
            Reference
          </FieldLabel>
          <Input id="advance-reference" maxLength={100} size="sm" placeholder="Transaction or receipt number" aria-invalid={!!errors.reference} {...register("reference")} />
          <FieldError errors={[errors.reference]} />
        </Field>
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="advance-notes" className={labelClass}>
            Notes
          </FieldLabel>
          <Textarea id="advance-notes" maxLength={1000} className="min-h-[60px] text-sm" aria-invalid={!!errors.notes} {...register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        In INR: <span className="font-bold text-foreground">{formatINR(paymentINR(amount, inr ? "1" : rateInr))}</span>
      </p>
      <DialogFooter className="mt-5 pt-4">
        <Button type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className={footerButtonClass} disabled={formState.isSubmitting}>
          Add advance
        </Button>
      </DialogFooter>
    </form>
  );
}

/** ADV-3 (payments Full): a receipt nothing has drawn on. One already applied opens the "can't delete" explanation. */
export function DeleteAdvanceButton({ entry, supplier, used }: { entry: AdvanceEntry; supplier: string; used: boolean }) {
  const money = (value: number) => amountText(value, entry.currency);
  return (
    <DeleteRecordButton
      path={`/supplier-advances/${entry.id}`}
      noun="advance"
      label={`Delete advance of ${formatDate(entry.entryDate)}, ${money(entry.amount)}`}
      title="Delete Advance?"
      refused={used ? <p>Orders have already used this advance, so it can&apos;t be deleted. Order allocations stay as the orders&apos; history.</p> : undefined}
      description={
        <>
          <p>
            Are you sure you want to delete this advance paid to <strong className="text-foreground">{supplier}</strong>? This can&apos;t be undone.
          </p>
          <RecordFacts
            facts={[
              ["Paid on", formatDate(entry.entryDate)],
              ["Amount", money(entry.amount)],
              ["Mode", entry.mode],
              ...(entry.reference ? [["Reference", entry.reference] satisfies [string, string]] : []),
            ]}
          />
          <p>No order has used it, so only the available advance goes down. Payments and supplier deposits are not involved.</p>
        </>
      }
    />
  );
}
