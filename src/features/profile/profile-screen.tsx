"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/layout/sign-out";
import { SectionCard } from "@/components/shared/cards";
import { NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import type { Profile, UpdateProfileBody, UpdateProfileResponse } from "@/lib/api/types";
import { handleApiError, MESSAGES, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";

import { cardClass, fieldClass, labelClass, outlineButtonClass, rowDetailClass, rowTitleClass } from "./styles";

const FORM_ID = "profile-form";
/** The keys PRF-2 accepts, in screen order, so the first API field error gets the focus. */
const EDITABLE = ["name", "phone", "language"] as const;

// Proposed wording.
export const PROFILE_TEXT = {
  saved: "Profile saved",
  notifications: "Choosing which notifications you get isn't available yet. All of yours appear on the Notifications page.",
};

// The browser checks only M13, as the Users form does; the API checks everything again.
const profileSchema = z.object({ name: z.string().trim().min(1, MESSAGES.fullNameEmpty), phone: z.string().trim(), language: z.string() });
type ProfileValues = z.infer<typeof profileSchema>;

const toValues = ({ name, phone, language }: Profile): ProfileValues => ({ name, phone, language });

/**
 * My profile (51_17.2): the signed-in user's own details from PRF-1. Name, phone and language save through PRF-2 (the
 * header's Save changes submits the form); email, role and office are read-only. API field errors show under their
 * fields with focus on the first, and the typed values stay when a save fails. No password change and no
 * notification switches here: the password card only says when it last changed.
 */
export function ProfileScreen({ profile, languages }: { profile: Profile; languages: string[] }) {
  const router = useRouter();
  const { register, handleSubmit, reset, setError, formState } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toValues(profile),
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async ({ name, phone, language }) => {
    let saved: Profile;
    try {
      ({ profile: saved } = await apiClient.patch<UpdateProfileResponse>("/profile", { name, phone, language } satisfies UpdateProfileBody));
    } catch (error) {
      const fields = handleApiError(error) ?? {};
      EDITABLE.filter((key) => fields[key]).forEach((key, index) =>
        setError(key, { type: "server", message: fields[key] }, { shouldFocus: index === 0 }),
      );
      return;
    }
    notifySuccess(PROFILE_TEXT.saved);
    reset(toValues(saved));
    // The sidebar's name comes from ME-1, read on the server.
    router.refresh();
  });

  return (
    <>
      <PageHeader
        title="My profile"
        actions={
          // 34 px tall like size="header", with the 16 px side padding measured in 51_17.2.
          <Button type="submit" form={FORM_ID} size="header" className="px-4" disabled={isSubmitting}>
            Save changes
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <SectionCard title="My details" titleGap="none" bottomGap="form" className={cardClass}>
              <form id={FORM_ID} aria-label="My details" noValidate onSubmit={onSubmit}>
                <FieldGroup className="mt-[12.5px] grid gap-x-4 gap-y-[13px] sm:grid-cols-3">
                  <Field className={fieldClass} data-invalid={!!errors.name}>
                    <FieldLabel htmlFor="profile-name" className={labelClass}>
                      Full name
                    </FieldLabel>
                    <Input id="profile-name" autoComplete="name" required aria-invalid={!!errors.name} size="sm" {...register("name")} />
                    <FieldError errors={[errors.name]} />
                  </Field>
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="profile-email" className={labelClass}>
                      Email
                    </FieldLabel>
                    <Input id="profile-email" type="email" readOnly value={profile.email} size="sm" />
                  </Field>
                  <Field className={fieldClass} data-invalid={!!errors.phone}>
                    <FieldLabel htmlFor="profile-phone" className={labelClass}>
                      Phone
                    </FieldLabel>
                    <Input id="profile-phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} size="sm" {...register("phone")} />
                    <FieldError errors={[errors.phone]} />
                  </Field>
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="profile-role" className={labelClass}>
                      Role
                    </FieldLabel>
                    <Input id="profile-role" readOnly value={profile.role} size="sm" />
                  </Field>
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="profile-office" className={labelClass}>
                      Office
                    </FieldLabel>
                    {/* Empty for no office: the Head office is deferred (U28), as on Users. */}
                    <Input id="profile-office" readOnly value={profile.office?.name ?? ""} size="sm" />
                  </Field>
                  <Field className={fieldClass} data-invalid={!!errors.language}>
                    <FieldLabel htmlFor="profile-language" className={labelClass}>
                      Language
                    </FieldLabel>
                    <NativeSelect size="sm" id="profile-language" aria-invalid={!!errors.language} {...register("language")}>
                      {languages.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </NativeSelect>
                    <FieldError errors={[errors.language]} />
                  </Field>
                </FieldGroup>
              </form>
            </SectionCard>

            <SectionCard title="Password" titleGap="none" bottomGap="form" className={cardClass}>
              <div className="mt-[13.5px] min-w-0">
                <p className={rowTitleClass}>Password</p>
                <p className={rowDetailClass}>
                  {/* The date in India, so the server and the browser render the same text. */}
                  {profile.passwordChangedAt ? `Last changed ${formatDate(todayInIndia(new Date(profile.passwordChangedAt)))}` : "Not set"}
                </p>
                {/* Password policy: nobody changes their own password in the app. */}
                <p className={rowDetailClass}>To change it, ask a Management user.</p>
              </div>
            </SectionCard>
          </div>

          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            {/* No backend for notification preferences, so no switches that pretend to save. */}
            <SectionCard title="Notifications" titleGap="none" bottomGap="form" className={cardClass}>
              <p className="mt-[13px] text-[12.5px] leading-[18px] text-muted-foreground">{PROFILE_TEXT.notifications}</p>
            </SectionCard>
            <SignOutButton className={cn("h-11 w-full", outlineButtonClass)} />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
