"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type FieldErrors, type UseFormRegisterReturn, useForm, useWatch } from "react-hook-form";

import { Callout } from "@/components/shared/cards";
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
import { currencySymbol, formatINR, rateText } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/domain";
import { FinalApprovalDialog, needsFinalApproval } from "@/features/receiving/final-approval-dialog";

import { balanceText, HELD_MESSAGE, round2 } from "./money";
import {
  type AgentPaymentInput,
  type AgentPaymentValues,
  agentSchemaFor,
  balanceNow,
  defaultCurrency,
  defaultRate,
  emptyAgentPayment,
  emptySupplierPayment,
  FORM_FIELD,
  isBlocked,
  paymentINR,
  type SupplierPaymentInput,
  type SupplierPaymentValues,
  supplierSchemaFor,
  toAgentPaymentBody,
  toNumber,
  toSupplierPaymentBody,
} from "./record-payment-form";

// No reference design: built like Add supplier (53) with the New order deposit fields (15).
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const footerButtonClass = "h-[42px] px-[17px]";

/** An ADV-5 supplier: its currencies (D10), signed balances, rate (for its own currency) and whether it is held. */
export type SupplierChoice = AdvanceSupplierOption;
/** The order a sea freight payment belongs to: its currency and the rate to start from (the order's or the supplier's; null when none). */
export type FreightOrder = { orderId: string; po: string; currency: Currency; exchangeRate: number | null };

type FieldName = "amount" | "paidOn" | "rateInr" | "mode" | "reference" | "notes";
type MoneyErrors = FieldErrors<Pick<SupplierPaymentInput, FieldName>>;

/** One request id per opened dialog: a retry after a lost answer sends the same one, so the API records the payment once. */
const newRequestId = () => crypto.randomUUID();

/** 422 fields under their inputs (the first focused); anything else (409 held, 503 maintenance, idempotency) is toasted. */
function showErrors(error: unknown, setError: (field: never, error: { message: string }, options: { shouldFocus: boolean }) => void, has: (field: string) => boolean) {
  Object.entries(handleApiError(error) ?? {}).forEach(([key, message], index) => {
    const field = FORM_FIELD[key];
    if (field && has(field)) setError(field as never, { message }, { shouldFocus: index === 0 });
    else notifyError(message);
  });
}

/**
 * Record payment (PAY-2, the unified supplier ledger): money already paid to a supplier, recorded against the supplier,
 * never an order. It goes to the supplier's account in the chosen currency; the supplier's orders settle from the
 * account, oldest first. `supplierId`: opened from an order, that order's supplier, fixed. Records only.
 */
/**
 * `canApprove` (Management, payments Full): a payment dated before the credits that settle a protected final landed
 * cost (409 final_settlement_approval) asks for the approval's reason; anyone else sees the API's message.
 */
