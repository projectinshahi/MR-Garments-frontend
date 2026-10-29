"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { SectionCard } from "@/components/shared/cards";
import { FilterChips } from "@/components/shared/filters";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { Notification, NotificationsPage } from "@/lib/api/types";
import { handleApiError } from "@/lib/feedback";

import type { NotificationsData } from "./data/queries";
import { filterNotifications, isNotificationFilter, notificationFilterOptions, type NotificationFilter } from "./notification-filter";
import { NotificationList } from "./notification-list";
import { markRead, useUnreadCount } from "./notifications-client";

/** Filter chips, the list (NTF-1, newest first) and "Load more". The screen remounts it with each server render. */
export function NotificationFeed({ data }: { data: NotificationsData }) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [items, setItems] = useState(data.items);
  const [cursor, setCursor] = useState(data.nextCursor);
  const [loadingMore, startLoadingMore] = useTransition();
  const navigate = useNavigate();
  // The shared count once known (the bell's), so the chip and the bell always agree.
  const unread = useUnreadCount() ?? data.unread;
  const visible = filterNotifications(items, filter);

  const replace = (updated: Notification) => setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));

  const open = (item: Notification, target: string | null) => {
    if (!item.read) markRead(item.id).then(replace, handleApiError);
    if (target) navigate(target);
  };

  const loadMore = () =>
    startLoadingMore(async () => {
      try {
        const page = await apiClient.get<NotificationsPage>(`/notifications?cursor=${encodeURIComponent(cursor ?? "")}`);
        setItems((current) => [...current, ...page.items]);
        setCursor(page.nextCursor);
      } catch (error) {
        handleApiError(error);
      }
    });

  return (
    <>
      {/* The reference chips are 33 px tall; FilterChips size="sm" is 32 px, so the row keeps the 33 px. */}
      <div className="flex min-h-[33px] items-center justify-end">
        <FilterChips
          size="sm"
          label="Filter notifications"
          options={notificationFilterOptions(unread)}
          value={filter}
          onValueChange={(value) => {
            if (isNotificationFilter(value)) setFilter(value);
          }}
          className="justify-end"
        />
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* No overflow clipping: as in the reference, the tinted first row covers the card's rounded top corners. */}
        <SectionCard className="w-full p-0">
          {items.length === 0 ? (
            <EmptyState title="No notifications yet" icon={<Bell />} />
          ) : visible.length > 0 ? (
            <NotificationList items={visible} now={new Date(data.now)} viewer={data.viewer} onOpen={open} />
          ) : (
            <p className="px-[18px] py-5 text-sm text-muted-foreground">No notifications here.</p>
          )}
        </SectionCard>
        {cursor ? (
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
    </>
  );
}
