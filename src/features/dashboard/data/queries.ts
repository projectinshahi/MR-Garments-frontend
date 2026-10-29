import { unstable_rethrow } from "next/navigation";

import { canOpen } from "@/config/navigation";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { ContainerListItem, DeliveryItem, OrderListItem, PaymentsResponse } from "@/lib/api/types";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

import { type Source, toDashboard } from "../dashboard-logic";

// Dashboard (04) reads ORD-1, CAL-1, PAY-1 and CON-1 in parallel with ME-1; the API checks each one's permission.
// These calls read the session cookie, so the page renders inside the (app) loading.tsx Suspense boundary.

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** A 403 means the role can't see that card; any other failure fails only that card (it offers a retry). */
const settle = <T>(path: string): Promise<Source<T>> =>
  apiGet<T>(path).catch((error: unknown) => {
    // Next's own signals (the build's prerender ending a cookies() read, redirects) are not this card's failure.
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403) return "denied";
    console.error(`Dashboard: GET ${path} failed`, error);
    return "failed";
  });

/** Everything the dashboard shows, from the live API. Today is read after the API calls (Cache Components). */
export async function getDashboard() {
  const [me, orders, deliveries, payments, containers] = await Promise.all([
    getMe(),
    settle<OrderListItem[]>("/orders"),
    settle<DeliveryItem[]>("/deliveries"),
    settle<PaymentsResponse>("/payments"),
    settle<ContainerListItem[]>("/containers"),
  ]);
  const today = todayInIndia();
  // A card links to its page only when the user may open it (the proxy would send them back to the dashboard).
  const can = (path: string) => !!me && canOpen(me, path);
  return {
    today,
    ...toDashboard({ orders, deliveries, payments, containers }, today),
    links: { calendar: can("/calendar"), payments: can("/payments"), containers: can("/containers") },
  };
}
