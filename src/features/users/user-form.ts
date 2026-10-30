import { z } from "zod";

import { MESSAGES } from "@/lib/feedback";
import type { Role } from "@/types/domain";

import type { UserDetail } from "./data/queries";

/** The stage ticks on 48 (stages 2-6), labelled as drawn. */
export const STAGE_OPTIONS = [
  { stage: 2, label: "Receiving (China)" },
  { stage: 3, label: "Container loading" },
  { stage: 4, label: "Clearing (India)" },
  { stage: 5, label: "Transport" },
  { stage: 6, label: "Warehouse" },
] as const;

/** Form fields, in screen order. The names match the API's, so its `fields` errors land on them (E1-E3). */
export const FORM_FIELDS = ["name", "email", "phone", "role", "officeId", "language", "password", "status", "stages"] as const;

// The browser checks only what it can know (M13, M14, M16, and a password on Add user); the API checks everything,
// including M15, M17-M20 and the password rules (M8, M9).
export const userFormSchema = z.object({
  name: z.string().trim().min(1, MESSAGES.fullNameEmpty),
  email: z.string().trim().pipe(z.email(MESSAGES.emailInvalid)),
  phone: z.string(),
  // The select only offers the API's roles (or nothing yet, on Add user).
  role: z.custom<Role | "">().refine(Boolean, MESSAGES.roleEmpty),
  officeId: z.string(),
  language: z.string(),
  status: z.enum(["Active", "Inactive"]),
  stages: z.array(z.number()),
  // Edit user: optional, empty keeps the current password. Never trimmed.
  password: z.string(),
});
/** Add user: Management types the user's initial password (password policy). */
export const newUserFormSchema = userFormSchema.extend({ password: z.string().min(1, MESSAGES.passwordEmpty) });
export type UserFormValues = z.infer<typeof userFormSchema>;

/** Edit: the user's values. Add: an empty form, active, English, no office, no stages. */
export const toFormValues = (user: UserDetail | null): UserFormValues =>
  user
    ? {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        officeId: user.officeId ?? "",
        language: user.language,
        status: user.status,
        stages: user.stages,
        password: "",
      }
    : { name: "", email: "", phone: "", role: "", officeId: "", language: "English", status: "Active", stages: [], password: "" };

/** The USR-3/USR-4 body. The password goes only when one was typed (always on Add user). */
export const toPayload = ({ officeId, password, ...values }: UserFormValues) => ({
  ...values,
  officeId: officeId || null,
  ...(password ? { password } : {}),
});

export const toggleStage = (stages: number[], stage: number, checked: boolean) =>
  checked ? [...new Set([...stages, stage])].sort((a, b) => a - b) : stages.filter((s) => s !== stage);
