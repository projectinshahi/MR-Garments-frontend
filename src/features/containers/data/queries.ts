import { canOpen, hasAccess } from "@/config/navigation";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { ContainerDetail, ContainerListItem, ContainerOptions } from "@/lib/api/types";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

import { agentNames, containerKpis, listFootnote, toContainerRow } from "../containers-logic";

export type { ContainerRow, ContainerStatus } from "../containers-logic";

// Containers screens (24, 23) and the container detail page read the live API. These calls read the session cookie,
// so the pages render inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type ContainersListData = Awaited<ReturnType<typeof getContainersList>>;
export type LoadContainerData = NonNullable<Awaited<ReturnType<typeof getLoadContainer>>>;
export type ContainerDetailData = NonNullable<Awaited<ReturnType<typeof getContainerDetail>>>;

/**
 * Containers list (24): CON-1 rows, with the KPIs counted against today in India, and what the signed-in user may do:
 * load containers (containers >= Enter) and open orders from the PO.
 */
export async function getContainersList() {
  const [items, me] = await Promise.all([apiGet<ContainerListItem[]>("/containers"), getMe()]);
  const containers = items.map(toContainerRow);
  return {
    containers,
    kpis: containerKpis(containers, todayInIndia()),
    footnote: listFootnote(containers),
    // From the rows, not CON-2: that needs Enter access and the list only View.
    agents: agentNames(containers),
    canEnter: !!me && hasAccess(me, "containers", "Enter"),
    linkPos: !!me && canOpen(me, "/orders"),
  };
}

/**
 * Load container (23): CON-2's active agents and loadable lines, and today (the default loading date). null when the
 * user can't load containers (containers below Enter): the page shows an access message instead.
 */
export async function getLoadContainer() {
  const me = await getMe();
  if (!me || !hasAccess(me, "containers", "Enter")) return null;
  const options = await apiGet<ContainerOptions>("/containers/options");
  return { ...options, today: todayInIndia() };
}

/** Container detail: CON-4, or null for an unknown id (the page calls notFound()). */
export async function getContainerDetail(id: string) {
  const [container, me] = await Promise.all([
    apiGet<ContainerDetail>(`/containers/${encodeURIComponent(id)}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    getMe(),
  ]);
  if (!container) return null;
  return {
    container,
    today: todayInIndia(),
    canEnter: !!me && hasAccess(me, "containers", "Enter"),
    linkPos: !!me && canOpen(me, "/orders"),
  };
}
