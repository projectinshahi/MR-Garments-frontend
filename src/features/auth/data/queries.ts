import * as fixtures from "./fixtures";

export type ForgotPasswordData = Awaited<ReturnType<typeof getForgotPassword>>;

/** Forgot password form values. Async and copied so a real API can replace it. */
export async function getForgotPassword() {
  return structuredClone(fixtures.forgotPassword);
}
