"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { apiClient } from "@/lib/api/client";
import { handleApiError, MESSAGES, notifySuccess, SUCCESS } from "@/lib/feedback";

import { AuthHeading, linkClass, submitClass } from "./auth-parts";
import { type FieldErrors, PasswordFields, focusFirstError } from "./change-password-screen";

// Own ids, so they never clash with Change password's fields while both routes stay mounted (<Activity>).
const FIELDS = [
  { name: "newPassword", id: "set-new-password", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", id: "set-confirm-password", label: "Confirm new password", autoComplete: "new-password" },
] as const;

const EMPTY = { newPassword: "", confirmPassword: "" };

/** Browser checks before AUTH-4, which takes no confirmation: M7 for an empty password, M10/M11 for the confirmation. */
export function setPasswordProblems({ newPassword, confirmPassword }: typeof EMPTY): FieldErrors {
  const errors: FieldErrors = {};
  if (!newPassword) errors.newPassword = MESSAGES.newPasswordEmpty;
  if (!confirmPassword) errors.confirmPassword = MESSAGES.confirmEmpty;
  else if (confirmPassword !== newPassword) errors.confirmPassword = MESSAGES.confirmMismatch;
  return errors;
}

/**
 * Set password (B1 b): 03's layout without "Current password", opened from an invite or reset link
 * (/set-password?token=…). The link is checked only on submit (B1.7). Success: the K4 toast, then /login.
 */
export function SetPasswordScreen() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(form: HTMLFormElement) {
    setLinkInvalid(false);
    const problems = setPasswordProblems(values);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      focusFirstError(form, FIELDS, problems);
      return;
    }
    setPending(true);
    try {
      const token = new URLSearchParams(window.location.search).get("token") ?? "";
      await apiClient.post("/auth/reset-password", { token, newPassword: values.newPassword });
      // The route stays mounted after leaving (<Activity>), so clear the passwords.
      setValues(EMPTY);
      notifySuccess(SUCCESS.passwordSet);
      router.push("/login");
    } catch (error) {
      if (error instanceof ApiError && error.code === "token_invalid") {
        setLinkInvalid(true);
        return;
      }
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
      <AuthHeading title="Set your password" description="Choose a password for your account." />
      {linkInvalid && (
        <p role="alert" className="mt-[18px] text-sm text-destructive">
          {MESSAGES.linkInvalid}
        </p>
      )}
      <PasswordFields
        fields={FIELDS}
        values={values}
        errors={errors}
        onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
      />
      <Button type="submit" size="lg" disabled={pending} className={`mt-[26px] ${submitClass}`}>
        Save password
      </Button>
      <p className="mt-[18px] text-center text-sm leading-4">
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
