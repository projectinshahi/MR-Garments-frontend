import { listShippingAgents } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { ContainerRow, ContainerStatus, LoadContainer, LoadLine, OrderLoad } from "./fixtures";

export type ContainersListData = Awaited<ReturnType<typeof getContainersList>>;
export type LoadContainerData = Awaited<ReturnType<typeof getLoadContainer>>;

const agentNames = async () => (await listShippingAgents()).map((a) => a.name);

/** Containers list: KPIs, rows, footnote and the agent filter options. Async and copied so a real API can replace it. */
export async function getContainersList() {
  const agents = await agentNames();
  return structuredClone({
    kpis: fixtures.containerKpis,
    containers: fixtures.containers,
    footnote: fixtures.listFootnote,
    agents,
  });
}

/** Load container form, prefilled for FCIU 5527310 as in the reference. */
export async function getLoadContainer() {
  const agents = await agentNames();
  return structuredClone({ ...fixtures.loadContainer, agents });
}
