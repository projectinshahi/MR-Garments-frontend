"use client";

import { useState } from "react";

import { SectionCard } from "@/components/shared/cards";
import { FilterChips } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";

import type { NotificationDot, NotificationItem } from "./data/queries";
import { filterNotifications, isNotificationFilter, notificationFilterOptions, type NotificationFilter } from "./notification-filter";

// Measured from 50_17.1_Notifications.jpeg: 60.3 px rows split by 1 px dividers (bg-table-head is the measured
// #f8f9fe unread tint), 18 px side padding, a 9 px dot
// 13.5 px before the text, 14 px bold titles over 12.5 px muted details, and 12.5 px times on the right.
const DOT_COLORS: Record<NotificationDot, string> = {
  red: "bg-chart-5",
  amber: "bg-chart-2",
  blue: "bg-chart-1",
  green: "bg-chart-3",
};

/** Filter chips and the notification list. Rows are not links: no target is designed. */
export function NotificationFeed({ items }: { items: NotificationItem[] }) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const visible = filterNotifications(items, filter);

  return (
    <>
      {/* The reference chips are 33 px tall; FilterChips size="sm" is 32 px, so the row keeps the 33 px. */}
      <div className="flex min-h-[33px] items-center justify-end">
        <FilterChips
          size="sm"
          label="Filter notifications"
          options={notificationFilterOptions(items)}
          value={filter}
          onValueChange={(value) => {
            if (isNotificationFilter(value)) setFilter(value);
          }}
          className="justify-end"
        />
      </div>

      <div className="flex flex-col gap-4">
        {/* No overflow clipping: as in the reference, the tinted first row covers the card's rounded top corners. */}
        <SectionCard className="p-0">
          {visible.length > 0 ? (
            <ul aria-label="Notifications" className="divide-y divide-border-subtle">
              {visible.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    // divide-y draws each divider inside the row above it: 60.3 px of row plus the 1 px divider.
                    "flex min-h-[61.3px] items-center gap-[13.5px] px-[18px] py-2 last:min-h-[60.3px]",
                    item.unread && "bg-table-head",
                  )}
                >
                  <span aria-hidden className={cn("size-[9px] shrink-0 rounded-full", DOT_COLORS[item.dot])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-[18px] font-bold">{item.title}</p>
                    <p className="text-[12.5px] leading-[15px] text-muted-foreground">{item.details.join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[12.5px] text-muted-foreground">
                    <span>{item.unread ? `${item.time} ·` : item.time}</span>
                    {item.unread ? <StatusPill tone="info">New</StatusPill> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-[18px] py-5 text-sm text-muted-foreground">No notifications here.</p>
          )}
        </SectionCard>
        <p className="text-[12.5px] leading-4 text-muted-foreground">
          Reminders go to procurement and management the day before a delivery is due, and again on the due date.
        </p>
      </div>
    </>
  );
}
