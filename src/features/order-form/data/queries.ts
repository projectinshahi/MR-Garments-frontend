import { listSuppliers } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { Deposit, NewOrderDraft, OrderLine } from "./fixtures";

export type NewOrderData = Awaited<ReturnType<typeof getNewOrder>>;

/** New order form (Stage 1), prefilled for PO-2050 as in the reference, with the master suppliers as options. */
export async function getNewOrder() {
  const suppliers = await listSuppliers();
  return structuredClone({ ...fixtures.newOrder, suppliers: suppliers.map((s) => s.name) });
}
