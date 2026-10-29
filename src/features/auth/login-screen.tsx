"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";
import { handleApiError, MESSAGES } from "@/lib/feedback";

import { AuthHeading, AuthNote, PasswordInput, inputClass, labelClass, submitClass } from "./auth-parts";

/**
 * Sign in (01_1_Login.jpeg), AUTH-1. Success loads the landing page in full so the session-driven shell loads (K1).
 * Problems show as one line in the field-error style (U36): M1 before any request, M2/M3 above the button (E4, E5),
 * M4 above the form when the session ended (E6, E7); anything else goes to handleApiError (M23/M24 toasts).
 */
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [attempted, setAttempted] = useState(false);

  const signIn = async () => {
    setAttempted(true);
    if (!email.trim() || !password) {
      setMessage(MESSAGES.signInEmpty);
      return;
    }
    setMessage(undefined);
    setPending(true);
    try {
      const { user } = await apiClient.post<{ user: Me }>("/auth/login", { email, password, keepSignedIn });
      // Replace, so Back never returns to this used form. The button stays disabled until the page changes.
      window.location.replace(user.landing);
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError && (error.status === 401 || error.status === 429)) {
        setMessage(error.status === 401 ? MESSAGES.signInWrong : MESSAGES.tooManyAttempts);
        setPassword("");
        return;
      }
      // 422 carries the approved message for the field (M1, M2); show it on the same line.
      const fields = handleApiError(error);
      if (fields) setMessage(Object.values(fields)[0]);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void signIn();
      }}
    >
      <AuthHeading title="Sign in" description="Use your MR Garments staff account." />
      {/* Only this notice reads the URL, so the rest of the form stays in the prerendered page. */}
      <Suspense fallback={null}>{attempted ? null : <SessionEndedNotice />}</Suspense>
      <div className="mt-[26px] flex flex-col gap-[25px]">
        <Field>
          <FieldLabel htmlFor="login-email" className={labelClass}>
            Email or username
          </FieldLabel>
          <Input
            id="login-email"
            name="email"
            autoComplete="username"
            placeholder="name@mrgarments.com"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="login-password" className={labelClass}>
            Password
          </FieldLabel>
          <PasswordInput
            id="login-password"
            name="password"
            label="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </div>
      <div className="mt-4 flex h-5 items-center justify-between gap-4">
        <Field orientation="horizontal" className="w-auto">
          <Checkbox
            id="keep-signed-in"
            name="keep-signed-in"
            className="size-4 rounded-sm"
            checked={keepSignedIn}
            onCheckedChange={(checked) => setKeepSignedIn(checked === true)}
          />
          <FieldLabel htmlFor="keep-signed-in" className="text-sm leading-5 font-normal text-muted-foreground">
            Keep me signed in
          </FieldLabel>
        </Field>
      </div>
      <FieldError className="mt-4">{message}</FieldError>
      <Button type="submit" size="lg" className={`mt-6 ${submitClass}`} disabled={pending}>
        Sign in
      </Button>
      {/* Password policy: no self-service reset; Management sets passwords on Add/Edit user. */}
      <AuthNote className="mt-[26px]">Forgot your password or need an account? Ask a Management user.</AuthNote>
    </form>
  );
}

/** M4 when the proxy or an action sent the user here because the session ended (E6, E7). */
function SessionEndedNotice() {
  const ended = useSearchParams().get("reason") === "session-ended";
  return ended ? <FieldError className="mt-4">{MESSAGES.sessionEnded}</FieldError> : null;
}
