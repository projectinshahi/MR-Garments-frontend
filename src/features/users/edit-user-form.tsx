"use client";

import { useState } from "react";

import { Callout, SectionCard } from "@/components/shared/cards";
import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { StatusPill } from "@/components/shared/status-pill";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RecordStatus } from "@/types/domain";

import type { EditUserData } from "./data/queries";

const STATUSES: RecordStatus[] = ["Active", "Inactive"];

type FormField = "name" | "email" | "phone" | "role" | "office" | "language" | "password" | "status";

const labelClass = "gap-0.5 text-[13px] leading-[15px] font-bold text-label";
// The cards in 48 end 18 px below their last row (SectionCard pads 20).
const rowClass = "flex items-center border-b border-border-subtle py-[9px] last:border-0";

/** Add or edit user (48): user details, the stages the person can enter, and what the role can do. */
export function EditUserForm({ data }: { data: EditUserData }) {
  // Mock mutation: client state only, resets on reload
  const [form, setForm] = useState<Record<FormField, string>>({
    name: data.user.name,
    email: data.user.email,
    phone: data.phone,
    role: data.user.role,
    office: data.user.office,
    language: data.language,
    password: "",
    status: data.user.status,
  });
  // Mock mutation: client state only, resets on reload
  const [stages, setStages] = useState(() => new Set(data.stages.filter((s) => s.checked).map((s) => s.id)));

  const field = (key: FormField) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: event.target.value })),
  });
  const toggleStage = (id: string, checked: boolean) =>
    setStages((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="grid items-start gap-(--page-gap) lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-5">
        <SectionCard title="User details" titleGap="none" bottomGap="form">
          <div className="mt-[11px] grid gap-x-4 gap-y-[13px] sm:grid-cols-3">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="user-name" className={labelClass}>
                Full name <RequiredMark />
              </FieldLabel>
              <Input size="sm" id="user-name" required autoComplete="off" {...field("name")} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="user-email" className={labelClass}>
                Email <RequiredMark />
              </FieldLabel>
              <Input size="sm" id="user-email" type="email" required autoComplete="off" {...field("email")} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="user-phone" className={labelClass}>
                Phone
              </FieldLabel>
              <Input size="sm" id="user-phone" type="tel" autoComplete="off" {...field("phone")} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="user-role" className={labelClass}>
                Role <RequiredMark />
              </FieldLabel>
              <NativeSelect size="sm" id="user-role" required {...field("role")}>
                {data.roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="user-office" className={labelClass}>
                Office
              </FieldLabel>
              <NativeSelect size="sm" id="user-office" {...field("office")}>
                {data.offices.map((office) => (
                  <option key={office}>{office}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="user-language" className={labelClass}>
                Language
              </FieldLabel>
              <NativeSelect size="sm" id="user-language" {...field("language")}>
                {data.languages.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="user-password" className={labelClass}>
                Password
              </FieldLabel>
              <Input size="sm" id="user-password" type="password" autoComplete="new-password" placeholder={data.passwordPlaceholder} {...field("password")} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="user-status" className={labelClass}>
                Status
              </FieldLabel>
              <NativeSelect size="sm" id="user-status" {...field("status")}>
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Stages this person can enter data for" titleGap="none" bottomGap="form">
          <p className="mt-[3px] text-[12.5px] leading-[18px] text-muted-foreground">Entry staff see only the stages ticked here.</p>
          <ul className="mt-0.5">
            {data.stages.map((stage) => (
              <li key={stage.id} className={`${rowClass} gap-2`}>
                <Checkbox
                  id={`stage-${stage.id}`}
                  checked={stages.has(stage.id)}
                  onCheckedChange={(checked) => toggleStage(stage.id, checked === true)}
                />
                <Label htmlFor={`stage-${stage.id}`} className="text-sm leading-5 font-normal">
                  {stage.label}
                </Label>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="What this role can do" titleGap="none" bottomGap="form">
        {/* 13.5 px text as in Callout size="sm"; the reference pads it 11.5 px vertically (sm pads 10). */}
        <Callout size="sm" className="mt-3 py-[11.5px]">
          {data.roleCard.summary}
        </Callout>
        <ul className="mt-[11px]">
          {data.roleCard.abilities.map((ability) => (
            <li key={ability.label} className={`${rowClass} justify-between gap-4 text-sm`}>
              {ability.label}
              <StatusPill tone={ability.access === "Enter" ? "success" : "neutral"}>{ability.access}</StatusPill>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
