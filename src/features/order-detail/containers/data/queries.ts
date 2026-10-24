import { containersByPO } from "./fixtures";

export type { OrderContainerFixture as OrderContainer } from "./fixtures";

/** Containers tab (10): the containers carrying this order. */
export async function listOrderContainers(po: string) {
  const containers = containersByPO[po];
  return containers ? structuredClone(containers) : undefined;
}
