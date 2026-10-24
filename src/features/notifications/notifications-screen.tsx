import { PageContainer, PageHeader } from "@/components/layout/page-header";

import type { NotificationsData } from "./data/queries";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationFeed } from "./notification-feed";

/** Notifications (50_17.1_Notifications.jpeg): filter chips, the list with three unread rows, and the reminder note. */
export function NotificationsScreen({ data }: { data: NotificationsData }) {
  return (
    <>
      <PageHeader title="Notifications" actions={<MarkAllReadButton />} />
      <PageContainer>
        <NotificationFeed items={data.items} />
      </PageContainer>
    </>
  );
}
