"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { CreatePaymentResponse, OrderOptions } from "@/lib/api/types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { formatINR } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";

import {
  emptyPayment,
  FORM_FIELD,
  paymentINR,
  recordPaymentSchema,
  SUPPLIER_PAYEE,
  toCreatePaymentBody,
  type RecordPaymentInput,
  type RecordPaymentValues,
} from "./record-payment-form";

// No reference design: built like Add supplier (53) with the New order deposit fields (15).
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const footerButtonClass = "h-[42px] px-[17px]";

export type OrderChoice = { orderId: string; po: string; supplier: string };

type RecordPaymentDialogProps = {
  /** The orders to choose from (PAY-1). With `fixed`, the one order given is preselected and can't be changed. */
  orders: OrderChoice[];
  fixed?: boolean;
  /** Active shipping agents (ORD-2), the other kind of payee. */
  agents: OrderOptions["agents"];
  /** The button that opens the dialog. */
  children: React.ReactElement;
};

/** Records a payment already made (PAY-2). Records only: nothing here moves money. */
export function RecordPaymentDialog({ orders, fixed = false, agents, children }: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">{fixed ? `Record payment for ${orders[0]?.po}` : "Record payment"}</DialogTitle>
          <DialogDescription className="text-sm leading-5">Record a payment already made against an order.</DialogDescription>
        </DialogHeader>
        <RecordPaymentForm
          orders={orders}
          fixed={fixed}
          agents={agents}
          onCancel={() => setOpen(false)}
          onSaved={(po) => {
            notifySuccess(`Payment recorded for ${po}`);
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// Rendered inside DialogContent, which unmounts on close, so the form opens empty every time.
function RecordPaymentForm({
  orders,
  fixed,
  agents,
  onCancel,
  onSaved,
}: {
  orders: OrderChoice[];
  fixed: boolean;
  agents: OrderOptions["agents"];
  onCancel: () => void;
  onSaved: (po: string) => void;
}) {
  const [today] = useState(() => todayInIndia());
  const { register, handleSubmit, setError, control, formState } = useForm<RecordPaymentInput, unknown, RecordPaymentValues>({
    resolver: zodResolver(recordPaymentSchema(today)),
    defaultValues: emptyPayment(fixed ? orders[0]!.orderId : "", today),
  });
  const { errors } = formState;
  const [orderId, amountCny, rateInr] = useWatch({ control, name: ["orderId", "amountCny", "rateInr"] });
  const order = orders.find((o) => o.orderId === orderId);

  async function save(values: RecordPaymentValues) {
    try {
      await apiClient.post<CreatePaymentResponse>("/payments", toCreatePaymentBody(values));
    } catch (error) {
      // 422: each message under its field, the first focused. A message for a field the form doesn't have is toasted.
      Object.entries(handleApiError(error) ?? {}).forEach(([key, message], index) => {
        const field = FORM_FIELD[key];
        if (field) setError(field, { message }, { shouldFocus: index === 0 });
        else notifyError(message);
      });
      return;
    }
    onSaved(orders.find((o) => o.orderId === values.orderId)?.po ?? "");
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.orderId}>
          <FieldLabel htmlFor="payment-order" className={labelClass}>
            Order <RequiredMark />
          </FieldLabel>
          {fixed ? (
            <Input id="payment-order" readOnly size="sm" value={`${orders[0]!.po} · ${orders[0]!.supplier}`} aria-invalid={!!errors.orderId} />
          ) : (
            <NativeSelect size="sm" id="payment-order" required aria-invalid={!!errors.orderId} {...register("orderId")}>
              <option value="">Select order</option>
              {orders.map((o) => (
                <option key={o.orderId} value={o.orderId}>
                  {o.po} · {o.supplier}
                </option>
              ))}
            </NativeSelect>
          )}
          <FieldError errors={[errors.orderId]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.kind}>
          <FieldLabel htmlFor="payment-kind" className={labelClass}>
            Kind <RequiredMark />
          </FieldLabel>
          <NativeSelect size="sm" id="payment-kind" required aria-invalid={!!errors.kind} {...register("kind")}>
            <option value="">Select kind</option>
            <option value="Deposit">Deposit</option>
            <option value="Balance">Balance</option>
          </NativeSelect>
          <FieldError errors={[errors.kind]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.payee}>
          <FieldLabel htmlFor="payment-payee" className={labelClass}>
            Paid to <RequiredMark />
          </FieldLabel>
          <NativeSelect size="sm" id="payment-payee" required aria-invalid={!!errors.payee} {...register("payee")}>
            <option value={SUPPLIER_PAYEE}>{order ? `${order.supplier} (supplier)` : "The order's supplier"}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} (agent)
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.payee]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.amountCny}>
          <FieldLabel htmlFor="payment-amount" className={labelClass}>
            Amount (¥) <RequiredMark />
          </FieldLabel>
          <Input id="payment-amount" required inputMode="decimal" placeholder="¥" size="sm" aria-invalid={!!errors.amountCny} {...register("amountCny")} />
          <FieldError errors={[errors.amountCny]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.paidOn}>
          <FieldLabel htmlFor="payment-paid-on" className={labelClass}>
            Paid on <RequiredMark />
          </FieldLabel>
          <Input id="payment-paid-on" required type="date" max={today} size="sm" aria-invalid={!!errors.paidOn} {...register("paidOn")} />
          <FieldError errors={[errors.paidOn]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.rateInr}>
          <FieldLabel htmlFor="payment-rate" className={labelClass}>
            Rate (₹ per ¥) <RequiredMark />
          </FieldLabel>
          <Input id="payment-rate" required inputMode="decimal" size="sm" aria-invalid={!!errors.rateInr} {...register("rateInr")} />
          <FieldError errors={[errors.rateInr]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.mode}>
          <FieldLabel htmlFor="payment-mode" className={labelClass}>
            Mode <RequiredMark />
          </FieldLabel>
          <Input id="payment-mode" required maxLength={100} size="sm" aria-invalid={!!errors.mode} {...register("mode")} />
          <FieldError errors={[errors.mode]} />
        </Field>
      </div>
      <div className="mt-[14px] flex items-center justify-between gap-4 border-t border-dashed pt-[7px]">
        <span className="text-[13px] leading-5 text-muted-foreground">Amount in INR</span>
        <output htmlFor="payment-amount payment-rate" className="text-[15px] leading-5 font-bold">
          {formatINR(paymentINR(amountCny, rateInr))}
        </output>
      </div>
      <DialogFooter className="mt-5 pt-4">
        <Button type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className={footerButtonClass} disabled={formState.isSubmitting}>
          Record payment
        </Button>
      </DialogFooter>
    </form>
  );
}
