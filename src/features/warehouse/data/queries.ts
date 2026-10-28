import { hasAccess } from "@/config/navigation";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { ReceiveGoodsForm, WarehouseList } from "@/lib/api/stages-types";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

// Warehouse reads WH-1 and WH-2 (backend docs/wave3-contracts.md section 8). These calls read the session cookie, so
// the pages render inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx. Cost figures arrive
// only for users with landedCost >= View; the screens show them when present.

export type WarehouseListData = Awaited<ReturnType<typeof getWarehouseList>>;
export type ReceiveGoodsData = NonNullable<Awaited<ReturnType<typeof getReceiveGoods>>>;

/** Warehouse list (30): WH-1, whether costs are shown and whether the user may receive goods (warehouse >= Enter). */
export async function getWarehouseList() {
  const [list, me] = await Promise.all([apiGet<WarehouseList>("/warehouse-receipts"), getMe()]);
  return {
    ...list,
    showCosts: !!me && hasAccess(me, "landedCost", "View"),
    canEnter: !!me && hasAccess(me, "warehouse", "Enter"),
  };
}

/** Receive goods (29) for one trip: WH-2, or null for an unknown id (the page calls notFound()). */
export async function getReceiveGoods(transportId: string) {
  const [form, me] = await Promise.all([
    apiGet<ReceiveGoodsForm>(`/warehouse-receipts/${encodeURIComponent(transportId)}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    getMe(),
  ]);
  if (!form) return null;
  return { form, today: todayInIndia(), me: me?.name ?? "", canEnter: !!me && hasAccess(me, "warehouse", "Enter") };
}
