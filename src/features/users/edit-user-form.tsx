"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { PageContainer } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { DeactivateConfirm } from "@/components/shared/confirm-dialog";
import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/features/auth/auth-parts";
import { PasswordStrength } from "@/features/auth/password-strength";
import { apiClient } from "@/lib/api/client";
import { handleApiError, notifySuccess, SUCCESS } from "@/lib/feedback";
import type { RecordStatus } from "@/types/domain";

import type { EditUserData } from "./data/queries";
import { buildRoleCard } from "./role-card";
import {
  DEACTIVATE_NOTE,
  FORM_FIELDS,
  grantableStages,
  keepGrantable,
  newUserFormSchema,
  noStagesHint,
  STAGE_OPTIONS,
  toFormValues,
  toggleStage,
  toPayload,
  userFormSchema,
  type UserFormValues,
} from "./user-form";
import { UsersHeader } from "./users-header";

const FORM_ID = "edit-user-form";
const STATUSES: RecordStatus[] = ["Active", "Inactive"];
const ACCESS_TONE = { Full: "success", Enter: "success", View: "info", No: "neutral" } as const;

const labelClass = "gap-0.5 text-[13px] leading-[15px] font-bold text-label";
// The cards in 48 end 18 px below their last row (SectionCard pads 20).
const rowClass = "flex items-center border-b border-border-subtle py-[9px] last:border-0";

/**
 * Add or edit user (48): user details, the stages the person can enter, and what the role can do.
 * Saves through USR-3 (add) or USR-4 (edit), then goes to /users with K5 or K6. API field errors show under their
 * fields (E1-E3) with focus on the first; the values stay and Save is disabled only while the request runs (E14).
 * Password policy: Add user needs the initial password; Edit user may set a new one for someone else (which signs them
 * out everywhere), and shows no password field on the signed-in user's own account (`isSelf`).
 * Saving an Active user as Inactive asks first; the signed-in user's own Status can't change (contract D3).
 */
