import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppSidebar, MobileNav, type ShellUser, SidebarFallback } from "@/components/layout/app-sidebar";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { SampleDataNotice } from "@/components/layout/sample-data-notice";
import { LoadingState } from "@/components/shared/states";
import { navFor, SESSION_ENDED_URL, userDetail } from "@/config/navigation";
import { getMe } from "@/lib/session";

/**
 * Sidebar plus content column. Pages render their own PageHeader (68 px bar) and PageContainer.
 * Batch 1: the sidebar is built from the signed-in user (ME-1) inside its own Suspense boundary, so the page content
 * never waits for it (Cache Components: session reads stay out of the layout's top level).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <NavigationProgress />
      <Suspense fallback={<SidebarFallback />}>
        <ShellNavigation />
      </Suspense>
      <div className="flex min-h-svh flex-col md:pl-(--sidebar-width)">
        {/* Reads the pathname, which dynamic routes such as /orders/[po] only know at request time. */}
        <Suspense fallback={null}>
          <SampleDataNotice />
        </Suspense>
        {/* The page-load spinner. Being in the shared layout, it never shows on a client navigation: the current page
            stays until the next one is ready (a route loading.tsx showed a spinner for at least ~350 ms each time,
            React's minimum before a fallback may be replaced). The clicked sidebar link shows the wait instead. */}
        <Suspense fallback={<LoadingState />}>{children}</Suspense>
      </div>
    </div>
  );
}

async function ShellNavigation() {
  const me = await getMe();
  if (!me) redirect(SESSION_ENDED_URL);
  const user: ShellUser = { name: me.name, initials: me.initials, detail: userDetail(me), sections: navFor(me) };
  return (
    <>
      <AppSidebar user={user} />
      <MobileNav user={user} />
    </>
  );
}
