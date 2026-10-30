"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { CreateLocationBody, LocationResponse, LocationRow, OfficeType, UpdateLocationBody } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { ConfirmDialog, fieldClass, labelClass, setApiErrors, SettingsDialog, SettingsDialogFooter, useSettingsDialog } from "./settings-dialog";

// No reference design: built from the shared dialog in the style of 53_17.4_Add_supplier_(pop-up).jpeg.

export const OFFICES_PATH = "/settings/offices";
const TYPES: OfficeType[] = ["China office", "India office", "Warehouse"];

// Proposed wording, the same as the API's.
export const OFFICE_TEXT = {
  nameEmpty: "Enter the office or warehouse name.",
  typeEmpty: "Choose a type.",
  added: "Office or warehouse added",
  saved: "Office or warehouse saved",
  deactivate: "An inactive office or warehouse no longer appears when recording receipts or assigning users. Users already there keep it.",
};

const officeSchema = z.object({
  name: z.string().trim().min(1, OFFICE_TEXT.nameEmpty),
  type: z.custom<OfficeType | "">().refine(Boolean, OFFICE_TEXT.typeEmpty),
  address: z.string().trim(),
  status: z.enum(["Active", "Inactive"]),
});
type OfficeValues = z.infer<typeof officeSchema>;

/**
 * Add (?dialog=add) or edit (?dialog=edit&id=) an office or warehouse; render inside <Suspense>. The type is chosen
 * once: the edit form shows it read-only. Saving as Inactive asks first.
 */
export function OfficeDialog({ rows }: { rows: LocationRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(OFFICES_PATH);
  const row = open === "edit" ? rows.find((location) => location.id === id) : undefined;
  return (
    <SettingsDialog
      open={open === "add" || !!row}
      onClose={close}
      title={row ? "Edit office or warehouse" : "Add office or warehouse"}
      description={row ? "Change the name, address or status. The type can't change." : "Add an office or warehouse so you can pick it when recording receipts or assigning users."}
    >
      <OfficeForm key={row?.id ?? "add"} row={row} onCancel={close} onSaved={() => saved(row ? OFFICE_TEXT.saved : OFFICE_TEXT.added)} />
    </SettingsDialog>
  );
}

function OfficeForm({ row, onCancel, onSaved }: { row?: LocationRow; onCancel: () => void; onSaved: () => void }) {
  const { register, handleSubmit, setError, formState } = useForm<OfficeValues>({
    resolver: zodResolver(officeSchema),
    defaultValues: row ?? { name: "", type: "", address: "", status: "Active" },
  });
  const { errors, isSubmitting } = formState;
  // The values waiting for the deactivation to be confirmed.
  const [confirming, setConfirming] = useState<OfficeValues | null>(null);

  async function save({ name, type, address, status }: OfficeValues) {
    try {
      if (row) await apiClient.patch<LocationResponse>(`/locations/${row.id}`, { name, address, status } satisfies UpdateLocationBody);
      else await apiClient.post<LocationResponse>("/locations", { name, type: type as OfficeType, address } satisfies CreateLocationBody);
    } catch (error) {
      setApiErrors(error, setError);
      return;
    }
    onSaved();
  }

  const submit = (values: OfficeValues) => (row?.status === "Active" && values.status === "Inactive" ? setConfirming(values) : save(values));

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.name}>
          <FieldLabel htmlFor="office-name" className={labelClass}>
            Name <RequiredMark />
          </FieldLabel>
          <Input id="office-name" required aria-invalid={!!errors.name} size="sm" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.type}>
          <FieldLabel htmlFor="office-type" className={labelClass}>
            Type {row ? null : <RequiredMark />}
          </FieldLabel>
          {row ? (
            <Input id="office-type" value={row.type} readOnly size="sm" />
          ) : (
            <NativeSelect size="sm" id="office-type" required aria-invalid={!!errors.type} {...register("type")}>
              <option value="" />
              {TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </NativeSelect>
          )}
          <FieldError errors={[errors.type]} />
        </Field>
        <Field className={cn(fieldClass, "sm:col-span-3")} data-invalid={!!errors.address}>
          <FieldLabel htmlFor="office-address" className={labelClass}>
            Address
          </FieldLabel>
          <Input id="office-address" placeholder="Enter address" aria-invalid={!!errors.address} size="sm" {...register("address")} />
          <FieldError errors={[errors.address]} />
        </Field>
        {row ? (
          <Field className={fieldClass} data-invalid={!!errors.status}>
            <FieldLabel htmlFor="office-status" className={labelClass}>
              Status
            </FieldLabel>
            <NativeSelect size="sm" id="office-status" aria-invalid={!!errors.status} {...register("status")}>
              <option>Active</option>
              <option>Inactive</option>
            </NativeSelect>
            <FieldError errors={[errors.status]} />
          </Field>
        ) : null}
      </div>
      <SettingsDialogFooter
        onCancel={onCancel}
        submitLabel="Save office or warehouse"
        submitting={isSubmitting}
        remove={row && { path: `/locations/${row.id}`, name: row.name, noun: "office or warehouse" }}
      />
      <ConfirmDialog
        open={!!confirming}
        title={`Deactivate ${row?.name}?`}
        description={OFFICE_TEXT.deactivate}
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          await save(confirming!);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </form>
  );
}
