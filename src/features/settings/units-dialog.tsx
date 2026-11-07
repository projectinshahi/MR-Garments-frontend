"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { CreateUnitBody, UnitResponse, UnitRow, UpdateUnitBody } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import {
  DeactivateConfirm,
  type Deletable,
  fieldClass,
  labelClass,
  listFact,
  orDash,
  setApiErrors,
  SettingsDialog,
  SettingsDialogFooter,
  useSettingsDialog,
} from "./settings-dialog";

// Add or edit unit: no reference design, so it is built like Teams (in the style of 53_17.4_Add_supplier). The checks
// mirror the API's, with its messages (backend master-data/units.routes.ts MESSAGES), so both sides say the same thing.

export const UNITS_PATH = "/settings/units";

export const UNIT_TEXT = {
  nameEmpty: "Enter the unit name.",
  nameTooLong: "Use 50 characters or fewer.",
  symbolTooLong: "Use 10 characters or fewer.",
  added: "Unit added",
  saved: "Unit saved",
  deactivate: "An inactive unit can no longer be chosen for a new item. Items that already use it keep it.",
};

/** The unit as its Delete sees it: the edit dialog's and the table row's. */
export const unitDeletable = (row: UnitRow): Deletable => ({
  path: `/units/${row.id}`,
  id: row.id,
  name: row.name,
  noun: "unit",
  active: row.status === "Active",
  deactivateNote: UNIT_TEXT.deactivate,
  usedBy: "items",
  details: [
    ["Symbol", orDash(row.symbol)],
    ["Used by items", listFact(row.usedByItems)],
  ],
});

export const unitSchema = z.object({
  name: z.string().trim().min(1, UNIT_TEXT.nameEmpty).max(50, UNIT_TEXT.nameTooLong),
  symbol: z.string().trim().max(10, UNIT_TEXT.symbolTooLong),
  status: z.enum(["Active", "Inactive"]),
});
type UnitValues = z.infer<typeof unitSchema>;

/** Add (?dialog=add) or edit (?dialog=edit&id=) a unit; render inside <Suspense>. Saving as Inactive asks first. */
export function UnitDialog({ rows }: { rows: UnitRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(UNITS_PATH);
  const row = open === "edit" ? rows.find((unit) => unit.id === id) : undefined;
  return (
    <SettingsDialog
      open={open === "add" || !!row}
      onClose={close}
      title={row ? "Edit unit" : "Add unit"}
      description={row ? "Changes show wherever items are counted in this unit." : "Add a unit so items can be counted in it."}
    >
      <UnitForm key={row?.id ?? "add"} row={row} onCancel={close} onSaved={() => saved(row ? UNIT_TEXT.saved : UNIT_TEXT.added)} />
    </SettingsDialog>
  );
}

function UnitForm({ row, onCancel, onSaved }: { row?: UnitRow; onCancel: () => void; onSaved: () => void }) {
  const { register, handleSubmit, setError, formState } = useForm<UnitValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { name: row?.name ?? "", symbol: row?.symbol ?? "", status: row?.status ?? "Active" },
  });
  const { errors, isSubmitting } = formState;
  // The values waiting for the deactivation to be confirmed.
  const [confirming, setConfirming] = useState<UnitValues | null>(null);

  async function save({ name, symbol, status }: UnitValues) {
    try {
      if (row) await apiClient.patch<UnitResponse>(`/units/${row.id}`, { name, symbol, status } satisfies UpdateUnitBody);
      else await apiClient.post<UnitResponse>("/units", { name, symbol } satisfies CreateUnitBody);
    } catch (error) {
      setApiErrors(error, setError);
      return;
    }
    onSaved();
  }

  const submit = (values: UnitValues) => (row?.status === "Active" && values.status === "Inactive" ? setConfirming(values) : save(values));

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.name}>
          <FieldLabel htmlFor="unit-name" className={labelClass}>
            Unit name <RequiredMark />
          </FieldLabel>
          <Input id="unit-name" required maxLength={50} aria-invalid={!!errors.name} size="sm" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.symbol}>
          <FieldLabel htmlFor="unit-symbol" className={labelClass}>
            Symbol
          </FieldLabel>
          <Input
            id="unit-symbol"
            maxLength={10}
            placeholder="pcs, m, kg"
            aria-describedby="unit-symbol-hint"
            aria-invalid={!!errors.symbol}
            size="sm"
            {...register("symbol")}
          />
          <FieldDescription id="unit-symbol-hint" className="text-[12.5px] leading-4">
            Shown after quantities. Optional.
          </FieldDescription>
          <FieldError errors={[errors.symbol]} />
        </Field>
        {row ? (
          <Field className={fieldClass} data-invalid={!!errors.status}>
            <FieldLabel htmlFor="unit-status" className={labelClass}>
              Status
            </FieldLabel>
            <NativeSelect size="sm" id="unit-status" aria-invalid={!!errors.status} {...register("status")}>
              <option>Active</option>
              <option>Inactive</option>
            </NativeSelect>
            <FieldError errors={[errors.status]} />
          </Field>
        ) : null}
      </div>
      <SettingsDialogFooter onCancel={onCancel} submitLabel="Save unit" submitting={isSubmitting} remove={row && unitDeletable(row)} />
      <DeactivateConfirm
        open={!!confirming}
        name={row?.name ?? ""}
        noun="unit"
        note={UNIT_TEXT.deactivate}
        onConfirm={async () => {
          await save(confirming!);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </form>
  );
}
