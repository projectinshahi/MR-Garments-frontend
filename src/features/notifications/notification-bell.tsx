"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { apiClient } from "@/lib/api/client";
import type { Notification, NotificationsPage } from "@/lib/api/types";
import { handleApiError } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import type { Viewer } from "./notification-filter";
import { NotificationList } from "./notification-list";
import { markAllRead, markRead, setUnreadCount, useUnreadCount } from "./notifications-client";

type Panel = { status: "loading" } | { status: "error" } | { status: "ready"; items: Notification[]; now: Date };

/** "9+" past nine, so the badge keeps its size. */
export const badgeText = (unread: number) => (unread > 9 ? "9+" : String(unread));

/**
 * The shell's bell (sidebar user block on desktop, top bar on mobile): the unread count (NTF-2), and a panel with the
 * latest 10 (NTF-1), loaded each time it opens.
 */
export function NotificationBell({ viewer, className }: { viewer: Viewer; className?: string }) {
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>({ status: "loading" });
  const [marking, startMarking] = useTransition();
  // The panel unmounts as it closes, so the bell, which stays, runs the navigation (the progress bar follows it).
  const navigate = useNavigate();

  const load = async () => {
    setPanel({ status: "loading" });
    try {
      const page = await apiClient.get<NotificationsPage>("/notifications?limit=10");
      setUnreadCount(page.unread);
      setPanel({ status: "ready", items: page.items, now: new Date() });
    } catch {
      setPanel({ status: "error" });
    }
  };

  const update = (change: (item: Notification) => Notification) =>
    setPanel((current) => (current.status === "ready" ? { ...current, items: current.items.map(change) } : current));

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const openItem = (item: Notification, target: string | null) => {
    if (!item.read) markRead(item.id).then((updated) => update((n) => (n.id === updated.id ? updated : n)), handleApiError);
    if (target) go(target);
  };

  const markAll = () =>
    startMarking(async () => {
      try {
        await markAllRead();
        update((n) => ({ ...n, read: true }));
      } catch (error) {
        handleApiError(error);
      }
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("relative shrink-0 text-white hover:bg-sidebar-accent", className)}
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell />
          {unread ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white"
            >
              {badgeText(unread)}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" aria-describedby={undefined} className="gap-0">
        <SheetHeader className="flex-row items-center justify-between gap-3 border-b pr-12">
          <SheetTitle className="text-base font-bold">Notifications</SheetTitle>
          <Button variant="outline" size="sm" onClick={markAll} disabled={marking || unread === 0}>
            Mark all as read
          </Button>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {panel.status === "loading" ? (
            <LoadingState title="Loading notifications…" />
          ) : panel.status === "error" ? (
            <ErrorState description="Notifications failed to load." onRetry={() => void load()} />
          ) : panel.items.length === 0 ? (
            <EmptyState title="No notifications yet" icon={<Bell />} />
          ) : (
            <NotificationList items={panel.items} now={panel.now} viewer={viewer} onOpen={openItem} />
          )}
        </div>
        <SheetFooter className="border-t">
          <Link
            href="/notifications"
            onNavigate={(event) => {
              event.preventDefault();
              go("/notifications");
            }}
            className="self-start text-sm font-bold text-primary hover:underline"
          >
            View all
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
