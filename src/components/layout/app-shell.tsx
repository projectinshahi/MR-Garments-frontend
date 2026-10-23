import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import type { CurrentUser } from "@/types/domain";

/** Sidebar plus content column. Pages render their own PageHeader (68 px bar) and PageContainer. */
export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <AppSidebar user={user} />
      <MobileNav user={user} />
      <div className="flex min-h-svh flex-col md:pl-(--sidebar-width)">{children}</div>
    </div>
  );
}
