import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Static rule copy from 03_1.2_Change_password.jpeg.
const RULES = [
  { label: "At least 8 characters", test: (password: string) => password.length >= 8 },
  { label: "One number", test: (password: string) => /\d/.test(password) },
  { label: "One capital letter", test: (password: string) => /[A-Z]/.test(password) },
];

export const STRENGTH_SEGMENTS = 4;

/** The three rules, plus one strength point for 12 or more characters: 0 to 4 meter segments. */
export function passwordStrength(password: string) {
  const rules = RULES.map(({ label, test }) => ({ label, met: test(password) }));
  const score = rules.filter((rule) => rule.met).length + (password.length >= 12 ? 1 : 0);
  return { rules, score };
}

/** 03's strength meter and rule list for a password being typed. The API checks the rules itself (B9.10). */
export function PasswordStrength({ password, className }: { password: string; className?: string }) {
  const { rules, score } = passwordStrength(password);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
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
    </div>
  );
}
