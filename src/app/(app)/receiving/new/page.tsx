import type { Metadata } from "next";

import { getRecordReceipt } from "@/features/receiving/data/queries";
import { RecordReceiptScreen } from "@/features/receiving/record-receipt-screen";

export const metadata: Metadata = { title: "Record receipt" };

export default async function RecordReceiptPage() {
  const data = await getRecordReceipt();
  // A saved receipt changes the count, so the form remounts with the fresh REC-2 choices after router.refresh().
  return <RecordReceiptScreen key={data.receipts.length} data={data} />;
}
