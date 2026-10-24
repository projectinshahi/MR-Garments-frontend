"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { AuthHeading, PasswordInput, labelClass, linkClass, submitClass } from "./auth-parts";
import type { ChangePasswordData } from "./data/queries";
import { STRENGTH_SEGMENTS, passwordStrength } from "./password-strength";

const FIELDS = [
  { key: "current", id: "current-password", label: "Current password", autoComplete: "current-password" },
  { key: "next", id: "new-password", label: "New password", autoComplete: "new-password" },
  { key: "confirm", id: "confirm-password", label: "Confirm new password", autoComplete: "new-password" },
] as const;

/** Change password (03_1.2_Change_password.jpeg), prefilled so the meter shows 3 of 4 with 2 of 3 rules met. */
export function ChangePasswordScreen({ data }: { data: ChangePasswordData }) {
  // Mock mutation: client state only, resets on reload
  const [values, setValues] = useState(data);
  const { rules, score } = passwordStrength(values.next);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        notInPrototype("Save new password");
      }}
    >
      <AuthHeading title="Change password" description="Choose a new password for your account." />
      <div className="mt-[26px] flex flex-col gap-[25px]">
        {FIELDS.map((field) => (
          <Field key={field.key}>
            <FieldLabel htmlFor={field.id} className={labelClass}>
              {field.label}
            </FieldLabel>
            <PasswordInput
              id={field.id}
              name={field.id}
              label={field.label.toLowerCase()}
              autoComplete={field.autoComplete}
              value={values[field.key]}
              onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
            />
            {field.key === "next" && (
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
        ))}
      </div>
      <Button type="submit" size="lg" className={`mt-[26px] ${submitClass}`}>
        Save new password
      </Button>
      <p className="mt-[18px] text-center text-sm leading-4">
        <Link href="/profile" className={linkClass}>
          Cancel
        </Link>
      </p>
    </form>
  );
}
