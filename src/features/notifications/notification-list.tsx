import { StatusPill } from "@/components/shared/status-pill";
import { formatLastSignIn as formatTime } from "@/features/users/user-rows";
import type { Notification } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { kindStyle, notificationTarget, type Viewer } from "./notification-filter";

type NotificationListProps = {
  items: Notification[];
  /** The clock the times are measured against ("Today, 09:00"). */
  now: Date;
  viewer: Viewer | null;
  /** A row was clicked: mark it read, and open `target` when there is one. */
  onOpen: (item: Notification, target: string | null) => void;
};

// Measured from 50_17.1_Notifications.jpeg: 60.3 px rows split by 1 px dividers (bg-table-head is the measured
// #f8f9fe unread tint), 18 px side padding, a 9 px dot 13.5 px before the text, 14 px bold titles over 12.5 px muted
// details, and 12.5 px times on the right. Used by the Notifications page and the bell's panel.
export function NotificationList({ items, now, viewer, onOpen }: NotificationListProps) {
  return (
    <ul aria-label="Notifications" className="divide-y divide-border-subtle">
      {items.map((item) => {
        const target = notificationTarget(viewer, item.href);
        const time = formatTime(item.createdAt, now);
        const content = (
          <>
            <span aria-hidden className={cn("size-[9px] shrink-0 rounded-full", kindStyle(item.kind).dot)} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-[18px] font-bold">{item.title}</span>
              {item.details.length ? (
                <span className="block text-[12.5px] leading-[15px] text-muted-foreground">{item.details.join(" · ")}</span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-muted-foreground">
              <span>{item.read ? time : `${time} ·`}</span>
              {item.read ? null : <StatusPill tone="info">New</StatusPill>}
            </span>
          </>
        );
        const row = cn("flex min-h-[60.3px] w-full items-center gap-[13.5px] px-[18px] py-2 text-left", !item.read && "bg-table-head");
        return (
          <li key={item.id}>
            {/* Only a row that can still be marked read, or that opens a page, is a button. */}
            {!item.read || target ? (
              <button
                type="button"
                className={cn(row, "outline-none hover:bg-neutral-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset")}
                onClick={() => onOpen(item, target)}
              >
                {content}
              </button>
            ) : (
              <div className={row}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
