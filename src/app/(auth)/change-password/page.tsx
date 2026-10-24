import type { Metadata } from "next";

import { ChangePasswordScreen } from "@/features/auth/change-password-screen";
import { getChangePassword } from "@/features/auth/data/queries";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const data = await getChangePassword();
  return <ChangePasswordScreen data={data} />;
}
