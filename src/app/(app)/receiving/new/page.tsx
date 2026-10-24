import type { Metadata } from "next";

import { getRecordReceipt } from "@/features/receiving/data/queries";
import { RecordReceiptScreen } from "@/features/receiving/record-receipt-screen";

export const metadata: Metadata = { title: "Record receipt" };

export default async function RecordReceiptPage() {
  const data = await getRecordReceipt();
  return <RecordReceiptScreen data={data} />;
}
