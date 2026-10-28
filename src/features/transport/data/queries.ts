import { hasAccess } from "@/config/navigation";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { TransportForm, TransportList } from "@/lib/api/stages-types";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

// Transport reads TRN-1 and TRN-2 (backend docs/wave3-contracts.md section 8). These calls read the session cookie,
// so the pages render inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type TransportListData = Awaited<ReturnType<typeof getTransportList>>;
export type TransportFormData = NonNullable<Awaited<ReturnType<typeof getTransportForm>>>;

/** Transport list (28): TRN-1 and whether the signed-in user may record trips (transport >= Enter). */
export async function getTransportList() {
  const [list, me] = await Promise.all([apiGet<TransportList>("/transports"), getMe()]);
  return { ...list, canEnter: !!me && hasAccess(me, "transport", "Enter") };
}

/** Transport form (27) for one container: TRN-2, or null for an unknown id (the page calls notFound()). */
export async function getTransportForm(containerId: string) {
  const [form, me] = await Promise.all([
    apiGet<TransportForm>(`/transports/${encodeURIComponent(containerId)}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    getMe(),
  ]);
  if (!form) return null;
  return { form, today: todayInIndia(), canEnter: !!me && hasAccess(me, "transport", "Enter") };
}
