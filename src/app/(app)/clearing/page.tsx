import type { Metadata } from "next";

import { ClearingListScreen } from "@/features/clearing/clearing-list-screen";
import { getClearingList } from "@/features/clearing/data/queries";

export const metadata: Metadata = { title: "Clearing (India)" };

export default async function ClearingPage() {
  const data = await getClearingList();
  return <ClearingListScreen data={data} />;
}
