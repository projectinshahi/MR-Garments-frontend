"use client";

import Link from "next/link";

import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { AuthHeading, AuthNote, inputClass, labelClass, linkClass, submitClass } from "./auth-parts";
import type { ForgotPasswordData } from "./data/queries";

/** Forgot password (02_1.1_Forgot_password.jpeg). No "sent" state is designed, so the action is D5. */
export function ForgotPasswordScreen({ data }: { data: ForgotPasswordData }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        notInPrototype("Send reset link");
      }}
    >
      <AuthHeading
        title="Forgot your password?"
        description="Enter your email or username. We will send a link to reset your password."
      />
      <Field className="mt-[26px]">
        <FieldLabel htmlFor="reset-email" className={labelClass}>
          Email or username
        </FieldLabel>
        {/* Mock mutation: client state only, resets on reload */}
        <Input id="reset-email" name="email" autoComplete="username" defaultValue={data.email} className={inputClass} />
      </Field>
      <Button type="submit" size="lg" className={`mt-[26px] ${submitClass}`}>
        Send reset link
      </Button>
      <p className="mt-5 text-center text-sm leading-5">
        <Link href="/login" className={linkClass}>
          {/* The reference draws a small, light arrow: 8.5 px wide, 7.5 px before the text. */}
          <span aria-hidden className="mr-1.5 text-[9px] leading-none font-normal">
            ←
          </span>
          Back to sign in
        </Link>
      </p>
      <AuthNote className="mt-6">If you do not get an email in a few minutes, ask your manager to reset it for you.</AuthNote>
    </form>
  );
}
