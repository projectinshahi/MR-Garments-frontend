import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/data/master";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser("management");
  return <AppShell user={user}>{children}</AppShell>;
}