export function EditUserForm({ user, options, matrix, isSelf }: EditUserData) {
  const router = useRouter();
  const { register, control, handleSubmit, reset, resetField, setError, setValue, getValues, formState } = useForm<UserFormValues>({
    resolver: zodResolver(user ? userFormSchema : newUserFormSchema),
    defaultValues: toFormValues(user),
  });
  // Visited pages stay mounted but hidden (Activity), so an unsaved password would wait here for the next visit and go
  // out with a later save. This cleanup runs whenever the page is hidden or unmounted.
  useLayoutEffect(() => () => resetField("password"), [resetField]);
  const { errors, isSubmitting } = formState;
  const role = useWatch({ control, name: "role" });
  const card = buildRoleCard(role, matrix);
  // Ticks the role can't hold are disabled; a chosen role with none says why.
  const grantable = grantableStages(role, matrix);
  const stagesHint = role && grantable.length === 0 ? noStagesHint(role) : undefined;
  const password = useWatch({ control, name: "password" });
  // A user whose office was closed keeps it as a choice, so saving other fields doesn't drop it.
  const offices =
    user?.officeId && !options.offices.some((office) => office.id === user.officeId)
      ? [...options.offices, { id: user.officeId, name: user.office ?? "" }]
      : options.offices;

  // The values waiting for the deactivation to be confirmed (Active -> Inactive asks first, as in Settings).
  const [confirming, setConfirming] = useState<UserFormValues | null>(null);

  async function save(values: UserFormValues) {
    try {
      if (user) await apiClient.patch(`/users/${user.id}`, toPayload(values));
      else await apiClient.post("/users", toPayload(values));
    } catch (error) {
      const fields = handleApiError(error) ?? {};
      FORM_FIELDS.filter((key) => fields[key]).forEach((key, index) =>
        setError(key, { type: "server", message: fields[key] }, { shouldFocus: index === 0 }),
      );
      return;
    }
    notifySuccess(user ? SUCCESS.userSaved : SUCCESS.userAdded);
    // The page stays mounted (Activity), so the next visit starts from the saved values, or empty after an add. The
    // password is never kept.
    reset(user ? { ...values, password: "" } : toFormValues(null));
    router.push("/users");
  }
  const onSubmit = handleSubmit((values) => (user?.status === "Active" && values.status === "Inactive" ? setConfirming(values) : save(values)));

  return (
    <>
      <UsersHeader
        actions={
          <>
            {/* The header buttons in 48 are padded 16 px (Button size="header" pads 14). */}
            <Button asChild variant="outline" size="header" className="px-4">
              <Link href="/users" onClick={() => reset()}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" form={FORM_ID} size="header" className="px-4" disabled={isSubmitting}>
              Save user
            </Button>
          </>
        }
      />
      <PageContainer>
        <form id={FORM_ID} noValidate onSubmit={onSubmit} className="grid items-start gap-(--page-gap) lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-5">
            <SectionCard title="User details" titleGap="none" bottomGap="form">
              <div className="mt-[11px] grid gap-x-4 gap-y-[13px] sm:grid-cols-3">
                <Field className="gap-1.5" data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="user-name" className={labelClass}>
                    Full name <RequiredMark />
                  </FieldLabel>
                  <Input size="sm" id="user-name" required autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
                  <FieldError errors={[errors.name]} />
                </Field>
                <Field className="gap-1.5" data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="user-email" className={labelClass}>
                    Email <RequiredMark />
                  </FieldLabel>
                  <Input size="sm" id="user-email" type="email" required autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field className="gap-1.5" data-invalid={!!errors.phone}>
                  <FieldLabel htmlFor="user-phone" className={labelClass}>
                    Phone
                  </FieldLabel>
                  <Input size="sm" id="user-phone" type="tel" autoComplete="off" aria-invalid={!!errors.phone} {...register("phone")} />
                  <FieldError errors={[errors.phone]} />
                </Field>
                <Field className="gap-1.5" data-invalid={!!errors.role}>
                  <FieldLabel htmlFor="user-role" className={labelClass}>
                    Role <RequiredMark />
                  </FieldLabel>
                  <NativeSelect
                    size="sm"
                    id="user-role"
                    required
                    aria-invalid={!!errors.role}
                    {...register("role", {
                      onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                        setValue("stages", keepGrantable(getValues("stages"), event.target.value as UserFormValues["role"], matrix)),
                    })}
                  >
                    {user ? null : <option value="" />}
                    {options.roles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.role]} />
                </Field>
                <Field className="gap-1.5" data-invalid={!!errors.officeId}>
                  <FieldLabel htmlFor="user-office" className={labelClass}>
                    Office
                  </FieldLabel>
                  {/* Empty for no office: the Head office is deferred (U28). */}
                  <NativeSelect size="sm" id="user-office" aria-invalid={!!errors.officeId} {...register("officeId")}>
                    <option value="" />
                    {offices.map((office) => (
                      <option key={office.id} value={office.id}>
                        {office.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.officeId]} />
                </Field>
                <Field className="gap-1.5" data-invalid={!!errors.language}>
                  <FieldLabel htmlFor="user-language" className={labelClass}>
                    Language
                  </FieldLabel>
                  <NativeSelect size="sm" id="user-language" aria-invalid={!!errors.language} {...register("language")}>
                    {options.languages.map((language) => (
                      <option key={language}>{language}</option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.language]} />
                </Field>
                {isSelf ? null : (
                  <Field className="gap-1.5 sm:col-span-2" data-invalid={!!errors.password}>
                    <FieldLabel htmlFor="user-password" className={labelClass}>
                      {user ? (
                        "Set a new password"
                      ) : (
                        <>
                          Password <RequiredMark />
                        </>
                      )}
                    </FieldLabel>
                    <PasswordInput
                      id="user-password"
                      label={user ? "new password" : "password"}
                      required={!user}
                      autoComplete="new-password"
                      placeholder={user ? "Leave empty to keep the current password" : undefined}
                      className="h-[42px] text-sm"
                      aria-invalid={!!errors.password}
                      {...register("password")}
                    />
                    <FieldError errors={[errors.password]} />
                    {!user || password ? <PasswordStrength password={password} /> : null}
                  </Field>
                )}
                <Field className="gap-1.5" data-invalid={!!errors.status}>
                  <FieldLabel htmlFor="user-status" className={labelClass}>
                    Status
                  </FieldLabel>
                  {/* Your own account can't be deactivated (D3; USR-4 refuses it with 409 `own_account`). */}
                  <NativeSelect
                    size="sm"
                    id="user-status"
                    disabled={isSelf}
                    aria-describedby={isSelf ? "status-hint" : undefined}
                    aria-invalid={!!errors.status}
                    {...register("status")}
                  >
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </NativeSelect>
                  {isSelf ? (
                    <p id="status-hint" className="text-[12.5px] leading-[18px] text-muted-foreground">
                      You can&apos;t deactivate your own account.
                    </p>
                  ) : null}
                  <FieldError errors={[errors.status]} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Stages this person can enter data for" titleGap="none" bottomGap="form">
              <p className="mt-[3px] text-[12.5px] leading-[18px] text-muted-foreground">Entry staff see only the stages ticked here.</p>
              <Controller
                control={control}
                name="stages"
                render={({ field }) => (
                  <ul className="mt-0.5">
                    {STAGE_OPTIONS.map(({ stage, label }) => (
                      <li key={stage} className={`${rowClass} gap-2`}>
                        <Checkbox
                          id={`stage-${stage}`}
                          // An API error under the ticks focuses the first one the role can hold.
                          ref={stage === grantable[0] ? field.ref : undefined}
                          checked={field.value.includes(stage)}
                          disabled={!grantable.includes(stage)}
                          aria-invalid={!!errors.stages}
                          aria-describedby={stagesHint ? "stages-hint" : undefined}
                          onCheckedChange={(checked) => field.onChange(toggleStage(field.value, stage, checked === true))}
                        />
                        <Label htmlFor={`stage-${stage}`} className="text-sm leading-5 font-normal">
                          {label}
                        </Label>
                      </li>
                    ))}
                  </ul>
                )}
              />
              {stagesHint ? (
                <p id="stages-hint" className="mt-1 text-[12.5px] leading-[18px] text-muted-foreground">
                  {stagesHint}
                </p>
              ) : null}
              <FieldError errors={[errors.stages]} />
            </SectionCard>
          </div>

          <SectionCard title="What this role can do" titleGap="none" bottomGap="form">
            {card.summary ? (
              // 13.5 px text as in Callout size="sm"; the reference pads it 11.5 px vertically (sm pads 10).
              <Callout size="sm" className="mt-3 py-[11.5px]">
                {card.summary}
              </Callout>
            ) : null}
            <ul className="mt-[11px]">
              {card.abilities.map((ability) => (
                <li key={ability.label} className={`${rowClass} justify-between gap-4 text-sm`}>
                  {ability.label}
                  <StatusPill tone={ACCESS_TONE[ability.access]}>{ability.access}</StatusPill>
                </li>
              ))}
            </ul>
          </SectionCard>
        </form>
        <DeactivateConfirm
          open={!!confirming}
          name={user?.name ?? ""}
          noun="user"
          note={DEACTIVATE_NOTE}
          onConfirm={async () => {
            await save(confirming!);
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        />
      </PageContainer>
    </>
  );
}
