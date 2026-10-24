import { warehouseReceipts } from "./fixtures";

export type { TeamShare, WarehouseReceipt } from "./fixtures";

/** Warehouse receipt and the split to teams for one PO (tab g). Undefined when the PO has no record. */
export async function getWarehouseReceipt(po: string) {
  const record = warehouseReceipts[po];
  return record ? structuredClone(record) : undefined;
}
