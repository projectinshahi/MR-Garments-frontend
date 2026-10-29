import { PageContainer, PageHeader } from "@/components/layout/page-header";

import type { NotificationsData } from "./data/queries";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationFeed } from "./notification-feed";

/** Notifications (50_17.1_Notifications.jpeg): filter chips and the signed-in user's own notifications (NTF-1). */
export function NotificationsScreen({ data }: { data: NotificationsData }) {
  return (
    <>
      <PageHeader title="Notifications" actions={<MarkAllReadButton />} />
      <PageContainer>
        {/* A refresh (Mark all as read) brings new data and a new `now`: the feed restarts from the first page. */}
        <NotificationFeed key={data.now} data={data} />
      </PageContainer>
    </>
  );
}
