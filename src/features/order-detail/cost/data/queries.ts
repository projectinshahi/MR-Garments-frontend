import { orderCosts } from "./fixtures";

export type { CostGroup, CostLine, OrderCost } from "./fixtures";

/** Landed-cost lines for one PO (tab h). Undefined when the PO has no record. */
export async function getOrderCost(po: string) {
  const record = orderCosts[po];
  return record ? structuredClone(record) : undefined;
}
