import type { Metadata } from "next";

import { getMilestones } from "@/features/supplier-ledger/data/queries";
import { MilestonesScreen } from "@/features/supplier-ledger/milestones-screen";

export const metadata: Metadata = { title: "Deposit milestones" };

export default async function DepositMilestonesPage() {
  return <MilestonesScreen data={await getMilestones()} />;
}
