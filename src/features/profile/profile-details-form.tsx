"use client";

import { useState } from "react";

import { SectionCard } from "@/components/shared/cards";
import { NativeSelect } from "@/components/shared/form";
import { notInPrototype } from "@/components/shared/prototype";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { ProfileDetails } from "./data/queries";
import { cardClass, fieldClass, inputClass, labelClass } from "./styles";

/** "My details": three columns; email, role and office are read-only (grey). */
export function ProfileDetailsForm({ details, languages }: { details: ProfileDetails; languages: string[] }) {
  // Mock mutation: client state only, resets on reload
  const [name, setName] = useState(details.name);
  const [phone, setPhone] = useState(details.phone);
  const [language, setLanguage] = useState(details.language);

  return (
    <SectionCard title="My details" titleGap="none" className={cardClass}>
      <form
        aria-label="My details"
        onSubmit={(event) => {
          event.preventDefault();
          notInPrototype("Save changes");
        }}
      >
        <FieldGroup className="mt-[12.5px] grid gap-x-4 gap-y-[13px] sm:grid-cols-3">
          <Field className={fieldClass}>
            <FieldLabel htmlFor="profile-name" className={labelClass}>
              Full name
            </FieldLabel>
            <Input
              id="profile-name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="profile-email" className={labelClass}>
              Email
            </FieldLabel>
            <Input id="profile-email" type="email" readOnly value={details.email} className={inputClass} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="profile-phone" className={labelClass}>
              Phone
            </FieldLabel>
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="profile-role" className={labelClass}>
              Role
            </FieldLabel>
            <Input id="profile-role" readOnly value={details.role} className={inputClass} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="profile-office" className={labelClass}>
              Office
            </FieldLabel>
            <Input id="profile-office" readOnly value={details.office} className={inputClass} />
          </Field>
          <Field className={fieldClass}>
            <FieldLabel htmlFor="profile-language" className={labelClass}>
              Language
            </FieldLabel>
            <NativeSelect id="profile-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </NativeSelect>
          </Field>
        </FieldGroup>
      </form>
    </SectionCard>
  );
}
