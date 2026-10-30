"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { CreateSupplierBody, SupplierResponse, SupplierRow, UpdateSupplierBody } from "@/lib/api/types";
import { SUCCESS } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import {
  addHref,
  ConfirmDialog,
  fieldClass,
  labelClass,
  setApiErrors,
  SettingsDialog,
  SettingsDialogFooter,
  useSettingsDialog,
} from "./settings-dialog";
import { supplierSchema, type SupplierDraft } from "./settings-logic";

const PATH = "/settings/suppliers";
export const ADD_SUPPLIER_HREF = addHref(PATH);
export const SUPPLIER_SAVED = "Supplier saved";

const STATUSES = ["Active", "Inactive"] as const;
const formSchema = supplierSchema.extend({ status: z.enum(STATUSES) });
type SupplierValues = z.infer<typeof formSchema>;
// The API's length limits (wave3-contracts section 4), so its length errors can't come from this form.
const SHORT = 200;
const LONG = 1000;

/**
 * Add supplier (53_17.4) at ?dialog=add, Edit supplier at ?dialog=edit&id=<id> (read with useSearchParams, so render
 * it inside <Suspense>). Edit is the Add form filled from the list row, plus Status; an id not in the list opens
 * nothing. The × and Cancel remove the parameters. Save posts MD-2 or patches the supplier; on success (K7) it toasts,
 * removes the parameters and reloads the list from the server.
 */
export function SupplierDialog({ draft, suppliers }: { draft: SupplierDraft; suppliers: SupplierRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(PATH);
  const supplier = open === "edit" ? suppliers.find((row) => row.id === id) : undefined;
  return (
    <SettingsDialog
      open={open === "add" || !!supplier}
      onClose={close}
      title={supplier ? "Edit supplier" : "Add supplier"}
      description={supplier ? "Change this supplier's details or status." : "Add a new supplier so you can pick it on an order."}
    >
      {/* Keyed, so moving to another row's URL (back/forward) never saves one row's values over another. */}
      <SupplierForm key={supplier?.id ?? "add"} draft={draft} supplier={supplier} onCancel={close} onSaved={saved} />
    </SettingsDialog>
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
  // The row's id and open orders aren't form fields: the schema drops them.
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: supplier ?? { ...draft, status: "Active" as const },
  });
  const nameError = formState.errors.name;
  // The values waiting for the deactivate confirmation.
  const [confirming, setConfirming] = useState<SupplierValues | null>(null);

  async function save({ status, currency, ...details }: SupplierValues) {
    try {
      if (supplier) await apiClient.patch<SupplierResponse>(`/suppliers/${supplier.id}`, { ...details, status } satisfies UpdateSupplierBody);
      else await apiClient.post<SupplierResponse>("/suppliers", { ...details, currency } satisfies CreateSupplierBody);
    } catch (error) {
      // E1/E2: M21 or M22 under Supplier name, focused, values kept. Other failures toast.
      setConfirming(null);
      setApiErrors(error, setError);
      return;
    }
    onSaved(supplier ? SUPPLIER_SAVED : SUCCESS.supplierAdded);
  }

  const submit = (values: SupplierValues) =>
    supplier?.status === "Active" && values.status === "Inactive" ? setConfirming(values) : save(values);

  return (
    <>
      <form noValidate onSubmit={handleSubmit(submit)} className="mt-[14px]">
        <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
          <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!nameError}>
            <FieldLabel htmlFor="supplier-name" className={labelClass}>
              Supplier name <RequiredMark />
            </FieldLabel>
            <Input id="supplier-name" required maxLength={SHORT} aria-invalid={!!nameError} size="sm" {...register("name")} />
            <FieldError errors={[nameError]} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="supplier-city" className={labelClass}>
              City
            </FieldLabel>
            <Input id="supplier-city" maxLength={SHORT} size="sm" {...register("city")} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="supplier-contact" className={labelClass}>
              Contact person
            </FieldLabel>
            <Input id="supplier-contact" maxLength={SHORT} size="sm" {...register("contactPerson")} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="supplier-phone" className={labelClass}>
              Phone / WeChat
            </FieldLabel>
            <Input id="supplier-phone" type="tel" maxLength={SHORT} size="sm" {...register("phone")} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="supplier-currency" className={labelClass}>
              Currency
            </FieldLabel>
            <NativeSelect size="sm" id="supplier-currency" {...register("currency")}>
              <option value="CNY">¥ Chinese yuan</option>
            </NativeSelect>
          </Field>
          <Field className={cn(fieldClass, "sm:col-span-3")}>
            <FieldLabel htmlFor="supplier-address" className={labelClass}>
              Address
            </FieldLabel>
            <Input id="supplier-address" placeholder="Enter address" maxLength={LONG} size="sm" {...register("address")} />
          </Field>
          <Field className={cn(fieldClass, "sm:col-span-3")}>
            <FieldLabel htmlFor="supplier-notes" className={labelClass}>
              Notes
            </FieldLabel>
            <Input id="supplier-notes" placeholder="Optional" maxLength={LONG} size="sm" {...register("notes")} />
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
        </div>
        <SettingsDialogFooter
          onCancel={onCancel}
          submitLabel="Save supplier"
          submitting={formState.isSubmitting}
          remove={supplier && { path: `/suppliers/${supplier.id}`, name: supplier.name, noun: "supplier" }}
        />
      </form>
      <ConfirmDialog
        open={!!confirming}
        title={`Deactivate ${supplier?.name}?`}
        description="It won't appear when a new order is created. Orders that already use it keep it."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => save(confirming!)}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
