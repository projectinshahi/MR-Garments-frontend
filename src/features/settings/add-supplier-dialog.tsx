"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@/features/suppliers/countries";
import { apiClient } from "@/lib/api/client";
import type { CreateSupplierBody, SupplierResponse, SupplierRow, UpdateSupplierBody } from "@/lib/api/types";
import { SUCCESS } from "@/lib/feedback";
import { CURRENCY_NAME, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { CURRENCIES } from "@/types/domain";

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
import { suggestSupplierCode, supplierSchema, type SupplierDraft } from "./settings-logic";

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
    ["Currency", CURRENCY_NAME[row.currency]],
    ["Open orders", formatNumber(row.openOrders)],
  ],
});

const STATUSES = ["Active", "Inactive"] as const;
const formSchema = supplierSchema.extend({ status: z.enum(STATUSES) });
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
export function SupplierDialog({ draft, suppliers, path = PATH }: { draft: SupplierDraft; suppliers: SupplierRow[]; path?: string }) {
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
  onCancel,
  onSaved,
}: {
  draft: SupplierDraft;
  supplier?: SupplierRow;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  // The row's id, open orders and money aren't form fields: the schema drops them.
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: supplier ?? { ...draft, status: "Active" as const },
  });
  const errors = formState.errors;
  // The values waiting for the deactivate confirmation.
  const [confirming, setConfirming] = useState<SupplierValues | null>(null);
  // A stored country outside the list stays selectable, so saving never drops it.
  const countries = supplier?.country && !COUNTRIES.some((country) => country.name === supplier.country) ? [{ name: supplier.country, code: "" }, ...COUNTRIES] : COUNTRIES;

  async function save({ status, ...details }: SupplierValues) {
    try {
      // A changed currency applies to the supplier's new orders only: each order keeps its own.
      if (supplier) await apiClient.patch<SupplierResponse>(`/suppliers/${supplier.id}`, { ...details, status } satisfies UpdateSupplierBody);
      else await apiClient.post<SupplierResponse>("/suppliers", details satisfies CreateSupplierBody);
    } catch (error) {
      // E1/E2: M21, M22 or a taken code under its field, focused, values kept. Other failures toast.
      setConfirming(null);
      setApiErrors(error, setError);
      return;
    }
    onSaved(supplier ? SUPPLIER_SAVED : SUCCESS.supplierAdded);
  }

  const submit = (values: SupplierValues) =>
    supplier?.status === "Active" && values.status === "Inactive" ? setConfirming(values) : save(values);

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
          <Field className={fieldClass}>
            <FieldLabel htmlFor="supplier-currency" className={labelClass}>
              Currency
            </FieldLabel>
            <NativeSelect size="sm" id="supplier-currency" {...register("currency")}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {CURRENCY_NAME[currency]}
                </option>
              ))}
            </NativeSelect>
          </Field>
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
    </>
  );
}
