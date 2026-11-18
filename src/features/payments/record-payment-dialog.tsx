"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import type { AdvanceSupplierOption } from "@/lib/api/deposits-types";
import type { CreatePaymentResponse, OrderOptions } from "@/lib/api/types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { currencySymbol, formatINR, formatMoney, rateText } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/domain";

import {
  emptyPayment,
  FORM_FIELD,
  MESSAGES,
  paymentINR,
  recordPaymentSchema,
  SUPPLIER_PAYEE,
  toCreatePaymentBody,
  toSupplierAdvanceBody,
  type RecordPaymentInput,
  type RecordPaymentValues,
} from "./record-payment-form";

// No reference design: built like Add supplier (53) with the New order deposit fields (15).
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const footerButtonClass = "h-[42px] px-[17px]";

/** `currency`: the order's, which the payment is in; `supplierRate`: the supplier's rate now, the payment's default rate (null while not set). */
export type OrderChoice = { orderId: string; po: string; supplier: string; currency: Currency; supplierRate: number | null };
/** An active supplier a supplier advance (no order) can go to (ADV-5): its currency and its rate now (null while not set). */
export type SupplierChoice = AdvanceSupplierOption;
/** The money's currency and the supplier's rate now: the chosen order's or, without one, the chosen supplier's. */
type Source = Pick<OrderChoice, "currency" | "supplierRate">;
const sourceOf = (supplier: SupplierChoice | undefined): Source | undefined => supplier && { currency: supplier.currency, supplierRate: supplier.exchangeRate };
/** The rate a payment starts with: the supplier's rate now as text; "" for INR or a supplier without one. */
const defaultRate = (source: Source | undefined) => (!source || source.currency === "INR" || source.supplierRate === null ? "" : String(source.supplierRate));

type RecordPaymentDialogProps = {
  /** The orders to choose from (PAY-1). With `fixed`, the one order given is preselected and can't be changed. */
  orders: OrderChoice[];
  fixed?: boolean;
  /** Active shipping agents (ORD-2), the other kind of payee. */
  agents: OrderOptions["agents"];
  /**
   * Deposits & Payments only (not with `fixed`): the suppliers a supplier advance (no order) can go to. Given, the user
   * first chooses Order payment or Supplier advance; the advance is recorded as the chosen supplier's (ADV-2).
   */
  suppliers?: SupplierChoice[];
  /** The button that opens the dialog. */
  children: React.ReactElement;
};

