"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { ItemResponse, ItemRow } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { ConfirmDialog, fieldClass, labelClass, setApiErrors, SettingsDialog, SettingsDialogFooter, useSettingsDialog } from "./settings-dialog";

// Add or edit item: no reference design, so it is built like Add supplier (53). The checks mirror the API's, with
// its messages (backend master-data/items.routes.ts MESSAGES), so both sides say the same thing.

export const ITEMS_PATH = "/settings/items";

export const MESSAGES = {
  name: "Enter the item name.",
  nameTooLong: "Use 200 characters or fewer.",
  countedIn: "Choose Pieces or Metres.",
  bundle: "Enter the pieces per bundle or a bundle label.",
  perBundle: "Enter a whole number of pieces from 1 to 100000.",
  bundleLabelTooLong: "Use 200 characters or fewer.",
};
export const SUCCESS = { itemAdded: "Item added", itemSaved: "Item saved" };
const M = MESSAGES;

/** What the inputs hold, checked as the API checks it, out as the POST/PATCH body. */
export const itemSchema = z
  .object({
    name: z.string().trim().min(1, M.name).max(200, M.nameTooLong),
    // Undefined while the unit is locked (the item is on an order), so the edit doesn't send it.
    countedIn: z.string().pipe(z.enum(["Pieces", "Metres"], { error: M.countedIn })).optional(),
    perBundle: z
      .string()
      .trim()
      .refine((text) => text === "" || (/^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= 100_000), M.perBundle),
    bundleLabel: z.string().trim().max(200, M.bundleLabelTooLong),
    status: z.enum(["Active", "Inactive"]),
  })
  // Exactly one of the two. Checked even when another field fails, so every message shows at once.
  .refine(({ perBundle, bundleLabel }) => (perBundle === "") !== (bundleLabel === ""), { message: M.bundle, path: ["perBundle"], when: () => true })
  .transform(({ perBundle, bundleLabel, ...values }) => ({
    ...values,
    perBundle: perBundle === "" ? null : Number(perBundle),
    bundleLabel: bundleLabel || null,
  }));
type ItemInput = z.input<typeof itemSchema>;
type ItemValues = z.output<typeof itemSchema>;

const toInput = (row?: ItemRow): ItemInput => ({
  name: row?.name ?? "",
  countedIn: row?.countedIn ?? "",
  perBundle: row?.perBundle?.toString() ?? "",
  bundleLabel: row?.bundleLabel ?? "",
  status: row?.status ?? "Active",
});

/**
 * Add item (?dialog=add) or edit one row (?dialog=edit&id=), read with useSearchParams, so render it inside
 * <Suspense>. An id not in the list opens nothing. Saving toasts, closes and reloads the list from the server.
 */
export function ItemDialog({ rows }: { rows: ItemRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(ITEMS_PATH);
  const row = open === "edit" ? rows.find((item) => item.id === id) : undefined;
  return (
    <SettingsDialog
      open={open === "add" || !!row}
      onClose={close}
      title={row ? "Edit item" : "Add item"}
      description={row ? "Changes show wherever this item is used." : "Add a new item so you can pick it on an order."}
    >
      <ItemForm row={row} onCancel={close} onSaved={saved} />
    </SettingsDialog>
  );
}

function ItemForm({ row, onCancel, onSaved }: { row?: ItemRow; onCancel: () => void; onSaved: (message: string) => void }) {
  // The unit can't change once the item is on an order (409 item_in_use).
  const locked = !!row && row.usedInOrders.length > 0;
  const { register, handleSubmit, setError, formState } = useForm<ItemInput, unknown, ItemValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: toInput(row),
  });
  const { errors } = formState;
  // A save that deactivates the item, waiting for the confirmation.
  const [deactivating, setDeactivating] = useState<ItemValues | null>(null);

  async function send(values: ItemValues) {
    try {
      if (row) await apiClient.patch<ItemResponse>(`/items/${row.id}`, values);
      else await apiClient.post<ItemResponse>("/items", values);
    } catch (error) {
      setApiErrors(error, setError);
      return;
    }
    onSaved(row ? SUCCESS.itemSaved : SUCCESS.itemAdded);
  }

  async function save(values: ItemValues) {
    if (row?.status === "Active" && values.status === "Inactive") setDeactivating(values);
    else await send(values);
  }

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.name}>
          <FieldLabel htmlFor="item-name" className={labelClass}>
            Item name <RequiredMark />
          </FieldLabel>
          <Input id="item-name" required maxLength={200} aria-invalid={!!errors.name} size="sm" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.countedIn}>
          <FieldLabel htmlFor="item-counted-in" className={labelClass}>
            Counted in <RequiredMark />
          </FieldLabel>
          <NativeSelect
            size="sm"
            id="item-counted-in"
            required
            aria-invalid={!!errors.countedIn}
            aria-describedby={locked ? "item-counted-in-hint" : undefined}
            {...register("countedIn", { disabled: locked })}
          >
            {row ? null : <option value="">Select unit</option>}
            <option value="Pieces">Pieces</option>
            <option value="Metres">Metres</option>
          </NativeSelect>
          {locked ? (
            <FieldDescription id="item-counted-in-hint" className="text-[12.5px] leading-4">
              On an order, so it can&apos;t change.
            </FieldDescription>
          ) : null}
          <FieldError errors={[errors.countedIn]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.perBundle}>
          <FieldLabel htmlFor="item-per-bundle" className={labelClass}>
            Pieces per bundle
          </FieldLabel>
          <Input id="item-per-bundle" inputMode="numeric" placeholder="Enter number" aria-invalid={!!errors.perBundle} size="sm" {...register("perBundle")} />
          <FieldError errors={[errors.perBundle]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.bundleLabel}>
          <FieldLabel htmlFor="item-bundle-label" className={labelClass}>
            Bundle label
          </FieldLabel>
          <Input id="item-bundle-label" maxLength={200} placeholder="Or a label, such as Roll" aria-invalid={!!errors.bundleLabel} size="sm" {...register("bundleLabel")} />
          <FieldError errors={[errors.bundleLabel]} />
        </Field>
        {row ? (
          <Field className={fieldClass} data-invalid={!!errors.status}>
            <FieldLabel htmlFor="item-status" className={labelClass}>
              Status
            </FieldLabel>
            <NativeSelect size="sm" id="item-status" aria-invalid={!!errors.status} {...register("status")}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </NativeSelect>
            <FieldError errors={[errors.status]} />
          </Field>
        ) : null}
      </div>
      <SettingsDialogFooter onCancel={onCancel} submitLabel="Save item" submitting={formState.isSubmitting} />
      <ConfirmDialog
        open={!!deactivating}
        title={`Deactivate ${row?.name}?`}
        description="An inactive item no longer appears on new orders. Orders that already have it keep it."
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          if (deactivating) await send(deactivating);
          setDeactivating(null);
        }}
        onCancel={() => setDeactivating(null)}
      />
    </form>
  );
}
