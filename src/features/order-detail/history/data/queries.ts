import { orderHistory } from "./fixtures";

export type { HistoryEvent } from "./fixtures";

/** Everything that happened to one PO, newest first (tab i). Undefined when the PO has no record. */
export async function getOrderHistory(po: string) {
  const events = orderHistory[po];
  return events ? structuredClone(events) : undefined;
}
