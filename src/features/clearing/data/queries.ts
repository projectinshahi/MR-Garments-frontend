import { hasAccess } from "@/config/navigation";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { ClearingForm, ClearingList } from "@/lib/api/stages-types";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

// Clearing (India) reads CLR-1 and CLR-2 (backend docs/wave3-contracts.md section 8). These calls read the session
// cookie, so the pages render inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type ClearingListData = Awaited<ReturnType<typeof getClearingList>>;
export type ClearingFormData = NonNullable<Awaited<ReturnType<typeof getClearingForm>>>;

/** Clearing list (26): CLR-1 and whether the signed-in user may record clearings (clearing >= Enter). */
export async function getClearingList() {
  const [list, me] = await Promise.all([apiGet<ClearingList>("/clearings"), getMe()]);
  return { ...list, today: todayInIndia(), canEnter: !!me && hasAccess(me, "clearing", "Enter") };
}

/** Clearing form (25) for one container: CLR-2, or null for an unknown id (the page calls notFound()). */
export async function getClearingForm(containerId: string) {
  const [form, me] = await Promise.all([
    apiGet<ClearingForm>(`/clearings/${encodeURIComponent(containerId)}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    getMe(),
  ]);
  if (!form) return null;
  return { form, today: todayInIndia(), canEnter: !!me && hasAccess(me, "clearing", "Enter") };
}
