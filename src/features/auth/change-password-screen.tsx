"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { apiClient } from "@/lib/api/client";
import { handleApiError, notifySuccess, SUCCESS } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { AuthHeading, PasswordInput, labelClass, linkClass, submitClass } from "./auth-parts";
import { STRENGTH_SEGMENTS, passwordStrength } from "./password-strength";

/** A password field of 03. `name` is the API's field name, so `fields` from the API map straight onto it. */
export type PasswordFieldDef = { name: string; id: string; label: string; autoComplete: string };
export type FieldErrors = Record<string, string | undefined>;

/** Moves focus to the first field with a problem (E1). Scoped to the form, as hidden <Activity> routes stay mounted. */
export function focusFirstError(form: HTMLFormElement, fields: readonly PasswordFieldDef[], errors: FieldErrors) {
  const first = fields.find((field) => errors[field.name]);
  if (first) form.querySelector<HTMLInputElement>(`#${first.id}`)?.focus();
}

/** The labelled Show/Hide fields of 03, each with its error (E1); the strength meter and rules sit under `newPassword`. */
export function PasswordFields({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: readonly PasswordFieldDef[];
  values: Record<string, string>;
  errors: FieldErrors;
  onChange: (name: string, value: string) => void;
}) {
  const { rules, score } = passwordStrength(values.newPassword ?? "");
  return (
    <div className="mt-[26px] flex flex-col gap-[25px]">
      {fields.map((field) => {
        const error = errors[field.name];
        return (
          <Field key={field.name} data-invalid={!!error}>
            <FieldLabel htmlFor={field.id} className={labelClass}>
              {field.label}
            </FieldLabel>
            <PasswordInput
              id={field.id}
              name={field.id}
              label={field.label.toLowerCase()}
              autoComplete={field.autoComplete}
              value={values[field.name] ?? ""}
              aria-invalid={!!error}
              aria-describedby={error ? `${field.id}-error` : undefined}
              onChange={(event) => onChange(field.name, event.target.value)}
            />
            <FieldError id={`${field.id}-error`}>{error}</FieldError>
            {field.name === "newPassword" && (
              <>
                <div
                  role="meter"
                  aria-label="Password strength"
                  aria-valuemin={0}
                  aria-valuemax={STRENGTH_SEGMENTS}
                  aria-valuenow={score}
                  aria-valuetext={`${score} of ${STRENGTH_SEGMENTS}`}
                  className="mt-0.5 flex gap-1.5"
                >
                  {Array.from({ length: STRENGTH_SEGMENTS }, (_, i) => (
                    <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < score ? "bg-success-strong" : "bg-chip-muted")} />
                  ))}
                </div>
                <ul aria-label="Password rules" className="flex flex-col gap-2">
                  {rules.map((rule) => (
                    <li key={rule.label} className="flex h-[18px] items-center gap-2.5 text-sm text-label">
                      <span
                        className={cn(
                          "flex size-[18px] shrink-0 items-center justify-center rounded-full",
                          rule.met ? "bg-success-soft text-success" : "bg-chart-track",
                        )}
                      >
                        {rule.met ? (
                          <CheckIcon aria-hidden className="size-2.5" strokeWidth={3.5} />
                        ) : (
                          <span aria-hidden className="size-0.5 rounded-full bg-placeholder" />
                        )}
                        <span className="sr-only">{rule.met ? "Met: " : "Not met: "}</span>
                      </span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Field>
        );
      })}
    </div>
  );
}

const FIELDS = [
  { name: "currentPassword", id: "current-password", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", id: "new-password", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", id: "confirm-password", label: "Confirm new password", autoComplete: "new-password" },
] as const;

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

/**
 * Change password (03_1.2_Change_password.jpeg) through AUTH-5. The fields start empty (the reference's example
 * values can't be prefilled into a real password form). Success: "Password changed", then /profile (K3).
 */
export function ChangePasswordScreen() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function submit(form: HTMLFormElement) {
    setPending(true);
    setErrors({});
    try {
      await apiClient.post("/auth/change-password", values);
      // The route stays mounted after leaving (<Activity>), so clear the passwords.
      setValues(EMPTY);
      notifySuccess(SUCCESS.passwordChanged);
      router.push("/profile");
    } catch (error) {
      const fields = handleApiError(error);
      if (fields) {
        setErrors(fields);
        focusFirstError(form, FIELDS, fields);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <AuthHeading title="Change password" description="Choose a new password for your account." />
      <PasswordFields
        fields={FIELDS}
        values={values}
        errors={errors}
        onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
      />
      <Button type="submit" size="lg" disabled={pending} className={`mt-[26px] ${submitClass}`}>
        Save new password
      </Button>
      <p className="mt-[18px] text-center text-sm leading-4">
        <Link
          href="/profile"
          className={linkClass}
          onClick={() => {
            setValues(EMPTY);
            setErrors({});
          }}
        >
          Cancel
        </Link>
      </p>
    </form>
  );
}
