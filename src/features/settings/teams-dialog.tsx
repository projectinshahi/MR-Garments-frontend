"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { CreateTeamBody, TeamResponse, TeamRow, UpdateTeamBody } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { ConfirmDialog, fieldClass, labelClass, setApiErrors, SettingsDialog, SettingsDialogFooter, useSettingsDialog } from "./settings-dialog";

// No reference design: built from the shared dialog in the style of 53_17.4_Add_supplier_(pop-up).jpeg.

export const TEAMS_PATH = "/settings/teams";

// Proposed wording, the same as the API's.
export const TEAM_TEXT = {
  nameEmpty: "Enter the team name.",
  added: "Team added",
  saved: "Team saved",
  deactivate: "An inactive team no longer appears when goods are split in the warehouse. The stock it already holds stays with it.",
};

const teamSchema = z.object({ name: z.string().trim().min(1, TEAM_TEXT.nameEmpty), status: z.enum(["Active", "Inactive"]) });
type TeamValues = z.infer<typeof teamSchema>;

/** Add (?dialog=add) or edit (?dialog=edit&id=) a team; render inside <Suspense>. Saving as Inactive asks first. */
export function TeamDialog({ rows }: { rows: TeamRow[] }) {
  const { open, id, close, saved } = useSettingsDialog(TEAMS_PATH);
  const row = open === "edit" ? rows.find((team) => team.id === id) : undefined;
  return (
    <SettingsDialog
      open={open === "add" || !!row}
      onClose={close}
      title={row ? "Edit team" : "Add team"}
      description={row ? "Change the team name or status." : "Add a team so goods can be split to it when they reach the warehouse."}
    >
      <TeamForm key={row?.id ?? "add"} row={row} onCancel={close} onSaved={() => saved(row ? TEAM_TEXT.saved : TEAM_TEXT.added)} />
    </SettingsDialog>
  );
}

function TeamForm({ row, onCancel, onSaved }: { row?: TeamRow; onCancel: () => void; onSaved: () => void }) {
  const { register, handleSubmit, setError, formState } = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: row ?? { name: "", status: "Active" },
  });
  const { errors, isSubmitting } = formState;
  // The values waiting for the deactivation to be confirmed.
  const [confirming, setConfirming] = useState<TeamValues | null>(null);

  async function save({ name, status }: TeamValues) {
    try {
      if (row) await apiClient.patch<TeamResponse>(`/teams/${row.id}`, { name, status } satisfies UpdateTeamBody);
      else await apiClient.post<TeamResponse>("/teams", { name } satisfies CreateTeamBody);
    } catch (error) {
      setApiErrors(error, setError);
      return;
    }
    onSaved();
  }

  const submit = (values: TeamValues) => (row?.status === "Active" && values.status === "Inactive" ? setConfirming(values) : save(values));

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="mt-[14px]">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
        <Field className={cn(fieldClass, "sm:col-span-3")} data-invalid={!!errors.name}>
          <FieldLabel htmlFor="team-name" className={labelClass}>
            Team name <RequiredMark />
          </FieldLabel>
          <Input id="team-name" required aria-invalid={!!errors.name} size="sm" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        {row ? (
          <Field className={fieldClass} data-invalid={!!errors.status}>
            <FieldLabel htmlFor="team-status" className={labelClass}>
              Status
            </FieldLabel>
            <NativeSelect size="sm" id="team-status" aria-invalid={!!errors.status} {...register("status")}>
              <option>Active</option>
              <option>Inactive</option>
            </NativeSelect>
            <FieldError errors={[errors.status]} />
          </Field>
        ) : null}
      </div>
      <SettingsDialogFooter onCancel={onCancel} submitLabel="Save team" submitting={isSubmitting} />
      <ConfirmDialog
        open={!!confirming}
        title={`Deactivate ${row?.name}?`}
        description={TEAM_TEXT.deactivate}
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
