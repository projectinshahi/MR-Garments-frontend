import { apiGet } from "@/lib/api/server";
import type { ContainerListItem, ContainerOptions } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";

import { agentNames, containerKpis, listFootnote, toContainerRow } from "../containers-logic";

export type { ContainerRow, ContainerStatus } from "../containers-logic";

// Containers screens (24, 23) read the live API. These calls read the session cookie, so the pages render inside the
// (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type ContainersListData = Awaited<ReturnType<typeof getContainersList>>;
export type LoadContainerData = Awaited<ReturnType<typeof getLoadContainer>>;

/** Containers list (24): CON-1 rows, with the KPIs counted against today in India. */
export async function getContainersList() {
  const containers = (await apiGet<ContainerListItem[]>("/containers")).map(toContainerRow);
  return {
    containers,
    kpis: containerKpis(containers, todayInIndia()),
    footnote: listFootnote(containers),
    // From the rows, not CON-2: that needs Enter access and the list only View.
    agents: agentNames(containers),
  };
}

/** Load container (23): CON-2's active agents and loadable lines, and today (the default loading date). */
export async function getLoadContainer() {
  const options = await apiGet<ContainerOptions>("/containers/options");
  return { ...options, today: todayInIndia() };
}
