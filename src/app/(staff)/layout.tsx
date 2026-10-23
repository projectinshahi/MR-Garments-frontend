import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/data/master";

// Role-specific exception to D6: the entry-only staff sidebar (reference 39).
export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser("staff");
  return <AppShell user={user}>{children}</AppShell>;
}
