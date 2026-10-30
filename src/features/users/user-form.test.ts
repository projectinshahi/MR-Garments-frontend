import { describe, expect, it } from "vitest";

import type { UserDetail } from "./data/queries";
import { newUserFormSchema, toFormValues, toggleStage, toPayload, userFormSchema } from "./user-form";

const wang: UserDetail = {
  id: "u-wang",
  name: "Wang Fang",
  email: "wang@mrgarments.com",
  phone: "",
  role: "China staff",
  officeId: "loc-gz",
  office: "Guangzhou office",
  language: "English",
  status: "Active",
  stages: [2, 3],
  lastSignInAt: null,
};

describe("user form mapping", () => {
  it("starts from the user, or an empty active form for Add user", () => {
    expect(toFormValues(wang)).toEqual({
      name: "Wang Fang",
      email: "wang@mrgarments.com",
      phone: "",
      role: "China staff",
      officeId: "loc-gz",
      language: "English",
      status: "Active",
      stages: [2, 3],
      password: "",
    });
    expect(toFormValues({ ...wang, officeId: null }).officeId).toBe("");
    expect(toFormValues(null)).toEqual({ name: "", email: "", phone: "", role: "", officeId: "", language: "English", status: "Active", stages: [], password: "" });
  });

  it("sends no office as null, and a password only when one was typed (untrimmed)", () => {
    const payload = toPayload({ ...toFormValues(wang), officeId: "" });
    expect(payload).toEqual({ name: "Wang Fang", email: "wang@mrgarments.com", phone: "", role: "China staff", officeId: null, language: "English", status: "Active", stages: [2, 3] });
    expect("password" in payload).toBe(false);
    expect(toPayload(toFormValues(wang)).officeId).toBe("loc-gz");
    expect(toPayload({ ...toFormValues(wang), password: " Ledger2026x " }).password).toBe(" Ledger2026x ");
  });

  it("ticks and unticks stages in order", () => {
    expect(toggleStage([3], 2, true)).toEqual([2, 3]);
    expect(toggleStage([2, 3], 3, true)).toEqual([2, 3]);
    expect(toggleStage([2, 3], 3, false)).toEqual([2]);
  });
});

describe("userFormSchema", () => {
  it("checks the required fields with the approved messages (M13, M14, M16)", () => {
    const result = userFormSchema.safeParse({ ...toFormValues(null), name: "  ", email: "nope" });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]));
    expect(messages).toEqual({ name: "Enter the full name.", email: "Enter a valid email address.", role: "Choose a role." });
    expect(userFormSchema.safeParse(toFormValues(wang)).success).toBe(true);
  });

  it("needs a password on Add user only; the API checks its rules", () => {
    const filled = { ...toFormValues(null), name: "Test User", email: "test@mrgarments.com", role: "China staff" as const };
    expect(newUserFormSchema.safeParse(filled).error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([["password", "Enter a password."]]);
    expect(newUserFormSchema.safeParse({ ...filled, password: "weak" }).success).toBe(true);
    expect(userFormSchema.safeParse(filled).success).toBe(true);
  });
});
