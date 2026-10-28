import type { Metadata } from "next";

import { SetPasswordScreen } from "@/features/auth/set-password-screen";

export const metadata: Metadata = { title: "Set password" };

export default function SetPasswordPage() {
  return <SetPasswordScreen />;
}
