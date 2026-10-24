import { listLocations, listSuppliers } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { DeliveryEvent, ReceiptLine, ReceiptRow, ReceiptState, RecordReceipt } from "./fixtures";

export type ReceivingListData = Awaited<ReturnType<typeof getReceivingList>>;
export type RecordReceiptData = Awaited<ReturnType<typeof getRecordReceipt>>;

/** Goods are received at the China offices only. */
const chinaOffices = async () => (await listLocations()).filter((l) => l.type === "China office").map((l) => l.name);

/** Receiving (China) list: KPIs, receipts and the filter options. Async and copied so a real API can replace it. */
export async function getReceivingList() {
  const [offices, suppliers] = await Promise.all([chinaOffices(), listSuppliers()]);
  return structuredClone({
    kpis: fixtures.receivingKpis,
    receipts: fixtures.receipts,
    offices,
    suppliers: suppliers.map((s) => s.name),
  });
}

/** Record receipt form, prefilled for PO-2035 as in the reference. */
export async function getRecordReceipt() {
  const offices = await chinaOffices();
  return structuredClone({ ...fixtures.recordReceipt, offices });
}
