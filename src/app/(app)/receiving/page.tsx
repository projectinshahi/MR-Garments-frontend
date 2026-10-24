import type { Metadata } from "next";

import { getReceivingList } from "@/features/receiving/data/queries";
import { ReceivingListScreen } from "@/features/receiving/receiving-list-screen";

export const metadata: Metadata = { title: "Receiving (China)" };

export default async function ReceivingPage() {
  const data = await getReceivingList();
  return <ReceivingListScreen data={data} />;
}
