"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { supplierSchema, type SupplierDraft } from "./settings-logic";

export const ADD_SUPPLIER_HREF = "/settings/suppliers?dialog=add-supplier";

// Measured from 53_17.4_Add_supplier_(pop-up).jpeg: 21 px title over a 14 px description, 12.5 px bold labels 5 px
// above 42 px fields with 14 px text, 14 px between rows, 42 px footer buttons.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const footerButtonClass = "h-[42px] px-[17px]";

/**
 * Open while the URL has ?dialog=add-supplier (read with useSearchParams, so render it inside <Suspense>).
 * The × and Cancel remove the parameter; Save validates, hands the supplier to `onSave` and closes.
 */
export function AddSupplierDialog({ draft, onSave }: { draft: SupplierDraft; onSave: (supplier: SupplierDraft) => void }) {
  const open = useSearchParams().get("dialog") === "add-supplier";
  const router = useRouter();
  const close = () => router.replace("/settings/suppliers", { scroll: false });

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent
        className="gap-0 pb-[26px]"
        // The reference opens with no field focused: focus the dialog itself rather than the first input.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
        }}
      >
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">Add supplier</DialogTitle>
          <DialogDescription className="text-sm leading-5">Add a new supplier so you can pick it on an order.</DialogDescription>
        </DialogHeader>
        <AddSupplierForm
          draft={draft}
          onCancel={close}
          onSave={(supplier) => {
            onSave(supplier);
            close();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// Rendered inside DialogContent, which unmounts on close, so the form opens prefilled every time.
function AddSupplierForm({
  draft,
  onCancel,
  onSave,
}: {
  draft: SupplierDraft;
  onCancel: () => void;
  onSave: (supplier: SupplierDraft) => void;
}) {
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(supplierSchema), defaultValues: draft });
  const nameError = formState.errors.name;

  return (
    <form noValidate onSubmit={handleSubmit(onSave)} className="mt-[14px]">
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
      <DialogFooter className="mt-5 pt-4">
        <Button type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className={footerButtonClass}>
          Save supplier
        </Button>
      </DialogFooter>
    </form>
  );
}
