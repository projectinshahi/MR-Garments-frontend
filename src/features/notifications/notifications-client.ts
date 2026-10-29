import { useSyncExternalStore } from "react";

import { apiClient } from "@/lib/api/client";
import type { NotificationResponse, ReadAllResponse, UnreadCountResponse } from "@/lib/api/types";

// The caller's unread count (NTF-2), shared by every bell and the Notifications page. It is fetched when the first
// subscriber mounts (the shell), again when the window regains focus or becomes visible, and after each read action.
// No interval polling. null: not known yet, or the last request failed (a 401 included; the proxy signs out).

let unread: number | null = null;
let latest = 0;
let inFlight = 0;
const listeners = new Set<() => void>();

export function setUnreadCount(value: number) {
  unread = value;
  listeners.forEach((listener) => listener());
}

export async function refreshUnreadCount() {
  const request = ++latest;
  inFlight++;
  try {
    const response = await apiClient.get<UnreadCountResponse>("/notifications/unread-count");
    // An older answer never overwrites a newer one (a read action may refresh while a focus refresh is out).
    if (request === latest) setUnreadCount(response.unread);
  } catch {
    // Keep the last count: the bell is a hint, never an error.
  } finally {
    inFlight--;
  }
}

const onWake = () => {
  // Focus and visibilitychange both fire when the user returns to the tab: one request is enough.
  if (document.visibilityState === "visible" && inFlight === 0) void refreshUnreadCount();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    void refreshUnreadCount();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      // Nobody shows it: forget it (and any answer still on its way), so the next subscriber starts from "unknown".
      unread = null;
      latest++;
    }
  };
}

/** The unread count, or null until it is known. */
export const useUnreadCount = () => useSyncExternalStore(subscribe, () => unread, () => null);

/** NTF-3, then a fresh count. Resolves to the updated notification; rejects with the ApiError. */
export async function markRead(id: string) {
  try {
    return (await apiClient.post<NotificationResponse>(`/notifications/${encodeURIComponent(id)}/read`)).notification;
  } finally {
    void refreshUnreadCount();
  }
}

/** NTF-4, then a fresh count. Rejects with the ApiError. */
export async function markAllRead() {
  try {
    return await apiClient.post<ReadAllResponse>("/notifications/read-all");
  } finally {
    void refreshUnreadCount();
  }
}
