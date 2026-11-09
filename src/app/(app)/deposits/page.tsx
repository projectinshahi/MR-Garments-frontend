import type { Metadata } from "next";

import { getDeposits } from "@/features/deposits/data/queries";
import { DepositsScreen } from "@/features/deposits/deposits-screen";

export const metadata: Metadata = { title: "Deposits" };

export default async function DepositsPage() {
  return <DepositsScreen data={await getDeposits()} view="all" />;
}