export function RecordPaymentDialog({
  suppliers,
  supplierId,
  canApprove = false,
  children,
}: {
  suppliers: SupplierChoice[];
  supplierId?: string;
  canApprove?: boolean;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">Record payment</DialogTitle>
          <DialogDescription className="text-sm leading-5">
            A payment already made to a supplier. It goes to the supplier&apos;s account in its currency; the supplier&apos;s orders are settled from the account,
            oldest first.
          </DialogDescription>
        </DialogHeader>
        <SupplierPaymentForm
          suppliers={suppliers}
          fixedId={supplierId}
          canApprove={canApprove}
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

// Rendered inside DialogContent, which unmounts on close: the form and its request id start fresh on every open.
function SupplierPaymentForm({
  suppliers,
  fixedId,
  canApprove,
  onCancel,
  onSaved,
}: {
  suppliers: SupplierChoice[];
  fixedId?: string;
  canApprove: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [approval, setApproval] = useState<{ message: string; values: SupplierPaymentValues } | null>(null);
  const [today] = useState(() => todayInIndia());
  const [requestId] = useState(newRequestId);
  const fixed = fixedId ? suppliers.find((s) => s.id === fixedId) : undefined;
  const [name, setName] = useState(fixed?.name ?? "");
  const find = (id: string) => suppliers.find((s) => s.id === id);
  const { register, handleSubmit, setError, setValue, getValues, control, formState } = useForm<SupplierPaymentInput, unknown, SupplierPaymentValues>({
    // The currency's own rules: an INR payment takes no rate. Options are the chosen supplier's (D10).
    resolver: (values, context, options) => {
      const supplier = find(values.supplierId);
      return zodResolver(supplierSchemaFor(today, supplier?.currencyOptions ?? [], values.currency))(values, context, options);
    },
    defaultValues: emptySupplierPayment(fixed, today),
  });
  const { errors } = formState;
  const [supplierId, currency, amount, rateInr] = useWatch({ control, name: ["supplierId", "currency", "amount", "rateInr"] });
  const supplier = find(supplierId);
  const blocked = isBlocked(supplier);
  const symbol = currencySymbol(currency || "CNY");
  const inr = currency === "INR";
  const now = balanceNow(supplier, currency);
  const paid = toNumber(amount);
  const after = round2(now + (Number.isFinite(paid) ? paid : 0));

  /** A new supplier or currency brings its own default rate, never over a rate the user typed. */
  function follow(next: SupplierChoice | undefined, nextCurrency: Currency) {
    const typed = getValues("rateInr");
    if (typed === "" || typed === defaultRate(supplier, currency)) setValue("rateInr", defaultRate(next, nextCurrency));
  }
  function chooseName(text: string) {
    setName(text);
    const match = suppliers.find((s) => s.name.toLowerCase() === text.trim().toLowerCase());
    if ((match?.id ?? "") === supplierId) return;
    const nextCurrency = defaultCurrency(match);
    follow(match, nextCurrency);
    setValue("supplierId", match?.id ?? "", { shouldValidate: formState.isSubmitted });
    setValue("currency", nextCurrency);
  }

  async function save(values: SupplierPaymentValues, approvalReason?: string) {
    let response: CreatePaymentResponse;
    try {
      response = await apiClient.post<CreatePaymentResponse>("/payments", {
        ...toSupplierPaymentBody(values, requestId),
        ...(approvalReason ? { finalSettlementApproval: { reason: approvalReason } } : {}),
      });
    } catch (error) {
      const final = needsFinalApproval(error);
      if (final && canApprove && !approvalReason) return setApproval({ message: final, values });
      showErrors(error, setError, (field) => field in values);
      return;
    }
    setApproval(null);
    const who = find(values.supplierId)?.name ?? "the supplier";
    const ledger = response.ledger;
    onSaved(
      ledger
        ? `Payment recorded for ${who}. Balance: ${balanceText(ledger.balanceBefore, ledger.currency)} → ${balanceText(ledger.balanceAfter, ledger.currency)}`
        : `Payment recorded for ${who}`,
    );
  }

  return (
    <>
      <form noValidate onSubmit={handleSubmit((values) => save(values))} className="mt-[14px]">
        <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
          <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.supplierId}>
            <FieldLabel htmlFor="payment-supplier" className={labelClass}>
              Supplier <RequiredMark />
            </FieldLabel>
            {fixed ? (
              <Input id="payment-supplier" readOnly size="sm" value={fixed.name} />
            ) : (
              // Searchable (native datalist): type part of the name and pick it.
              <>
                <Input
                  id="payment-supplier"
                  required
                  size="sm"
                  list="payment-supplier-options"
                  autoComplete="off"
                  placeholder="Search supplier"
                  value={name}
                  onChange={(event) => chooseName(event.target.value)}
                  aria-invalid={!!errors.supplierId}
                />
                <datalist id="payment-supplier-options">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </>
            )}
            <FieldError errors={[errors.supplierId]} />
          </Field>
          {blocked ? (
            <Callout tone="warning" size="sm" role="alert" className="sm:col-span-2">
              {HELD_MESSAGE} No payment can be recorded for it until the review is done.
            </Callout>
          ) : null}
          <Field className={fieldClass} data-invalid={!!errors.currency}>
            <FieldLabel htmlFor="payment-currency" className={labelClass}>
              Currency <RequiredMark />
            </FieldLabel>
            <NativeSelect
              size="sm"
              id="payment-currency"
              required
              disabled={!supplier || blocked}
              aria-invalid={!!errors.currency}
              {...register("currency", { onChange: (event: { target: { value: string } }) => follow(supplier, event.target.value) })}
              // Controlled: a new supplier brings new options, and the chosen one must show even when it isn't the first.
              value={currency}
            >
              {supplier ? null : <option value="">Choose a supplier first</option>}
              {supplier?.currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </NativeSelect>
            {supplier?.held && !blocked ? (
              <FieldDescription className="text-xs">
                {supplier.currency}: {HELD_MESSAGE}
              </FieldDescription>
            ) : null}
            <FieldError errors={[errors.currency]} />
          </Field>
          <MoneyFields
            register={(field) => register(field)}
            errors={errors}
            today={today}
            symbol={symbol}
            inr={inr}
            rateHint={
              supplier && currency === supplier.currency && supplier.exchangeRate !== null
                ? `Supplier rate now: ${rateText(currency, supplier.exchangeRate)}. Change it if this payment used another.`
                : `No saved rate for ${currency || "this currency"}: enter this payment's.`
            }
          />
        </div>
        <InrLine amount={amount} rateInr={inr ? "1" : rateInr} />
        {supplier && currency && !blocked ? (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-[13px] leading-5 text-muted-foreground">Supplier balance ({currency})</span>
            <output aria-label="Balance now and after" className="text-[13.5px] leading-5 font-bold">
              {balanceText(now, currency)} → {balanceText(after, currency)}
            </output>
          </div>
        ) : null}
        <Footer onCancel={onCancel} pending={formState.isSubmitting} disabled={blocked} label="Record payment" />
      </form>
      {/* Outside the form: React bubbles a portal's submit to its React parents. */}
      <FinalApprovalDialog message={approval?.message ?? null} onCancel={() => setApproval(null)} onApprove={(reason) => save(approval!.values, reason)} />
    </>
  );
}

/**
 * Record sea freight payment (PAY-2, the shipping-agent body): a payment to the order's shipping agent, kept on the
 * order in its currency. It is never posted to the supplier's account.
 */
export function RecordSeaFreightDialog({ order, agents, children }: { order: FreightOrder; agents: OrderOptions["agents"]; children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 pb-[26px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">Record sea freight payment for {order.po}</DialogTitle>
          <DialogDescription className="text-sm leading-5">
            A payment already made to the shipping agent for this order. It counts as sea freight, not as a payment to the supplier.
          </DialogDescription>
        </DialogHeader>
        <AgentPaymentForm
          order={order}
          agents={agents}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            notifySuccess(`Sea freight payment recorded for ${order.po}`);
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AgentPaymentForm({ order, agents, onCancel, onSaved }: { order: FreightOrder; agents: OrderOptions["agents"]; onCancel: () => void; onSaved: () => void }) {
  const [today] = useState(() => todayInIndia());
  const [requestId] = useState(newRequestId);
  const inr = order.currency === "INR";
  const { register, handleSubmit, setError, control, formState } = useForm<AgentPaymentInput, unknown, AgentPaymentValues>({
    resolver: zodResolver(agentSchemaFor(today, order.currency)),
    defaultValues: emptyAgentPayment(today, inr || order.exchangeRate === null ? "" : String(order.exchangeRate)),
  });
  const { errors } = formState;
  const [amount, rateInr] = useWatch({ control, name: ["amount", "rateInr"] });

  async function save(values: AgentPaymentValues) {
    try {
      await apiClient.post<CreatePaymentResponse>("/payments", toAgentPaymentBody(values, order.orderId, requestId));
    } catch (error) {
      showErrors(error, setError, (field) => field in values);
      return;
    }
    onSaved();
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        <Field className={fieldClass} data-invalid={!!errors.agentId}>
          <FieldLabel htmlFor="freight-agent" className={labelClass}>
            Shipping agent <RequiredMark />
          </FieldLabel>
          <NativeSelect size="sm" id="freight-agent" required aria-invalid={!!errors.agentId} {...register("agentId")}>
            <option value="">Select agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.agentId]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.kind}>
          <FieldLabel htmlFor="freight-kind" className={labelClass}>
            Kind <RequiredMark />
          </FieldLabel>
          <NativeSelect size="sm" id="freight-kind" required aria-invalid={!!errors.kind} {...register("kind")}>
            <option value="">Select kind</option>
            <option value="Deposit">Deposit</option>
            <option value="Balance">Balance</option>
          </NativeSelect>
          <FieldError errors={[errors.kind]} />
        </Field>
        <MoneyFields
          register={(field) => register(field)}
          errors={errors}
          today={today}
          symbol={currencySymbol(order.currency)}
          inr={inr}
          rateHint={order.exchangeRate !== null && !inr ? `Saved rate: ${rateText(order.currency, order.exchangeRate)}. Change it if this payment used another.` : "No saved rate: enter this payment's."}
        />
      </div>
      <InrLine amount={amount} rateInr={inr ? "1" : rateInr} />
      <Footer onCancel={onCancel} pending={formState.isSubmitting} label="Record payment" />
    </form>
  );
}

/** Amount, date, rate (not for INR), mode, reference and notes: the fields both payments share. */
function MoneyFields({
  register,
  errors,
  today,
  symbol,
  inr,
  rateHint,
}: {
  register: (field: FieldName) => UseFormRegisterReturn;
  errors: MoneyErrors;
  today: string;
  symbol: string;
  inr: boolean;
  rateHint: string;
}) {
  return (
    <>
      <Field className={fieldClass} data-invalid={!!errors.amount}>
        <FieldLabel htmlFor="payment-amount" className={labelClass}>
          Amount ({symbol}) <RequiredMark />
        </FieldLabel>
        <Input id="payment-amount" required inputMode="decimal" placeholder={symbol} size="sm" aria-invalid={!!errors.amount} {...register("amount")} />
        <FieldError errors={[errors.amount]} />
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
          <FieldDescription className="text-xs">{rateHint}</FieldDescription>
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
  );
}

function InrLine({ amount, rateInr }: { amount: string; rateInr: string }) {
  return (
    <div className="mt-[14px] flex items-center justify-between gap-4 border-t border-dashed pt-[7px]">
      <span className="text-[13px] leading-5 text-muted-foreground">Amount in INR</span>
      <output htmlFor="payment-amount payment-rate" className="text-[15px] leading-5 font-bold">
        {formatINR(paymentINR(amount, rateInr))}
      </output>
    </div>
  );
}

function Footer({ onCancel, pending, disabled = false, label }: { onCancel: () => void; pending: boolean; disabled?: boolean; label: string }) {
  return (
    <DialogFooter className="mt-5 pt-4">
      <Button type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel}>
        Cancel
      </Button>
      {/* Disabled while the request runs, so one click records one payment. */}
      <Button type="submit" className={footerButtonClass} disabled={pending || disabled}>
        {label}
      </Button>
    </DialogFooter>
  );
}
