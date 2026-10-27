import { apiGet } from "@/lib/api/server";
import type { OrderOptions } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";

// New order (15) reads ORD-2 (the next PO, suppliers, items and agents). The call reads the session cookie, so the
// page renders inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type NewOrderData = Awaited<ReturnType<typeof getNewOrder>>;

/** The form's choices and today in India (the default order date). */
export async function getNewOrder() {
  const options = await apiGet<OrderOptions>("/orders/options");
  return { options, today: todayInIndia() };
}
