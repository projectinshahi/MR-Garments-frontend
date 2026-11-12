"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyCombobox } from "@/components/shared/currency-combobox";
import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@/features/suppliers/countries";
import { apiClient } from "@/lib/api/client";
import type { CreateSupplierBody, CurrencyInfo, SupplierResponse, SupplierRow, UpdateSupplierBody } from "@/lib/api/types";
import { SUCCESS } from "@/lib/feedback";
import { currencyTitle, formatNumber, rateText } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import {
  addHref,
  DeactivateConfirm,
  type Deletable,
  fieldClass,
  labelClass,
  orDash,
  setApiErrors,
  SettingsDialog,
  SettingsDialogFooter,
  useSettingsDialog,
} from "./settings-dialog";
import { checkExchangeRate, exchangeRateProblem, exchangeRateText, suggestSupplierCode, supplierFields, toSupplierBody, type SupplierDraft } from "./settings-logic";

const PATH = "/settings/suppliers";
export const ADD_SUPPLIER_HREF = addHref(PATH);
export const SUPPLIER_SAVED = "Supplier saved";
export const DEACTIVATE_NOTE = "It won't appear when a new order is created. Orders that already use it keep it.";

/** The supplier as its Delete sees it: the edit dialog's and the table row's. */
export const supplierDeletable = (row: SupplierRow): Deletable => ({
  path: `/suppliers/${row.id}`,
  id: row.id,
  name: row.name,
  noun: "supplier",
  active: row.status === "Active",
  deactivateNote: DEACTIVATE_NOTE,
  usedBy: "orders",
  details: [
    ["Supplier code", orDash(row.code)],
    ["Contact person", orDash(row.contactPerson)],
    ["Phone", orDash(row.phone)],
    ["Country", orDash(row.country)],
    ["City", orDash(row.city)],
    ["Currency", currencyTitle(row.currency)],
    ["Exchange rate", exchangeRateText(row.currency, row.exchangeRate)],
    ["Open orders", formatNumber(row.openOrders)],
  ],
});

const STATUSES = ["Active", "Inactive"] as const;
const formSchema = supplierFields.extend({ status: z.enum(STATUSES) }).superRefine(checkExchangeRate);
export const RATE_CHANGE_TEXT = {
  title: "Change this supplier's currency or rate?",
  note: "The new currency and rate apply to new orders and deposits only. Existing orders, payments and deposits keep their own currency and the rate saved on them; nothing is converted or recalculated.",
};
/** A currency or rate the saved row doesn't have (an INR supplier's rate is 1 whatever the field says). */
const moneyChanged = (row: SupplierRow, values: { currency: SupplierRow["currency"]; exchangeRate: string }) =>
  row.currency !== values.currency || (values.currency !== "INR" && row.exchangeRate !== Number(values.exchangeRate));
type SupplierValues = z.infer<typeof formSchema>;
// The API's length limits (backend docs/suppliers.md), so its length errors can't come from this form.
const SHORT = 200;
const LONG = 1000;
const POSTAL_MAX = 50;
const CODE_MAX = 20;

/**
 * Add supplier (53_17.4) at ?dialog=add, Edit supplier at ?dialog=edit&id=<id> (read with useSearchParams, so render
 * it inside <Suspense>), on the Settings tab (`path` /settings/suppliers) or the Suppliers page (/suppliers). Edit is
 * the Add form filled from the list row, plus Status; an id not in the list opens nothing. The × and Cancel remove
 * the parameters. Save posts MD-2 or patches the supplier; on success (K7) it toasts, removes the parameters and
 * reloads the list from the server. The Add form offers the next SUP-nnn code (suggestSupplierCode).
 */
export function SupplierDialog({ draft, suppliers, currencies, path = PATH }: { draft: SupplierDraft; suppliers: SupplierRow[]; currencies: CurrencyInfo[]; path?: string }) {
  const { open, id, close, saved } = useSettingsDialog(path);
  const supplier = open === "edit" ? suppliers.find((row) => row.id === id) : undefined;
  return (
    <SettingsDialog
      open={open === "add" || !!supplier}
      onClose={close}
      title={supplier ? "Edit supplier" : "Add supplier"}
      description={supplier ? "Change this supplier's details or status." : "Add a new supplier so you can pick it on an order."}
    >
      {/* Keyed, so moving to another row's URL (back/forward) never saves one row's values over another. */}
      <SupplierForm
        key={supplier?.id ?? "add"}
        draft={{ ...draft, code: draft.code || suggestSupplierCode(suppliers) }}
        supplier={supplier}
        currencies={currencies}
        onCancel={close}
        onSaved={saved}
      />
    </SettingsDialog>
  );
}

