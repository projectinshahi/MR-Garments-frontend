"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { CreateTransportCompanyBody, TransportCompanyResponse, TransportCompanyRow, UpdateTransportCompanyBody } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { addHref, ConfirmDialog, fieldClass, labelClass, setApiErrors, SettingsDialog, SettingsDialogFooter, useSettingsDialog } from "./settings-dialog";

// No reference design: built from the Add supplier dialog (53_17.4) and the shared Settings dialog shell.

export const TRANSPORT_COMPANIES_PATH = "/settings/transport-companies";
export const ADD_TRANSPORT_COMPANY_HREF = addHref(TRANSPORT_COMPANIES_PATH);

/** The server sends the same name message (backend master-data/transport-companies.routes.ts). */
export const TRANSPORT_COMPANY_TEXT = {
  nameEmpty: "Enter the transport company name.",
  added: "Transport company added",
  saved: "Transport company saved",
};

const schema = z.object({
  name: z.string().trim().min(1, TRANSPORT_COMPANY_TEXT.nameEmpty),
  contactPerson: z.string().trim(),
  phone: z.string().trim(),
  status: z.enum(["Active", "Inactive"]),
});
type TransportCompanyDraft = z.infer<typeof schema>;

const EMPTY: TransportCompanyDraft = { name: "", contactPerson: "", phone: "", status: "Active" };

/**
 * Add (?dialog=add) and Edit (?dialog=edit&id=) on the Transport companies tab; render inside <Suspense>. Save posts
 * or patches, then toasts, closes and reloads the list. Setting an Active company Inactive asks first.
 */
export function TransportCompanyDialogs({ rows }: { rows: TransportCompanyRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(TRANSPORT_COMPANIES_PATH);
  const row = open === "edit" ? rows.find((company) => company.id === id) : undefined;
  return (
    <>
      <SettingsDialog open={open === "add"} onClose={close} title="Add transport company" description="Add a new transport company so you can pick it for a road trip.">
        <TransportCompanyForm onCancel={close} onSaved={() => saved(TRANSPORT_COMPANY_TEXT.added)} />
      </SettingsDialog>
      <SettingsDialog open={!!row} onClose={close} title="Edit transport company" description="Change the company’s details, or set it Inactive to stop offering it on new trips.">
        <TransportCompanyForm row={row} onCancel={close} onSaved={() => saved(TRANSPORT_COMPANY_TEXT.saved)} />
      </SettingsDialog>
    </>
  );
}

function TransportCompanyForm({ row, onCancel, onSaved }: { row?: TransportCompanyRow; onCancel: () => void; onSaved: () => void }) {
  // The row this form opened with: the URL loses its id while the dialog fades out after a save.
  const [editing] = useState(row);
  const [deactivating, setDeactivating] = useState<TransportCompanyDraft | null>(null);
  const { register, handleSubmit, setError, formState } = useForm({ resolver: zodResolver(schema), defaultValues: editing ?? EMPTY });
  const { errors } = formState;

  async function save({ name, contactPerson, phone, status }: TransportCompanyDraft) {
    try {
      if (editing) {
        const body: UpdateTransportCompanyBody = { name, contactPerson, phone, status };
        await apiClient.patch<TransportCompanyResponse>(`/transport-companies/${editing.id}`, body);
      } else {
        const body: CreateTransportCompanyBody = { name, contactPerson, phone };
        await apiClient.post<TransportCompanyResponse>("/transport-companies", body);
      }
    } catch (error) {
      setApiErrors(error, setError);
      return;
    }
    onSaved();
  }

  const submit = handleSubmit((values) => (editing?.status === "Active" && values.status === "Inactive" ? setDeactivating(values) : save(values)));

  return (
    <form noValidate onSubmit={submit} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
        <Field className={cn(fieldClass, "sm:col-span-3")} data-invalid={!!errors.name}>
          <FieldLabel htmlFor="transport-company-name" className={labelClass}>
            Transport company name <RequiredMark />
          </FieldLabel>
          <Input id="transport-company-name" required aria-invalid={!!errors.name} size="sm" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.contactPerson}>
          <FieldLabel htmlFor="transport-company-contact" className={labelClass}>
            Contact person
          </FieldLabel>
          <Input id="transport-company-contact" aria-invalid={!!errors.contactPerson} size="sm" {...register("contactPerson")} />
          <FieldError errors={[errors.contactPerson]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="transport-company-phone" className={labelClass}>
            Phone
          </FieldLabel>
          <Input id="transport-company-phone" type="tel" aria-invalid={!!errors.phone} size="sm" {...register("phone")} />
          <FieldError errors={[errors.phone]} />
        </Field>
        {editing ? (
          <Field className={fieldClass} data-invalid={!!errors.status}>
            <FieldLabel htmlFor="transport-company-status" className={labelClass}>
              Status
            </FieldLabel>
            <NativeSelect size="sm" id="transport-company-status" aria-invalid={!!errors.status} {...register("status")}>
              <option>Active</option>
              <option>Inactive</option>
            </NativeSelect>
            <FieldError errors={[errors.status]} />
          </Field>
        ) : null}
      </div>
      <SettingsDialogFooter onCancel={onCancel} submitLabel="Save transport company" submitting={formState.isSubmitting} />
      {editing ? (
        <ConfirmDialog
          open={!!deactivating}
          title={`Deactivate ${editing.name}?`}
          description="It won’t be offered on new trips. Trips that already use it keep it."
          confirmLabel="Deactivate"
          destructive
          onConfirm={async () => {
            if (deactivating) await save(deactivating);
            setDeactivating(null);
          }}
          onCancel={() => setDeactivating(null)}
        />
      ) : null}
    </form>
  );
}
