import type { Metadata } from "next";

import { getNotifications } from "@/features/notifications/data/queries";
import { NotificationsScreen } from "@/features/notifications/notifications-screen";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const data = await getNotifications();
  return <NotificationsScreen data={data} />;
}
