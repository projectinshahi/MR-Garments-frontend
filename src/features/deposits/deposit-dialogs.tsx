"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type FieldValues, type Path, useForm, type UseFormSetError, useWatch } from "react-hook-form";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import type { CreateDepositTransactionResponse, CreateSupplierDepositResponse, SupplierDepositRow } from "@/lib/api/deposits-types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { CURRENCY_SYMBOL, currencyLabel } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";
import { type Currency, CURRENCIES } from "@/types/domain";

import {
  emptyDeposit,
  emptySettlement,
  type NewDepositInput,
  type NewDepositValues,
  newDepositSchema,
  type SettlementInput,
  type SettlementValues,
  settlementSchema,
  toCreateDepositBody,
  toSettlementBody,
} from "./deposit-forms";
import { amountText } from "./deposits-logic";

// No reference design: built like Record payment (features/payments/record-payment-dialog.tsx). Records only.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const footerButtonClass = "h-[42px] px-[17px]";

/** 422: each message under its field, the first focused; a message for a field the form doesn't have is toasted. */
function showFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, fields: Record<string, string> | undefined, known: string[]) {
  Object.entries(fields ?? {}).forEach(([key, message], index) => {
    if (known.includes(key)) setError(key as Path<T>, { message }, { shouldFocus: index === 0 });
    else notifyError(message);
  });
}

function Footer({ label, pending, onCancel }: { label: string; pending: boolean; onCancel: () => void }) {
  return (
    <DialogFooter className="mt-5 pt-4">
      <Button type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" className={footerButtonClass} disabled={pending}>
        {label}
      </Button>
    </DialogFooter>
  );
}

/** Reference and Notes, optional on both forms. */
function Extras({ id, errors, register }: { id: string; errors: { reference?: { message?: string }; notes?: { message?: string } }; register: (name: "reference" | "notes") => object }) {
  return (
    <>
      <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.reference}>
        <FieldLabel htmlFor={`${id}-reference`} className={labelClass}>
          Reference
        </FieldLabel>
        <Input id={`${id}-reference`} maxLength={100} size="sm" placeholder="Transaction or receipt number" aria-invalid={!!errors.reference} {...register("reference")} />
        <FieldError errors={[errors.reference]} />
      </Field>
      <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.notes}>
        <FieldLabel htmlFor={`${id}-notes`} className={labelClass}>
          Notes
        </FieldLabel>
        <Textarea id={`${id}-notes`} maxLength={1000} className="min-h-[60px] text-sm" aria-invalid={!!errors.notes} {...register("notes")} />
        <FieldError errors={[errors.notes]} />
      </Field>
    </>
  );
}

export type StatementSupplier = { id: string; name: string; currency: Currency };

