"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { ClearingAgentResponse, ClearingAgentRow, CreateClearingAgentBody, UpdateClearingAgentBody } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { addHref, DeactivateConfirm, fieldClass, labelClass, setApiErrors, SettingsDialog, SettingsDialogFooter, useSettingsDialog } from "./settings-dialog";

const DEACTIVATE_NOTE = "It won’t be offered on new clearings. Clearings that already use it keep it.";

// No reference design: built from the Add supplier dialog (53_17.4) and the shared Settings dialog shell.

export const CLEARING_AGENTS_PATH = "/settings/clearing-agents";
export const ADD_CLEARING_AGENT_HREF = addHref(CLEARING_AGENTS_PATH);

/** The server sends the same name message (backend master-data/clearing-agents.routes.ts). */
export const CLEARING_AGENT_TEXT = {
  nameEmpty: "Enter the clearing agent name.",
  added: "Clearing agent added",
  saved: "Clearing agent saved",
};

const schema = z.object({
  name: z.string().trim().min(1, CLEARING_AGENT_TEXT.nameEmpty),
  contactPerson: z.string().trim(),
  phone: z.string().trim(),
  port: z.string().trim(),
  status: z.enum(["Active", "Inactive"]),
});
type ClearingAgentDraft = z.infer<typeof schema>;

const EMPTY: ClearingAgentDraft = { name: "", contactPerson: "", phone: "", port: "", status: "Active" };

/**
 * Add (?dialog=add) and Edit (?dialog=edit&id=) on the Clearing agents tab; render inside <Suspense>. Save posts or
 * patches, then toasts, closes and reloads the list. Setting an Active agent Inactive asks first.
 */
export function ClearingAgentDialogs({ rows }: { rows: ClearingAgentRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(CLEARING_AGENTS_PATH);
  const row = open === "edit" ? rows.find((agent) => agent.id === id) : undefined;
  return (
    <>
      <SettingsDialog open={open === "add"} onClose={close} title="Add clearing agent" description="Add a new clearing agent so you can pick it on a clearing.">
        <ClearingAgentForm onCancel={close} onSaved={() => saved(CLEARING_AGENT_TEXT.added)} />
      </SettingsDialog>
      <SettingsDialog open={!!row} onClose={close} title="Edit clearing agent" description="Change the agent’s details, or set it Inactive to stop offering it on new clearings.">
        <ClearingAgentForm row={row} onCancel={close} onSaved={() => saved(CLEARING_AGENT_TEXT.saved)} />
      </SettingsDialog>
    </>
  );
}

function ClearingAgentForm({ row, onCancel, onSaved }: { row?: ClearingAgentRow; onCancel: () => void; onSaved: () => void }) {
  // The row this form opened with: the URL loses its id while the dialog fades out after a save.
  const [editing] = useState(row);
  const [deactivating, setDeactivating] = useState<ClearingAgentDraft | null>(null);
  const { register, handleSubmit, setError, formState } = useForm({ resolver: zodResolver(schema), defaultValues: editing ?? EMPTY });
  const { errors } = formState;

  async function save({ name, contactPerson, phone, port, status }: ClearingAgentDraft) {
    try {
      if (editing) {
        const body: UpdateClearingAgentBody = { name, contactPerson, phone, port, status };
        await apiClient.patch<ClearingAgentResponse>(`/clearing-agents/${editing.id}`, body);
      } else {
        const body: CreateClearingAgentBody = { name, contactPerson, phone, port };
        await apiClient.post<ClearingAgentResponse>("/clearing-agents", body);
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
        <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.name}>
          <FieldLabel htmlFor="clearing-agent-name" className={labelClass}>
            Clearing agent name <RequiredMark />
          </FieldLabel>
          <Input id="clearing-agent-name" required aria-invalid={!!errors.name} size="sm" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.port}>
          <FieldLabel htmlFor="clearing-agent-port" className={labelClass}>
            Port
          </FieldLabel>
          <Input id="clearing-agent-port" aria-invalid={!!errors.port} size="sm" {...register("port")} />
          <FieldError errors={[errors.port]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.contactPerson}>
          <FieldLabel htmlFor="clearing-agent-contact" className={labelClass}>
            Contact person
          </FieldLabel>
          <Input id="clearing-agent-contact" aria-invalid={!!errors.contactPerson} size="sm" {...register("contactPerson")} />
          <FieldError errors={[errors.contactPerson]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="clearing-agent-phone" className={labelClass}>
            Phone
          </FieldLabel>
          <Input id="clearing-agent-phone" type="tel" aria-invalid={!!errors.phone} size="sm" {...register("phone")} />
          <FieldError errors={[errors.phone]} />
        </Field>
        {editing ? (
          <Field className={fieldClass} data-invalid={!!errors.status}>
            <FieldLabel htmlFor="clearing-agent-status" className={labelClass}>
              Status
            </FieldLabel>
            <NativeSelect size="sm" id="clearing-agent-status" aria-invalid={!!errors.status} {...register("status")}>
              <option>Active</option>
              <option>Inactive</option>
            </NativeSelect>
            <FieldError errors={[errors.status]} />
          </Field>
        ) : null}
      </div>
      <SettingsDialogFooter
        onCancel={onCancel}
        submitLabel="Save clearing agent"
        submitting={formState.isSubmitting}
        remove={
          editing && { path: `/clearing-agents/${editing.id}`, name: editing.name, noun: "clearing agent", active: editing.status === "Active", deactivateNote: DEACTIVATE_NOTE }
        }
      />
      {editing ? (
        <DeactivateConfirm
          open={!!deactivating}
          name={editing.name}
          noun="clearing agent"
          note={DEACTIVATE_NOTE}
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
