"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { SupplierRow } from "@/lib/api/types";
import { SUCCESS } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { addHref, fieldClass, labelClass, setApiErrors, SettingsDialog, SettingsDialogFooter, useSettingsDialog } from "./settings-dialog";
import { supplierSchema, type SupplierDraft } from "./settings-logic";

const PATH = "/settings/suppliers";
export const ADD_SUPPLIER_HREF = addHref(PATH);

/**
 * Open while the URL has ?dialog=add (read with useSearchParams, so render it inside <Suspense>).
 * The × and Cancel remove the parameter. Save posts MD-2; on success (K7) it toasts "Supplier added", removes the
 * parameter and reloads the list from the server.
 */
export function AddSupplierDialog({ draft }: { draft: SupplierDraft }) {
  const { open, close, saved } = useSettingsDialog(PATH);
  return (
    <SettingsDialog open={open === "add"} onClose={close} title="Add supplier" description="Add a new supplier so you can pick it on an order.">
      <AddSupplierForm draft={draft} onCancel={close} onSaved={() => saved(SUCCESS.supplierAdded)} />
    </SettingsDialog>
  );
}

function AddSupplierForm({
  draft,
  onCancel,
  onSaved,
}: {
  draft: SupplierDraft;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm({ resolver: zodResolver(supplierSchema), defaultValues: draft });
  const nameError = formState.errors.name;

  async function save(supplier: SupplierDraft) {
    try {
      await apiClient.post<{ supplier: SupplierRow }>("/suppliers", supplier);
    } catch (error) {
      // E1/E2: M21 or M22 under Supplier name, focused, values kept. Other failures toast.
      setApiErrors(error, setError);
      return;
    }
    onSaved();
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!nameError}>
          <FieldLabel htmlFor="supplier-name" className={labelClass}>
            Supplier name <RequiredMark />
          </FieldLabel>
          <Input id="supplier-name" required aria-invalid={!!nameError} size="sm" {...register("name")} />
          <FieldError errors={[nameError]} />
        </Field>
        <Field className={fieldClass}>
          <FieldLabel htmlFor="supplier-city" className={labelClass}>
            City
          </FieldLabel>
          <Input id="supplier-city" size="sm" {...register("city")} />
        </Field>
        <Field className={fieldClass}>
          <FieldLabel htmlFor="supplier-contact" className={labelClass}>
            Contact person
          </FieldLabel>
          <Input id="supplier-contact" size="sm" {...register("contactPerson")} />
        </Field>
        <Field className={fieldClass}>
          <FieldLabel htmlFor="supplier-phone" className={labelClass}>
            Phone / WeChat
          </FieldLabel>
          <Input id="supplier-phone" type="tel" size="sm" {...register("phone")} />
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
          <Input id="supplier-address" placeholder="Enter address" size="sm" {...register("address")} />
        </Field>
        <Field className={cn(fieldClass, "sm:col-span-3")}>
          <FieldLabel htmlFor="supplier-notes" className={labelClass}>
            Notes
          </FieldLabel>
          <Input id="supplier-notes" placeholder="Optional" size="sm" {...register("notes")} />
        </Field>
      </div>
      <SettingsDialogFooter onCancel={onCancel} submitLabel="Save supplier" submitting={formState.isSubmitting} />
    </form>
  );
}
