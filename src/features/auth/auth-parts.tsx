"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Measured from the auth references (01_1, 02_1.1, 03_1.2) inside the AuthLayout card: 14 px bold labels 8 px
// above 48 px fields, 50 px full-width primary buttons, a 1 px rule above the 13.5 px muted footer note.
export const labelClass = "text-sm leading-4 font-bold text-label";
export const inputClass = "h-12";
export const submitClass = "h-[50px] w-full pb-0.5";
export const linkClass = "font-bold text-primary hover:underline underline-offset-4";

/** Card title (the page's only h1) and its muted sub-line. */
export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h1 className="text-[27px] leading-[34px] font-bold">{title}</h1>
      <p className="mt-[5px] text-[15px] leading-[17px] text-muted-foreground">{description}</p>
    </>
  );
}

/** Muted note under a full-width rule at the bottom of the card. */
export function AuthNote({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("border-t pt-[18.5px] pb-[2.5px] text-center text-[13.5px] leading-[21px] text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Password field with the in-field "Show"/"Hide" toggle. While masked, the dots use the placeholder grey, as all
 * three references draw them. `label` completes the toggle's accessible name ("Show new password").
 */
export function PasswordInput({ label, className, ...props }: React.ComponentProps<"input"> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn(inputClass, "pr-16", !visible && "text-placeholder", className)}
        {...props}
      />
      <button
        type="button"
        aria-label={`${visible ? "Hide" : "Show"} ${label}`}
        aria-controls={props.id}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-[calc(50%+1.5px)] right-3.5 -translate-y-1/2 rounded-sm text-[13px] text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
