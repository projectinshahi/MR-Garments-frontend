import type { Metadata } from "next";

import { getForgotPassword } from "@/features/auth/data/queries";
import { ForgotPasswordScreen } from "@/features/auth/forgot-password-screen";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const data = await getForgotPassword();
  return <ForgotPasswordScreen data={data} />;
}