/** Records a payment already made (PAY-2). Records only: nothing here moves money. */
export function RecordPaymentDialog({ orders, fixed = false, agents, suppliers = [], children }: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const chooseType = !fixed && suppliers.length > 0;
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">{fixed ? `Record payment for ${orders[0]?.po}` : "Record payment"}</DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {chooseType
              ? "Record a payment already made against an order, or a deposit without one as the supplier's advance."
              : "Record a payment already made against an order."}
          </DialogDescription>
        </DialogHeader>
        <RecordPaymentForm
          orders={orders}
          fixed={fixed}
          agents={agents}
          suppliers={chooseType ? suppliers : []}
          onCancel={() => setOpen(false)}
          onSaved={(message) => {
            notifySuccess(message);
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
  suppliers,
  onCancel,
  onSaved,
}: {
  orders: OrderChoice[];
  fixed: boolean;
  agents: OrderOptions["agents"];
  /** Not empty: the payment type is asked first (see RecordPaymentDialog). */
  suppliers: SupplierChoice[];
  onCancel: () => void;
  /** The success message: the payment's PO, and the supplier advance it gave back, if any. */
  onSaved: (message: string) => void;
}) {
  const [today] = useState(() => todayInIndia());
  // Deposits & Payments: the user first chooses Order payment or Supplier advance (no order); elsewhere it is always an order payment.
  const chooseType = suppliers.length > 0;
  const { register, handleSubmit, setError, setValue, control, formState } = useForm<RecordPaymentInput, unknown, RecordPaymentValues>({
    // Checked against the chosen order's currency (an INR order has no rate to check) or, for a supplier advance, the chosen supplier's.
    resolver: (values, context, options) => {
      const target = chooseType ? values.target : "order";
      // Nothing else is checked, and nothing is saved, until the payment type is chosen.
      if (target !== "order" && target !== "advance") return { values: {}, errors: { target: { type: "required", message: MESSAGES.target } } };
      const currency = target === "order" ? orders.find((o) => o.orderId === values.orderId)?.currency : suppliers.find((s) => s.id === values.supplierId)?.currency;
      return zodResolver(recordPaymentSchema(today, currency, target))(values, context, options);
    },
    // The supplier's rate now fills the rate (docs/supplier-currency.md); the user changes it when this payment used another.
    defaultValues: { ...emptyPayment(fixed ? orders[0]!.orderId : "", today), rateInr: fixed ? defaultRate(orders[0]) : "" },
  });
  const { errors } = formState;
  const [target, orderId, supplierId, amountCny, rateInr] = useWatch({ control, name: ["target", "orderId", "supplierId", "amountCny", "rateInr"] });
  /** "order", "advance", or "" while not chosen (only when the type is asked). */
  const type = chooseType ? target : "order";
  const order = orders.find((o) => o.orderId === orderId);
  const supplier = suppliers.find((s) => s.id === supplierId);
  const sourceFor = (next: string | undefined) => (next === "order" ? order : next === "advance" ? sourceOf(supplier) : undefined);
  const source = sourceFor(type);
  // Before an order (or supplier) is chosen the labels show yuan, as they always did.
  const symbol = currencySymbol(source?.currency ?? "CNY");
  const inr = source?.currency === "INR";
  /** A newly chosen type, order or supplier brings its rate now in place of the previous default, never over a rate the user typed. */
  const followRate = (next: Source | undefined) => {
    if (rateInr === "" || rateInr === defaultRate(source)) setValue("rateInr", defaultRate(next));
  };

  /** Posts the record and answers the success message. */
  async function post(values: RecordPaymentValues) {
    if (values.target === "advance") {
      // No order: one ADV-2 receipt on the supplier's advance (orders draw on it), never a payment record as well.
      await apiClient.post(`/suppliers/${encodeURIComponent(values.supplierId ?? "")}/advances`, toSupplierAdvanceBody(values));
      const name = suppliers.find((s) => s.id === values.supplierId)?.name ?? "the supplier";
      return `Deposit recorded as supplier advance for ${name}. New orders for this supplier use it automatically`;
    }
    const response = await apiClient.post<CreatePaymentResponse>("/payments", toCreatePaymentBody(values));
    const paid = orders.find((o) => o.orderId === values.orderId);
    // A supplier payment gives back the advance it now covers (backend docs/supplier-advance.md, PAY-2).
    const returned = -(response.advance?.changeCny ?? 0);
    return `Payment recorded for ${paid?.po ?? ""}${returned > 0 && paid ? `. ${formatMoney(returned, paid.currency, { decimals: 2 })} of supplier advance went back to the supplier's account` : ""}`;
  }

  async function save(values: RecordPaymentValues) {
    let saved: string;
    try {
      saved = await post(values);
    } catch (error) {
      // 422: each message under its field, the first focused. A message for a field the form doesn't have is toasted.
      Object.entries(handleApiError(error) ?? {}).forEach(([key, message], index) => {
        const field = FORM_FIELD[key];
        if (field) setError(field, { message }, { shouldFocus: index === 0 });
        else notifyError(message);
      });
      return;
    }
    onSaved(saved);
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        {chooseType ? (
          <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.target}>
            <FieldLabel htmlFor="payment-type" className={labelClass}>
              Payment type <RequiredMark />
            </FieldLabel>
            <NativeSelect
              size="sm"
              id="payment-type"
              required
              aria-invalid={!!errors.target}
              {...register("target", { onChange: (event: { target: { value: string } }) => followRate(sourceFor(event.target.value)) })}
            >
              <option value="">Select payment type</option>
              <option value="order">Order payment</option>
              <option value="advance">Supplier advance (no order)</option>
            </NativeSelect>
            {type === "advance" ? (
              <FieldDescription className="text-xs">
                Recorded as a deposit on the supplier&apos;s advance, not against an order. New orders for the supplier use it automatically; an
                open order takes it when applied from Deposits, Supplier advance.
              </FieldDescription>
            ) : null}
            <FieldError errors={[errors.target]} />
          </Field>
        ) : null}
        {type === "order" ? (
          <>
            <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.orderId}>
              <FieldLabel htmlFor="payment-order" className={labelClass}>
                Order <RequiredMark />
              </FieldLabel>
              {fixed ? (
                <Input id="payment-order" readOnly size="sm" value={`${orders[0]!.po} · ${orders[0]!.supplier}`} aria-invalid={!!errors.orderId} />
              ) : (
                <NativeSelect
                  size="sm"
                  id="payment-order"
                  required
                  aria-invalid={!!errors.orderId}
                  {...register("orderId", {
                    // The chosen order's supplier rate replaces the previous order's default, never a rate the user typed over it.
                    onChange: (event: { target: { value: string } }) => followRate(orders.find((o) => o.orderId === event.target.value)),
                  })}
                >
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
          </>
        ) : null}
        {type === "advance" ? (
          <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.supplierId}>
            <FieldLabel htmlFor="payment-supplier" className={labelClass}>
              Supplier <RequiredMark />
            </FieldLabel>
            <NativeSelect
              size="sm"
              id="payment-supplier"
              required
              aria-invalid={!!errors.supplierId}
              {...register("supplierId", {
                onChange: (event: { target: { value: string } }) => followRate(sourceOf(suppliers.find((s) => s.id === event.target.value))),
              })}
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currency})
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.supplierId]} />
          </Field>
        ) : null}
        {type === "order" || type === "advance" ? (
          <>
            <Field className={fieldClass} data-invalid={!!errors.amountCny}>
              <FieldLabel htmlFor="payment-amount" className={labelClass}>
                Amount ({symbol}) <RequiredMark />
              </FieldLabel>
              <Input id="payment-amount" required inputMode="decimal" placeholder={symbol} size="sm" aria-invalid={!!errors.amountCny} {...register("amountCny")} />
              <FieldError errors={[errors.amountCny]} />
            </Field>
            <Field className={fieldClass} data-invalid={!!errors.paidOn}>
              <FieldLabel htmlFor="payment-paid-on" className={labelClass}>
                Paid on <RequiredMark />
              </FieldLabel>
              <Input id="payment-paid-on" required type="date" max={today} size="sm" aria-invalid={!!errors.paidOn} {...register("paidOn")} />
              <FieldError errors={[errors.paidOn]} />
            </Field>
            {inr ? null : (
              <Field className={fieldClass} data-invalid={!!errors.rateInr}>
                <FieldLabel htmlFor="payment-rate" className={labelClass}>
                  Rate (₹ per {symbol}) <RequiredMark />
                </FieldLabel>
                <Input id="payment-rate" required inputMode="decimal" size="sm" aria-invalid={!!errors.rateInr} {...register("rateInr")} />
                <FieldDescription className="text-xs">
                  {source?.supplierRate != null ? `Supplier rate now: ${rateText(source.currency, source.supplierRate)}. Change it if this payment used another.` : "No rate set on the supplier: enter this payment's."}
                </FieldDescription>
                <FieldError errors={[errors.rateInr]} />
              </Field>
            )}
            <Field className={fieldClass} data-invalid={!!errors.mode}>
              <FieldLabel htmlFor="payment-mode" className={labelClass}>
                Mode <RequiredMark />
              </FieldLabel>
              <Input id="payment-mode" required maxLength={100} size="sm" aria-invalid={!!errors.mode} {...register("mode")} />
              <FieldError errors={[errors.mode]} />
            </Field>
            {/* Optional (migration 0008): the bank's or supplier's transaction number, and anything worth noting. */}
            <Field className={fieldClass} data-invalid={!!errors.reference}>
              <FieldLabel htmlFor="payment-reference" className={labelClass}>
                Reference
              </FieldLabel>
              <Input id="payment-reference" maxLength={100} size="sm" placeholder="Transaction number" aria-invalid={!!errors.reference} {...register("reference")} />
              <FieldError errors={[errors.reference]} />
            </Field>
            <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.notes}>
              <FieldLabel htmlFor="payment-notes" className={labelClass}>
                Notes
              </FieldLabel>
              <Textarea id="payment-notes" maxLength={1000} className="min-h-[60px] text-sm" aria-invalid={!!errors.notes} {...register("notes")} />
              <FieldError errors={[errors.notes]} />
            </Field>
          </>
        ) : null}
      </div>
      {type === "order" || type === "advance" ? (
        <div className="mt-[14px] flex items-center justify-between gap-4 border-t border-dashed pt-[7px]">
          <span className="text-[13px] leading-5 text-muted-foreground">Amount in INR</span>
          <output htmlFor="payment-amount payment-rate" className="text-[15px] leading-5 font-bold">
            {formatINR(paymentINR(amountCny, inr ? "1" : rateInr))}
          </output>
        </div>
      ) : null}
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
