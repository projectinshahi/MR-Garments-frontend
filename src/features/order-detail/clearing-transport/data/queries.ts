import { clearingTransport } from "./fixtures";

export type { ClearingTransport, CostLine } from "./fixtures";

/** Clearing in India and transport to the warehouse for one PO (tab f). Undefined when the PO has no record. */
export async function getClearingTransport(po: string) {
  const record = clearingTransport[po];
  return record ? structuredClone(record) : undefined;
}