/** "+ New deposit" (SD-2): a deposit agreed with the supplier, to give or to receive, in its currency (the supplier's by default). */
export function NewDepositDialog({ supplier, children }: { supplier: StatementSupplier; children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">New deposit for {supplier.name}</DialogTitle>
          <DialogDescription className="text-sm leading-5">A deposit agreed with the supplier: one to give (you owe it) or to receive (the supplier owes it).</DialogDescription>
        </DialogHeader>
        <NewDepositForm
          supplier={supplier}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            notifySuccess("Deposit opened");
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// Rendered inside DialogContent, which unmounts on close, so the form opens empty every time.
function NewDepositForm({ supplier, onCancel, onSaved }: { supplier: StatementSupplier; onCancel: () => void; onSaved: () => void }) {
  const [today] = useState(() => todayInIndia());
  const form = useForm<NewDepositInput, unknown, NewDepositValues>({
    resolver: zodResolver(newDepositSchema(today)),
    defaultValues: emptyDeposit(supplier.currency, today),
  });
  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;
  const currency = useWatch({ control, name: "currency" }) as Currency;

  async function save(values: NewDepositValues) {
    try {
      await apiClient.post<CreateSupplierDepositResponse>(`/suppliers/${encodeURIComponent(supplier.id)}/deposits`, toCreateDepositBody(values));
    } catch (error) {
      showFieldErrors(form.setError, handleApiError(error), ["direction", "amount", "currency", "openedOn", "reference", "notes"]);
      return;
    }
    onSaved();
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        <Field className={fieldClass} data-invalid={!!errors.direction}>
          <FieldLabel htmlFor="deposit-direction" className={labelClass}>
            Direction <RequiredMark />
          </FieldLabel>
          <NativeSelect size="sm" id="deposit-direction" required aria-invalid={!!errors.direction} {...register("direction")}>
            <option value="">Select direction</option>
            <option value="give">Give (we owe the supplier)</option>
            <option value="receive">Receive (the supplier owes us)</option>
          </NativeSelect>
          <FieldError errors={[errors.direction]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.currency}>
          <FieldLabel htmlFor="deposit-currency" className={labelClass}>
            Currency <RequiredMark />
          </FieldLabel>
          <NativeSelect size="sm" id="deposit-currency" required aria-invalid={!!errors.currency} {...register("currency")}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabel(code)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.currency]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="deposit-amount" className={labelClass}>
            Amount ({CURRENCY_SYMBOL[currency] ?? CURRENCY_SYMBOL[supplier.currency]}) <RequiredMark />
          </FieldLabel>
          <Input id="deposit-amount" required inputMode="decimal" size="sm" aria-invalid={!!errors.amount} {...register("amount")} />
          <FieldError errors={[errors.amount]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.openedOn}>
          <FieldLabel htmlFor="deposit-opened-on" className={labelClass}>
            Agreed on <RequiredMark />
          </FieldLabel>
          <Input id="deposit-opened-on" required type="date" max={today} size="sm" aria-invalid={!!errors.openedOn} {...register("openedOn")} />
          <FieldError errors={[errors.openedOn]} />
        </Field>
        <Extras id="deposit" errors={errors} register={register} />
      </div>
      <Footer label="Open deposit" pending={formState.isSubmitting} onCancel={onCancel} />
    </form>
  );
}

/** "Record payment" (give) or "Record receipt" (receive) against an open deposit (SD-3), prefilled with what is pending. */
export function SettleDepositDialog({ deposit, children }: { deposit: SupplierDepositRow; children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const payment = deposit.direction === "give";
  const noun = payment ? "payment" : "receipt";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">Record {noun}</DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {payment ? "A payment already made to" : "An amount already received from"} {deposit.supplier} against the deposit of {amountText(deposit.amount, deposit.currency)};{" "}
            {amountText(deposit.pending, deposit.currency)} is pending.
          </DialogDescription>
        </DialogHeader>
        <SettleDepositForm
          deposit={deposit}
          noun={noun}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            notifySuccess(payment ? "Payment recorded" : "Receipt recorded");
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function SettleDepositForm({ deposit, noun, onCancel, onSaved }: { deposit: SupplierDepositRow; noun: string; onCancel: () => void; onSaved: () => void }) {
  const [today] = useState(() => todayInIndia());
  const form = useForm<SettlementInput, unknown, SettlementValues>({
    resolver: zodResolver(settlementSchema(today)),
    defaultValues: emptySettlement(deposit.pending, today),
  });
  const { register, handleSubmit, formState } = form;
  const { errors } = formState;

  async function save(values: SettlementValues) {
    try {
      await apiClient.post<CreateDepositTransactionResponse>(`/supplier-deposits/${encodeURIComponent(deposit.id)}/transactions`, toSettlementBody(values));
    } catch (error) {
      showFieldErrors(form.setError, handleApiError(error), ["paidOn", "amount", "mode", "reference", "notes"]);
      return;
    }
    onSaved();
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        <Field className={fieldClass} data-invalid={!!errors.paidOn}>
          <FieldLabel htmlFor="settle-paid-on" className={labelClass}>
            {noun === "payment" ? "Paid on" : "Received on"} <RequiredMark />
          </FieldLabel>
          <Input id="settle-paid-on" required type="date" max={today} size="sm" aria-invalid={!!errors.paidOn} {...register("paidOn")} />
          <FieldError errors={[errors.paidOn]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="settle-amount" className={labelClass}>
            Amount ({CURRENCY_SYMBOL[deposit.currency]}) <RequiredMark />
          </FieldLabel>
          <Input id="settle-amount" required inputMode="decimal" size="sm" aria-invalid={!!errors.amount} {...register("amount")} />
          <FieldError errors={[errors.amount]} />
        </Field>
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.mode}>
          <FieldLabel htmlFor="settle-mode" className={labelClass}>
            Mode <RequiredMark />
          </FieldLabel>
          <Input id="settle-mode" required maxLength={100} size="sm" placeholder="Bank transfer, cash…" aria-invalid={!!errors.mode} {...register("mode")} />
          <FieldError errors={[errors.mode]} />
        </Field>
        <Extras id="settle" errors={errors} register={register} />
      </div>
      <Footer label={`Record ${noun}`} pending={formState.isSubmitting} onCancel={onCancel} />
    </form>
  );
}
