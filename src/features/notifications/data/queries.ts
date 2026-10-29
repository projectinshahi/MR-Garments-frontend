import { apiGet } from "@/lib/api/server";
import type { NotificationsPage } from "@/lib/api/types";
import { getMe } from "@/lib/session";

import type { Viewer } from "../notification-filter";

// Notifications (50_17.1) reads NTF-1's first page with ME-1. The calls read the session cookie, so the page renders
// inside the shell's Suspense boundary; a failure throws to the (app) error.tsx.

export type NotificationsData = Awaited<ReturnType<typeof getNotifications>>;

/** The newest notifications, the viewer (which pages a row may open) and the clock the times are measured against. */
export async function getNotifications() {
  const [page, me] = await Promise.all([apiGet<NotificationsPage>("/notifications"), getMe()]);
  const viewer: Viewer | null = me ? { shell: me.shell, permissions: me.permissions } : null;
  // Read after the API calls (Cache Components); also the feed's key, so each server render starts it afresh.
  return { ...page, viewer, now: new Date().toISOString() };
}
