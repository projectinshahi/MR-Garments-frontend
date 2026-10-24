"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { AuthHeading, AuthNote, PasswordInput, inputClass, labelClass, linkClass, submitClass } from "./auth-parts";

/** Sign in (01_1_Login.jpeg). No backend: "Sign in" opens the dashboard without checking anything. */
export function LoginScreen() {
  const router = useRouter();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        router.push("/");
      }}
    >
      <AuthHeading title="Sign in" description="Use your MR Garments staff account." />
      <div className="mt-[26px] flex flex-col gap-[25px]">
        <Field>
          <FieldLabel htmlFor="login-email" className={labelClass}>
            Email or username
          </FieldLabel>
          <Input id="login-email" name="email" autoComplete="username" placeholder="name@mrgarments.com" className={inputClass} />
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
          />
        </Field>
      </div>
      <div className="mt-4 flex h-5 items-center justify-between gap-4">
        <Field orientation="horizontal" className="w-auto">
          <Checkbox id="keep-signed-in" name="keep-signed-in" className="size-4 rounded-sm" />
          <FieldLabel htmlFor="keep-signed-in" className="text-sm leading-5 font-normal text-muted-foreground">
            Keep me signed in
          </FieldLabel>
        </Field>
        <Link href="/forgot-password" className={`text-sm ${linkClass}`}>
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className={`mt-6 ${submitClass}`}>
        Sign in
      </Button>
      <AuthNote className="mt-[26px]">Need access? Ask your manager for an account.</AuthNote>
    </form>
  );
}
