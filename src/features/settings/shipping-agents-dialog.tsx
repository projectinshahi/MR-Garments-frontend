"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { CreateShippingAgentBody, ShippingAgentResponse, ShippingAgentRow, UpdateShippingAgentBody } from "@/lib/api/types";
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

const PATH = "/settings/shipping-agents";
export const ADD_SHIPPING_AGENT_HREF = addHref(PATH);
export const SHIPPING_AGENT_ADDED = "Shipping agent added";
export const SHIPPING_AGENT_SAVED = "Shipping agent saved";

const STATUSES = ["Active", "Inactive"] as const;
/** The POST / PATCH /shipping-agents body. Only the name is required; the API keeps text to 200 characters. */
const agentSchema = z.object({
  name: z.string().trim().min(1, "Enter the shipping agent name."),
  contactPerson: z.string().trim(),
  phone: z.string().trim(),
  officeCity: z.string().trim(),
  status: z.enum(STATUSES),
});
type AgentValues = z.infer<typeof agentSchema>;
const EMPTY: AgentValues = { name: "", contactPerson: "", phone: "", officeCity: "", status: "Active" };
const MAX = 200;

/**
 * Add shipping agent at ?dialog=add, Edit shipping agent at ?dialog=edit&id=<id> (read with useSearchParams, so render
 * it inside <Suspense>). No reference draws it: it follows Add supplier (53_17.4), with Status on edit only; an id not
 * in the list opens nothing. Save posts or patches the agent, toasts, closes and reloads the list from the server.
 */
export function ShippingAgentDialog({ agents }: { agents: ShippingAgentRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(PATH);
  const agent = open === "edit" ? agents.find((row) => row.id === id) : undefined;
  return (
    <SettingsDialog
      open={open === "add" || !!agent}
      onClose={close}
      title={agent ? "Edit shipping agent" : "Add shipping agent"}
      description={agent ? "Change this shipping agent's details or status." : "Add a shipping agent so you can pick it on a container."}
    >
      {/* Keyed, so moving to another row's URL (back/forward) never saves one row's values over another. */}
      <ShippingAgentForm key={agent?.id ?? "add"} agent={agent} onCancel={close} onSaved={saved} />
    </SettingsDialog>
  );
}

function ShippingAgentForm({ agent, onCancel, onSaved }: { agent?: ShippingAgentRow; onCancel: () => void; onSaved: (message: string) => void }) {
  // The row's id and active containers aren't form fields: the schema drops them.
  const { register, handleSubmit, setError, formState } = useForm({ resolver: zodResolver(agentSchema), defaultValues: agent ?? EMPTY });
  const nameError = formState.errors.name;
  // The values waiting for the deactivate confirmation.
  const [confirming, setConfirming] = useState<AgentValues | null>(null);

  async function save({ status, ...details }: AgentValues) {
    try {
      if (agent) await apiClient.patch<ShippingAgentResponse>(`/shipping-agents/${agent.id}`, { ...details, status } satisfies UpdateShippingAgentBody);
      else await apiClient.post<ShippingAgentResponse>("/shipping-agents", details satisfies CreateShippingAgentBody);
    } catch (error) {
      // The empty or duplicate name under Shipping agent name, focused, values kept. Other failures toast.
      setConfirming(null);
      setApiErrors(error, setError);
      return;
    }
    onSaved(agent ? SHIPPING_AGENT_SAVED : SHIPPING_AGENT_ADDED);
  }

  const submit = (values: AgentValues) => (agent?.status === "Active" && values.status === "Inactive" ? setConfirming(values) : save(values));

  return (
    <>
      <form noValidate onSubmit={handleSubmit(submit)} className="mt-[14px]">
        <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
          <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!nameError}>
            <FieldLabel htmlFor="agent-name" className={labelClass}>
              Shipping agent name <RequiredMark />
            </FieldLabel>
            <Input id="agent-name" required maxLength={MAX} aria-invalid={!!nameError} size="sm" {...register("name")} />
            <FieldError errors={[nameError]} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="agent-city" className={labelClass}>
              Office city
            </FieldLabel>
            <Input id="agent-city" maxLength={MAX} size="sm" {...register("officeCity")} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="agent-contact" className={labelClass}>
              Contact person
            </FieldLabel>
            <Input id="agent-contact" maxLength={MAX} size="sm" {...register("contactPerson")} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="agent-phone" className={labelClass}>
              Phone
            </FieldLabel>
            <Input id="agent-phone" type="tel" maxLength={MAX} size="sm" {...register("phone")} />
          </Field>
          {agent && (
            <Field className={fieldClass}>
              <FieldLabel htmlFor="agent-status" className={labelClass}>
                Status
              </FieldLabel>
              <NativeSelect size="sm" id="agent-status" {...register("status")}>
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        <SettingsDialogFooter onCancel={onCancel} submitLabel="Save shipping agent" submitting={formState.isSubmitting} />
      </form>
      <ConfirmDialog
        open={!!confirming}
        title={`Deactivate ${agent?.name}?`}
        description="It won't appear when a container is loaded. Containers that already use it keep it."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => save(confirming!)}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