/** A section of the form: a small heading over a three-column grid of fields. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-[12.5px] leading-4 font-bold tracking-[0.04em] text-muted-foreground uppercase">{title}</legend>
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function SupplierForm({
  draft,
  supplier,
  currencies,
  onCancel,
  onSaved,
}: {
  draft: SupplierDraft;
  supplier?: SupplierRow;
  /** The currency master (GET /currencies), loaded with the page. */
  currencies: CurrencyInfo[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  // The row's id, open orders and money aren't form fields: the schema drops them. The rate is typed as text.
  const { register, handleSubmit, setError, setValue, control, formState } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: supplier ? { ...supplier, exchangeRate: supplier.exchangeRate === null ? "" : String(supplier.exchangeRate) } : { ...draft, status: "Active" as const },
  });
  const errors = formState.errors;
  // The values waiting for the deactivate confirmation, and for the currency / rate change one.
  const [confirming, setConfirming] = useState<SupplierValues | null>(null);
  const [moneyConfirm, setMoneyConfirm] = useState<SupplierValues | null>(null);
  const [currency, exchangeRate] = useWatch({ control, name: ["currency", "exchangeRate"] });
  const inr = currency === "INR";
  // "1 CNY = ₹12.50" once the typed rate is valid, else what to type; INR needs no rate.
  const rateHint = inr ? "INR is the base currency: the rate is fixed at 1." : exchangeRateProblem(currency, exchangeRate) ? `INR for 1 ${currency}, e.g. 12.5` : rateText(currency, Number(exchangeRate));
  // A stored country outside the list stays selectable, so saving never drops it.
  const countries = supplier?.country && !COUNTRIES.some((country) => country.name === supplier.country) ? [{ name: supplier.country, code: "" }, ...COUNTRIES] : COUNTRIES;

  async function save({ status, ...details }: SupplierValues) {
    try {
      // A changed currency or rate applies to the supplier's new orders and deposits only: each keeps its own.
      if (supplier) await apiClient.patch<SupplierResponse>(`/suppliers/${supplier.id}`, { ...toSupplierBody(details), status } satisfies UpdateSupplierBody);
      else await apiClient.post<SupplierResponse>("/suppliers", toSupplierBody(details) satisfies CreateSupplierBody);
    } catch (error) {
      // E1/E2: M21, M22 or a taken code under its field, focused, values kept. Other failures toast.
      setConfirming(null);
      setMoneyConfirm(null);
      setApiErrors(error, setError);
      return;
    }
    onSaved(supplier ? SUPPLIER_SAVED : SUCCESS.supplierAdded);
  }

  // Deactivating asks first; so does a new currency or rate on a supplier that already has orders or deposits.
  const submit = (values: SupplierValues) => {
    if (supplier?.status === "Active" && values.status === "Inactive") return setConfirming(values);
    if (supplier?.hasTransactions && moneyChanged(supplier, values)) return setMoneyConfirm(values);
    return save(values);
  };

  const text = (name: keyof SupplierDraft, label: string, extra: { max?: number; type?: string; placeholder?: string; span?: string; hint?: string } = {}) => (
    <Field className={cn(fieldClass, extra.span)} data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`supplier-${name}`} className={labelClass}>
        {label}
      </FieldLabel>
      <Input
        id={`supplier-${name}`}
        type={extra.type ?? "text"}
        placeholder={extra.placeholder}
        maxLength={extra.max ?? SHORT}
        aria-invalid={!!errors[name]}
        size="sm"
        {...register(name)}
      />
      {extra.hint ? <FieldDescription className="text-xs">{extra.hint}</FieldDescription> : null}
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  return (
    <>
      <form noValidate onSubmit={handleSubmit(submit)} className="mt-[14px] flex flex-col gap-5">
        <Section title="Basic information">
          <Field className={fieldClass} data-invalid={!!errors.code}>
            <FieldLabel htmlFor="supplier-code" className={labelClass}>
              Supplier code <RequiredMark />
            </FieldLabel>
            <Input id="supplier-code" required maxLength={CODE_MAX} aria-invalid={!!errors.code} size="sm" className="uppercase" {...register("code")} />
            <FieldError errors={[errors.code]} />
          </Field>
          <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.name}>
            <FieldLabel htmlFor="supplier-name" className={labelClass}>
              Supplier name <RequiredMark />
            </FieldLabel>
            <Input id="supplier-name" required maxLength={SHORT} aria-invalid={!!errors.name} size="sm" {...register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="supplier-country" className={labelClass}>
              Country
            </FieldLabel>
            <NativeSelect size="sm" id="supplier-country" {...register("country")}>
              <option value="">Not set</option>
              {countries.map((country) => (
                <option key={country.name} value={country.name}>
                  {country.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {/* The supplier's one currency and its INR rate (docs/supplier-currency.md): every new order and deposit is in it. */}
          <Field className={fieldClass} data-invalid={!!errors.currency}>
            <FieldLabel htmlFor="supplier-currency" className={labelClass}>
              Preferred transaction currency <RequiredMark />
            </FieldLabel>
            {/* Searched by code, name or symbol over the backend's currency master. INR's rate is 1 and fixed; another
                currency starts with the rate empty, never the previous currency's. */}
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <CurrencyCombobox
                  id="supplier-currency"
                  value={field.value}
                  currencies={currencies}
                  invalid={!!errors.currency}
                  onChange={(code) => {
                    field.onChange(code);
                    setValue("exchangeRate", code === "INR" ? "1" : "", { shouldValidate: formState.isSubmitted });
                  }}
                />
              )}
            />
            <FieldError errors={[errors.currency]} />
          </Field>
          <Field className={fieldClass} data-invalid={!!errors.exchangeRate}>
            <FieldLabel htmlFor="supplier-rate" className={labelClass}>
              Exchange rate (1 {currency} = ? INR) <RequiredMark />
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="supplier-rate"
                required
                inputMode="decimal"
                readOnly={inr}
                aria-invalid={!!errors.exchangeRate}
                size="sm"
                className={cn(inr && "bg-muted text-muted-foreground")}
                {...register("exchangeRate")}
              />
              <span aria-hidden className="shrink-0 text-[12.5px] font-bold text-muted-foreground">
                INR
              </span>
            </div>
            <FieldDescription className="text-xs">{rateHint}</FieldDescription>
            <FieldError errors={[errors.exchangeRate]} />
          </Field>
          {supplier && (
            <Field className={fieldClass}>
              <FieldLabel htmlFor="supplier-status" className={labelClass}>
                Status
              </FieldLabel>
              <NativeSelect size="sm" id="supplier-status" {...register("status")}>
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </Section>
        <Section title="Contact information">
          {text("contactPerson", "Contact person")}
          {text("email", "Email", { type: "email" })}
          {text("phone", "Phone", { type: "tel" })}
          {text("address", "Address", { max: LONG, placeholder: "Enter address", span: "sm:col-span-3" })}
          {text("city", "City")}
          {text("state", "State / Province")}
          {text("postalCode", "Postal code", { max: POSTAL_MAX })}
        </Section>
        <Section title="Additional information">
          {text("paymentTerms", "Payment terms", { placeholder: "e.g. 30% deposit, balance before shipment" })}
          {text("taxNumber", "Tax / registration number")}
          {text("notes", "Notes", { max: LONG, placeholder: "Optional", span: "sm:col-span-3" })}
        </Section>
        <SettingsDialogFooter
          onCancel={onCancel}
          submitLabel="Save supplier"
          submitting={formState.isSubmitting}
          remove={supplier && supplierDeletable(supplier)}
        />
      </form>
      <DeactivateConfirm
        open={!!confirming}
        name={supplier?.name ?? ""}
        noun="supplier"
        note={DEACTIVATE_NOTE}
        onConfirm={() => save(confirming!)}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={!!moneyConfirm}
        title={RATE_CHANGE_TEXT.title}
        description={`${supplier?.name ?? "This supplier"} already has orders or deposits. ${RATE_CHANGE_TEXT.note}`}
        confirmLabel="Save changes"
        pendingLabel="Saving…"
        onConfirm={() => save(moneyConfirm!)}
        onCancel={() => setMoneyConfirm(null)}
      />
    </>
  );
}
