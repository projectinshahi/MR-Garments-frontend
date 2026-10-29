"use client";

import { Menu } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, useReportPending } from "@/components/layout/navigation-progress";
import { SignOutMenuItem } from "@/components/layout/sign-out";
import { isActivePath, type NavSection, USER_MENU } from "@/config/navigation";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
/** The signed-in user as the shell shows it (B2, B3): built by AppShell from ME-1. */
export type ShellUser = { name: string; initials: string; detail: string; sections: NavSection[] };

type SidebarProps = { user: ShellUser };

/** Fixed 240 px desktop sidebar (references 4–53). Hidden below md, where MobileNav opens the same content. */
export function AppSidebar({ user }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-width) md:block">
      <SidebarContent user={user} />
    </aside>
  );
}

/** Below md only (not designed): a compact bar with a menu button that opens the sidebar in a sheet. */
export function MobileNav({ user }: SidebarProps) {
  // The shell stays mounted across navigation, so the sheet closes itself when a link in it is followed.
  const [open, setOpen] = useState(false);
  // The sheet's links unmount as it closes, so this bar, which stays, runs their navigation: the progress bar
  // follows it until the page is on screen.
  const navigate = useNavigate();
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-sidebar-from px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-white hover:bg-sidebar-accent" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-(--sidebar-width) border-0 p-0 [&>button]:text-white"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false);
          }}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent user={user} navigate={navigate} />
        </SheetContent>
      </Sheet>
      <Brand compact />
    </div>
  );
}

/** Shown while the signed-in user loads: the empty sidebar and mobile bar, so the layout doesn't shift. */
export function SidebarFallback() {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-width) bg-linear-to-b from-sidebar-from to-sidebar-to md:block">
        <div className="px-6 pt-[26px] pb-[26px]">
          <Brand />
        </div>
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center bg-sidebar-from px-4 pl-14 md:hidden">
        <Brand compact />
      </div>
    </>
  );
}

/** `navigate`: takes over the nav links' navigation (the mobile sheet); without it they navigate themselves. */
type Navigate = (href: string) => void;

function SidebarContent({ user, navigate }: SidebarProps & { navigate?: Navigate }) {
  const { sections } = user;
  return (
    <div className="flex h-full flex-col bg-linear-to-b from-sidebar-from to-sidebar-to text-sidebar-foreground">
      <div className="px-6 pt-[26px] pb-[26px]">
        <Brand />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto">
        {/* usePathname suspends on routes with unknown dynamic params (cacheComponents). */}
        <Suspense fallback={<NavSections sections={sections} pathname={null} navigate={navigate} />}>
          <ActiveNavSections sections={sections} navigate={navigate} />
        </Suspense>
      </nav>
      <UserMenu user={user} />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-[13px] rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <span
        className={cn(
          "flex items-center justify-center rounded-lg bg-primary font-bold text-white",
          compact ? "size-8 text-xs" : "size-[38px] text-sm",
        )}
      >
        MR
      </span>
      <span className="text-[17px] font-bold text-white">{APP_NAME}</span>
    </Link>
  );
}

function ActiveNavSections({ sections, navigate }: { sections: NavSection[]; navigate?: Navigate }) {
  return <NavSections sections={sections} pathname={usePathname()} navigate={navigate} />;
}

function NavSections({ sections, pathname, navigate }: { sections: NavSection[]; pathname: string | null; navigate?: Navigate }) {
  return (
    // Label block 34 px + 2 px gaps keeps the reference's 38 px item pitch across section breaks.
    <div className="flex flex-col gap-0.5 px-4">
      {sections.map((section, index) => (
        <Fragment key={section.label ?? index}>
          {section.label ? (
            <p className="h-[34px] pt-[15px] pl-[13px] text-[11px] leading-[13px] tracking-[0.16em] text-sidebar-muted uppercase">
              {section.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // Cancels the link's own navigation, so only `navigate` runs it (no second navigation).
                    onNavigate={
                      navigate
                        ? (event) => {
                            event.preventDefault();
                            navigate(item.href);
                          }
                        : undefined
                    }
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      // pb-0.5 lifts the label 1 px to the reference baseline; the 36 px box itself is unchanged.
                      "flex h-9 items-center gap-[13px] rounded-lg px-3 pb-0.5 text-[14.4px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "bg-sidebar-accent font-bold text-white" : "hover:bg-sidebar-accent/50",
                    )}
                  >
                    <NavBullet active={active} />
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Fragment>
      ))}
    </div>
  );
}

/** The item's square; it lights up while its page loads (after 100 ms, so a fast navigation shows nothing). */
function NavBullet({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  useReportPending(pending);
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className={cn(
        "size-2 shrink-0 rounded-[2px] transition-colors delay-100",
        pending ? "animate-pulse bg-white" : active ? "bg-primary" : "bg-sidebar-bullet",
      )}
    />
  );
}

function UserMenu({ user }: SidebarProps) {
  return (
    <div className="mx-4 border-t border-sidebar-border px-2 pt-3 pb-[38px]">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-sidebar-avatar text-[13px] font-bold text-white">
            {user.initials}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13.6px] leading-[17px] font-bold text-white">{user.name}</span>
            <span className="truncate text-xs leading-4 text-sidebar-detail">{user.detail}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-52">
          {USER_MENU.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>{item.title}</Link>
            </DropdownMenuItem>
          ))}
          <SignOutMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
