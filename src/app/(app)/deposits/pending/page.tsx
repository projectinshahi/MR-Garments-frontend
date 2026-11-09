import type { Metadata } from "next";

import { getDeposits } from "@/features/deposits/data/queries";
import { DepositsScreen } from "@/features/deposits/deposits-screen";

export const metadata: Metadata = { title: "Pending deposits" };

export default async function PendingDepositsPage() {
  return <DepositsScreen data={await getDeposits()} view="pending" />;
}
