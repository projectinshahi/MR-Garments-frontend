import * as fixtures from "./fixtures";

export type ForgotPasswordData = Awaited<ReturnType<typeof getForgotPassword>>;
export type ChangePasswordData = Awaited<ReturnType<typeof getChangePassword>>;

/** Forgot password form values. Async and copied so a real API can replace it. */
export async function getForgotPassword() {
  return structuredClone(fixtures.forgotPassword);
}

/** Change password form values, prefilled as in the reference. */
export async function getChangePassword() {
  return structuredClone(fixtures.changePassword);
}
