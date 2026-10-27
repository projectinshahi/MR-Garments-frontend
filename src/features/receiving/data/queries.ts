import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { ReceiptListItem, ReceiptOptions } from "@/lib/api/types";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

import { receivingKpis, toReceiptRow, uniqueSorted } from "../receiving-logic";

// Receiving (China) reads REC-1 and REC-2 (docs/live-screens-contracts.md). These calls read the session cookie, so
// the pages render inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

/** "short" stays in the type for the status chip, but REC-1 has no counted-short fact, so rows are never short. */
export type ReceiptState = "partly" | "short" | "complete";

export type ReceiptRow = {
  id: string;
  receivedOn: string;
  po: string;
  supplier: string;
  item: string;
  office: string;
  ordered: number;
  unit: string;
  thisReceipt: number;
  totalSoFar: number;
  /** null: not counted yet ("–"). */
  short: number | null;
  bundles: number;
  receivedBy: string;
  state: ReceiptState;
  statusLabel: string;
};

export type ReceiptLine = {
  item: string;
  unit: string;
  ordered: number;
  receivedEarlier: number;
  receivedNow: number;
  /** CNY per unit; lines with a price reduce the payment when short. */
  unitPrice?: number;
};

export type ReceivingListData = Awaited<ReturnType<typeof getReceivingList>>;
export type RecordReceiptData = Awaited<ReturnType<typeof getRecordReceipt>>;

/** REC-2 needs receiving >= Enter: a viewer gets null and "Waiting to be received" shows "–". */
const nullOn403 = (error: unknown): null => {
  if (error instanceof ApiError && error.status === 403) return null;
  throw error;
};

/** Receiving (China) list: REC-1 rows, KPIs from them (and REC-2's waiting orders), filter options from the rows. */
export async function getReceivingList() {
  const [items, options] = await Promise.all([
    apiGet<ReceiptListItem[]>("/receipts"),
    apiGet<ReceiptOptions>("/receipts/options").catch(nullOn403),
  ]);
  return {
    receipts: items.map(toReceiptRow),
    kpis: receivingKpis(items, options, todayInIndia()),
    offices: uniqueSorted(items.map((r) => r.office)),
    suppliers: uniqueSorted(items.map((r) => r.supplier)),
  };
}

/** Record receipt: REC-2 choices, REC-1 for the deliveries panel, and the signed-in user (the API sets receivedBy). */
export async function getRecordReceipt() {
  // ponytail: reads every receipt for the deliveries panel; filter server-side (REC-1 ?orderId=) if the list grows large.
  const [options, receipts, me] = await Promise.all([
    apiGet<ReceiptOptions>("/receipts/options"),
    apiGet<ReceiptListItem[]>("/receipts"),
    getMe(),
  ]);
  return { options, receipts, receivedBy: me?.name ?? "", today: todayInIndia() };
}
